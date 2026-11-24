import { describe, expect, it } from 'vitest';
import { MENU_WIDTH, panelPlace } from './panel-place';

describe('panelPlace', () => {
  it('opens under the trigger when the menu fits to its right', () => {
    expect(panelPlace(100, 1280)).toEqual({ left: 0, width: MENU_WIDTH });
  });

  it('moves back left when the trigger is near the right edge', () => {
    // 1280 - 8 - 288 = 984: the menu's left edge, 216 px left of the trigger.
    expect(panelPlace(1200, 1280)).toEqual({ left: -216, width: MENU_WIDTH });
  });

  it('never starts past the left edge', () => {
    expect(panelPlace(2, 1280)).toEqual({ left: 6, width: MENU_WIDTH });
  });

  it('narrows to the screen on a phone too small for it', () => {
    expect(panelPlace(150, 280)).toEqual({ left: -142, width: 264 });
  });
});
