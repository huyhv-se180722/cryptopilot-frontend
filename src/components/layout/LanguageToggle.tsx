import { SegmentedControl } from '../ui/SegmentedControl';
import { useCopy } from '../../hooks/use-copy';
import { useLocalePreference } from '../../hooks/use-locale-preference';
import type { Locale } from '../../i18n/copy';

/** VI / EN switch beside the theme toggle; remembered on this device. */
export function LanguageToggle() {
  const copy = useCopy();
  const preference = useLocalePreference();
  if (!preference) return null;
  return (
    <SegmentedControl<Locale>
      label={copy.language.label}
      value={preference.locale}
      onChange={preference.setLocale}
      options={[
        { value: 'vi', label: 'VI' },
        { value: 'en', label: 'EN' },
      ]}
    />
  );
}
