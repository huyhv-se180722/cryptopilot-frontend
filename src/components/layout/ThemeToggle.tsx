import { Monitor, Moon, Sun } from 'lucide-react';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useCopy } from '../../hooks/use-copy';
import { useTheme } from '../../hooks/use-theme';
import type { ThemePreference } from '../../app/theme/theme';

/** Light / Dark / System switch from the Figma top navigation. */
export function ThemeToggle() {
  const copy = useCopy();
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl<ThemePreference>
      label={copy.theme.label}
      iconOnly
      value={preference}
      onChange={setPreference}
      options={[
        { value: 'light', label: copy.theme.light, icon: <Sun size={11} /> },
        { value: 'dark', label: copy.theme.dark, icon: <Moon size={11} /> },
        {
          value: 'system',
          label: copy.theme.system,
          icon: <Monitor size={11} />,
        },
      ]}
    />
  );
}
