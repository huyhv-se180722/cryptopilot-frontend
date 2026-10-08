import type { PropsWithChildren } from 'react';

/** Keyboard hint chip (Figma command palette). */
export function Kbd({ children }: PropsWithChildren) {
  return (
    <kbd className="inline-flex items-center gap-0.5 rounded border border-line bg-raised px-1.5 py-px font-mono text-[10px] leading-snug text-muted-dim">
      {children}
    </kbd>
  );
}
