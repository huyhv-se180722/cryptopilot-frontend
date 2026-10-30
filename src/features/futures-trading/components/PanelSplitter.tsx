import { moved, SPLIT, type SplitLayout } from '../model/split-layout';

/**
 * The bar between the chart above and the positions and orders below, as
 * the exchange's: it follows the pointer, so dragged up the chart gets
 * shorter and the panel taller by the same amount, and dragged down the
 * other way. The arrow keys move it by 20 px.
 */
export function PanelSplitter({
  layout,
  onChange,
  label,
}: {
  layout: SplitLayout;
  onChange: (layout: SplitLayout) => void;
  label: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuemin={SPLIT.panel.min}
      aria-valuemax={SPLIT.panel.max}
      aria-valuenow={layout.panel}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onChange(moved(layout, 20));
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onChange(moved(layout, -20));
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        const startY = event.clientY;
        const start = layout;
        const move = (pointer: PointerEvent) =>
          onChange(moved(start, startY - pointer.clientY));
        const stop = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', stop);
          document.body.style.removeProperty('user-select');
          document.body.style.removeProperty('cursor');
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'row-resize';
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
      }}
      className="group hidden h-3 cursor-row-resize touch-none items-center justify-center focus:outline-none xl:flex"
    >
      <span className="h-1 w-16 rounded-full bg-line transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
    </div>
  );
}
