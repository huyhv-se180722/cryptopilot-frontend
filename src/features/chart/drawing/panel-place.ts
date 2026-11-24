/** The copy menu's width when the screen has room for it. */
export const MENU_WIDTH = 288;
/** The space kept between the menu and the edge of the screen. */
const EDGE = 8;

/**
 * Where the copy menu sits under its trigger: its left offset from the
 * trigger and its width, so that it stays on a screen `viewport` px wide when
 * the trigger starts at `triggerLeft`. It starts under the trigger's left
 * edge, moves back inside past either side, and narrows on a screen too small
 * to hold it.
 */
export function panelPlace(
  triggerLeft: number,
  viewport: number,
): { left: number; width: number } {
  const width = Math.max(0, Math.min(MENU_WIDTH, viewport - 2 * EDGE));
  const left = Math.min(Math.max(triggerLeft, EDGE), viewport - EDGE - width);
  return { left: left - triggerLeft, width };
}
