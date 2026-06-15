/**
 * In Electron overlay mode:
 * - Default: mouse events pass through (game receives clicks)
 * - When hovering over interactive elements: overlay receives clicks
 *
 * Usage: attach onMouseEnter/onMouseLeave to any interactive container.
 */

import { mouseLock } from './mouseLock';
import { overlayInteractive } from './overlayInteractive';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export function useMouseThrough() {
  const enter = () => {
    overlayInteractive.enter();           // cursor is over our UI now
    if (isElectron) window.electronAPI.setIgnoreMouse(false);
  };
  const leave = () => {
    overlayInteractive.leave();
    // Don't re-enable pass-through while a drag is in progress, otherwise the
    // drag stops the moment the cursor leaves the panel.
    if (isElectron && !mouseLock.get()) window.electronAPI.setIgnoreMouse(true);
  };

  return { onMouseEnter: enter, onMouseLeave: leave };
}
