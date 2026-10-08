import type { PropsWithChildren } from 'react';

/** Figma Settings section label: 10px uppercase, wide tracking. */
export function SectionTitle({ children }: PropsWithChildren) {
  return (
    <h2 className="mb-4 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
      {children}
    </h2>
  );
}
