import type { PropsWithChildren } from 'react';

/** Figma Settings section label, on the 12 px step of D-161. */
export function SectionTitle({ children }: PropsWithChildren) {
  return (
    <h2 className="mb-4 text-xs font-semibold text-muted-x">{children}</h2>
  );
}
