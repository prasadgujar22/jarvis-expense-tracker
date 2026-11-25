import { useEffect } from 'react';
import { create } from 'zustand';
import { useStore } from '../../store/store';
import { useSync } from '../../sync/sync';
import { DEVICE_THEME_KEY } from '../../store/persist';
import type { ThemePref } from '../../store/types';

function readDeviceTheme(): ThemePref {
  try {
    const t = localStorage.getItem(DEVICE_THEME_KEY);
    if (t === 'dark' || t === 'light' || t === 'system') return t;
  } catch {
    /* ignore */
  }
  return 'dark';
}

/** Theme for screens shown before the user's settings are loaded (sign-in, splash). */
export const useDeviceTheme = create<{ theme: ThemePref }>()(() => ({ theme: readDeviceTheme() }));

/** The theme in effect: the account's setting once its data is loaded, else this device's preference. */
export function useTheme(): [ThemePref, (t: ThemePref) => void] {
  const ready = useSync((s) => s.phase === 'ready');
  const accountTheme = useStore((s) => s.settings.theme);
  const deviceTheme = useDeviceTheme((s) => s.theme);
  const update = useStore((s) => s.updateSettings);
  const set = (t: ThemePref) => {
    try {
      localStorage.setItem(DEVICE_THEME_KEY, t);
    } catch {
      /* ignore */
    }
    useDeviceTheme.setState({ theme: t });
    if (ready) update({ theme: t });
  };
  return [ready ? accountTheme : deviceTheme, set];
}

export function useApplyTheme() {
  const [theme] = useTheme();
  useEffect(() => {
    try {
      localStorage.setItem(DEVICE_THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    if (useDeviceTheme.getState().theme !== theme) useDeviceTheme.setState({ theme });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      const root = document.documentElement;
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#060a13' : '#f4f6fa'));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
