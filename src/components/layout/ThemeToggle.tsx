import { Moon, Sun, Monitor } from 'lucide-react';
import { useStore } from '../../store/store';
import { IconButton } from '../ui/Button';
import type { ThemePref } from '../../store/types';

const ORDER: ThemePref[] = ['dark', 'light', 'system'];
const LABEL: Record<ThemePref, string> = { dark: 'Dark', light: 'Light', system: 'System' };

export function ThemeToggle() {
  const theme = useStore((s) => s.settings.theme);
  const update = useStore((s) => s.updateSettings);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <IconButton label={'Theme: ' + LABEL[theme] + '. Switch to ' + LABEL[next]} data-testid="theme-toggle" data-theme={theme} onClick={() => update({ theme: next })}>
      <Icon className="h-[18px] w-[18px]" />
    </IconButton>
  );
}
