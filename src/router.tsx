import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export const ROUTES = ['/', '/transactions', '/budgets', '/recurring', '/goals', '/insights', '/accounts', '/settings'] as const;
export type RoutePath = (typeof ROUTES)[number];

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
if (typeof window !== 'undefined') window.addEventListener('popstate', emit);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getLocation(): string {
  return window.location.pathname + window.location.search;
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (to === window.location.pathname + window.location.search) return;
  if (opts.replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  emit();
  window.scrollTo({ top: 0 });
}

function useLocationString(): string {
  return useSyncExternalStore(subscribe, getLocation, () => '/');
}

export function usePath(): string {
  const loc = useLocationString();
  const i = loc.indexOf('?');
  return i === -1 ? loc : loc.slice(0, i);
}

/** Current query string (including '?', or ''), updated on navigate() and popstate. */
export function useSearch(): string {
  const loc = useLocationString();
  const i = loc.indexOf('?');
  return i === -1 ? '' : loc.slice(i);
}

export function matchRoute(path: string): RoutePath | null {
  const p = path.replace(/\/+$/, '') || '/';
  return (ROUTES as readonly string[]).includes(p) ? (p as RoutePath) : null;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };
export function Link({ to, onClick, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest} />;
}
