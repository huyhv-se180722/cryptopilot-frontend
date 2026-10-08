import { useCopy } from '../../hooks/use-copy';

/** MSG42 disclaimer shown in the footer of every shell (BR-60). */
export function DisclaimerFooter() {
  const copy = useCopy();
  return (
    <footer className="border-t border-line px-4 py-4 text-center text-[11px] leading-relaxed text-muted-x">
      {copy.messages.MSG42}
    </footer>
  );
}
