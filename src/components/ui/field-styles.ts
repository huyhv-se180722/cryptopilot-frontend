/** Shared Figma form-field geometry (Login inputs: 8px radius, 10/14 padding). */
export const fieldLabelClass = 'mb-1.5 block text-xs font-medium text-fg-2';
export const fieldControlClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-muted-x focus-visible:border-primary focus-visible:outline-none aria-[invalid=true]:border-negative disabled:cursor-not-allowed disabled:opacity-60';
export const fieldErrorClass = 'mt-1 block text-[11px] text-negative';
export const fieldHintClass = 'mt-1 block text-[11px] text-muted-dim';
/**
 * Inline field of a dense panel (an exchange's order form): the label at
 * the left inside a 36px box, the value at the right.
 */
export const fieldInlineBoxClass =
  'flex h-9 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 focus-within:border-primary has-[[aria-invalid=true]]:border-negative has-disabled:opacity-60';
export const fieldInlineLabelClass =
  'shrink-0 text-xs whitespace-nowrap text-muted';
export const fieldInlineControlClass =
  'h-full min-w-0 flex-1 bg-transparent text-right text-sm text-fg outline-none placeholder:text-muted-x focus-visible:outline-none disabled:cursor-not-allowed';
