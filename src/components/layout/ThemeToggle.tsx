import { Moon, Sun, Monitor } from 'lucide-react';
import { IconButton } from '../ui/Button';
import type { ThemePref } from '../../store/types';
import { useTheme } from './useTheme';

const ORDER: ThemePref[] = ['dark', 'light', 'system'];
const LABEL: Record<ThemePref, string> = { dark: 'Dark', light: 'Light', system: 'System' };

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <IconButton label={'Theme: ' + LABEL[theme] + '. Switch to ' + LABEL[next]} data-testid="theme-toggle" data-theme={theme} onClick={() => setTheme(next)}>
      <Icon className="h-[18px] w-[18px]" />
    </IconButton>
  );
}
