import { Info } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';

/** Every Academy screen says that it teaches and does not advise. */
export function AcademyDisclaimer() {
  const copy = useCopy();
  return (
    <p className="mt-8 flex items-center gap-2 text-xs text-muted-dim">
      <Info size={13} aria-hidden="true" />
      {copy.academy.disclaimer}
    </p>
  );
}
