import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { startSync, stopSync, flush, pendingCount } from '../sync/sync';
import { clearUserCache } from '../store/persist';

export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** The session came from a password-recovery link: show the "set a new password" screen. */
  recovery: boolean;
  /** A message to show on the auth screen after a redirect (expired link, confirmed email…). */
  notice: { tone: 'info' | 'error'; text: string } | null;
}

export const useAuth = create<AuthState>()(() => ({
  status: supabase ? 'loading' : 'unconfigured',
  session: null,
  user: null,
  recovery: false,
  notice: null,
}));

export function setAuthNotice(notice: AuthState['notice']) {
  useAuth.setState({ notice });
}

const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description', 'type', 'token_hash', 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'provider_token', 'sb'];

/** Read and strip Supabase redirect params (?code=…, #access_token=…, ?error_description=…) from the URL. */
function consumeRedirectParams(): { error: string | null; errorCode: string | null; hadCode: boolean; type: string | null } {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : '');
  const get = (k: string) => url.searchParams.get(k) ?? hash.get(k);
  const result = {
    error: get('error_description') ?? get('error'),
    errorCode: get('error_code'),
    hadCode: url.searchParams.has('code') || hash.has('access_token'),
    type: get('type'),
  };
  let changed = false;
  for (const k of AUTH_PARAMS) {
    if (url.searchParams.has(k)) {
      url.searchParams.delete(k);
      changed = true;
    }
  }
  if (hash.size && AUTH_PARAMS.some((k) => hash.has(k))) {
    url.hash = '';
    changed = true;
  }
  if (changed) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return result;
}

function friendlyRedirectError(error: string, code: string | null): string {
  if (code === 'otp_expired' || /expired|invalid/i.test(error)) return 'That link has expired or was already used. Request a new one below.';
  if (/access_denied/i.test(error)) return 'Sign-in was cancelled.';
  return error.replace(/\+/g, ' ');
}

/** True only while the user's own sign-out runs: then (and only then) this user's local cache is deleted. */
let explicitSignOut = false;

function applySession(session: Session | null) {
  const prevUser = useAuth.getState().user;
  useAuth.setState({ session, user: session?.user ?? null, status: session ? 'signedIn' : 'signedOut' });
  if (session && supabase) {
    if (prevUser?.id !== session.user.id) startSync(supabase, session.user.id);
  } else if (prevUser) {
    if (explicitSignOut) {
      explicitSignOut = false;
      stopSync({ clearCache: true });
      return;
    }
    // The session ended on its own (expired/revoked refresh token, password changed elsewhere). Keep the cache and
    // the pending queue: signing in again as the same user uploads them.
    const pending = pendingCount();
    stopSync({ clearCache: false });
    setAuthNotice({
      tone: 'info',
      text:
        'Your session ended. Sign in again to continue' +
        (pending ? ' — ' + pending + ' unsynced change' + (pending === 1 ? ' is' : 's are') + ' kept on this device and will upload after you sign in.' : '.'),
    });
  }
}

/**
 * Explicit sign-out is announced to the user's other tabs, so they also delete the cache instead of treating their
 * SIGNED_OUT (relayed by supabase-js) as a forced session end that keeps it.
 */
const authChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kosh-auth') : null;
let explicitResetTimer: number | undefined;
if (authChannel) {
  authChannel.onmessage = (e: MessageEvent) => {
    const msg = e.data as { type?: string; userId?: string } | null;
    if (!msg || msg.type !== 'signed-out' || !msg.userId) return;
    const current = useAuth.getState().user;
    if (current?.id === msg.userId) {
      // Our SIGNED_OUT is still on its way: make it clear the cache. Forget the flag if it never arrives.
      explicitSignOut = true;
      window.clearTimeout(explicitResetTimer);
      explicitResetTimer = window.setTimeout(() => (explicitSignOut = false), 10_000);
    } else if (!current) {
      // We already stopped (treated it as forced): delete what we kept, and anything we wrote before stopping.
      clearUserCache(msg.userId);
      if (useAuth.getState().notice?.text.startsWith('Your session ended')) setAuthNotice(null);
    }
  };
}

let initialised = false;
export async function initAuth(): Promise<void> {
  if (initialised || !supabase) return;
  initialised = true;
  const isRecoveryPath = window.location.pathname.replace(/\/+$/, '') === '/reset-password';
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') useAuth.setState({ recovery: true });
    if (event === 'INITIAL_SESSION') return; // handled below after initialize()
    // Defer: never call supabase inside the callback synchronously (it holds the auth lock).
    setTimeout(() => applySession(session), 0);
  });
  // Exchanges ?code= (PKCE) or #access_token= on load.
  const { error } = await supabase.auth.initialize();
  const redirect = consumeRedirectParams();
  const { data } = await supabase.auth.getSession();
  if (isRecoveryPath && data.session && (redirect.hadCode || redirect.type === 'recovery')) useAuth.setState({ recovery: true });
  if (!data.session) {
    if (redirect.error) setAuthNotice({ tone: 'error', text: friendlyRedirectError(redirect.error, redirect.errorCode) });
    else if (error && redirect.hadCode) {
      // A confirmation/magic link opened in another browser: Supabase already verified the email, but this
      // browser doesn't hold the PKCE verifier. Ask the user to sign in here.
      setAuthNotice({
        tone: 'info',
        text: isRecoveryPath
          ? 'Open the reset link in the same browser you requested it from, or request a new one.'
          : 'Your email is confirmed. Sign in to continue.',
      });
    }
  }
  applySession(data.session);
}

/** Signs out of this device: clears in-memory state and this user's local cache. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  if (pendingCount() > 0) await flush().catch(() => undefined);
  explicitSignOut = true;
  const userId = useAuth.getState().user?.id;
  if (userId) authChannel?.postMessage({ type: 'signed-out', userId });
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    // Offline (or the server refused): forget the session on this device anyway.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && /^sb-.*-auth-token/.test(k)) localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
    applySession(null);
  }
}
