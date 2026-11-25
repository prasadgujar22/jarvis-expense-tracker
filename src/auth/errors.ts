import type { AuthError } from '@supabase/supabase-js';

/** Turn Supabase auth errors into short, human messages. */
export function friendlyAuthError(error: AuthError | Error | null | undefined): string {
  if (!error) return '';
  const code = (error as AuthError).code ?? '';
  const status = (error as AuthError).status ?? 0;
  const msg = error.message ?? '';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return "You're offline. Check your connection and try again.";
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(msg) || error.name === 'AuthRetryableFetchError')
    return "Can't reach Kosh right now. Check your connection and try again.";
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox for the link we sent.';
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered|already exists/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
  if (code === 'email_address_not_authorized' || /email address not authorized/i.test(msg))
    return "We can't send email to this address yet — email delivery is limited while Kosh is in early access. Try another address or contact the Kosh team.";
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg)) return 'Too many emails were sent recently. Please wait a few minutes and try again.';
  if (code === 'over_request_rate_limit' || status === 429 || /rate limit|too many requests/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
  if (code === 'weak_password' || /password should|weak password/i.test(msg)) return 'That password is too weak. Use at least 8 characters with letters and numbers.';
  if (code === 'same_password') return 'Choose a password different from your current one.';
  // signInWithOtp({ shouldCreateUser: false }) for an unknown address reports "Signups not allowed for otp".
  if (code === 'otp_disabled' || /signups not allowed for otp/i.test(msg)) return 'No account was found for this email. Create an account first.';
  if (code === 'signup_disabled' || /signups not allowed/i.test(msg)) return 'New sign-ups are closed right now. If you already have an account, sign in instead.';
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return 'That email address looks invalid.';
  if (code === 'session_not_found' || code === 'session_expired' || /auth session missing/i.test(msg)) return 'Your reset link has expired. Request a new one.';
  return msg || 'Something went wrong. Please try again.';
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Enter your email address.';
  if (!EMAIL_RE.test(e)) return 'Enter a valid email address, like you@example.com.';
  return null;
}

export function validateNewPassword(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use a mix of letters and numbers.';
  return null;
}

/** 0–4 rough strength score for the meter. */
export function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
