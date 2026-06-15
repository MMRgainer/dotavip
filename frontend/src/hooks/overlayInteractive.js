/**
 * Tracks whether the mouse is currently over an interactive overlay widget
 * (a button row, a dropdown menu, etc). Used by the click-to-close logic: when
 * the backend reports a global click, we only close the dropdown if the cursor
 * is NOT over our own UI — i.e. the click landed in the game, not on the menu.
 *
 * A counter (not a boolean) so overlapping enter/leave from adjacent widgets
 * never leaves it stuck.
 */
let count = 0;

export const overlayInteractive = {
  enter() { count++; },
  leave() { count = Math.max(0, count - 1); },
  active() { return count > 0; },
};
