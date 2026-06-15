/**
 * Shared lock so that while an element is being dragged, the overlay keeps
 * receiving mouse events (ignoreMouse stays false) even if the cursor
 * temporarily leaves the element. Without this, a drag stops the moment the
 * cursor exits the small panel — making far/edge positions unreachable.
 */
let locked = false;

export const mouseLock = {
  set: (v) => { locked = v; },
  get: () => locked,
};
