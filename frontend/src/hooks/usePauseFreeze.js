import { useEffect, useRef } from 'react';
import { useOverlayStore } from '../store/overlayStore';

/**
 * Freeze every timer while the game is paused.
 *
 * GSI reports `map.paused`. Timers count down off wall-clock time
 * (`Date.now() - anchor`), so without this they keep ticking through a pause
 * and become wrong. While paused we advance every anchor by the real elapsed
 * time each tick, which holds the visible remaining time steady. On resume the
 * shifting stops and countdowns continue exactly where they left off.
 */
export function usePauseFreeze() {
  const paused       = useOverlayStore(s => s.paused);
  const shiftAnchors = useOverlayStore(s => s.shiftAnchors);
  const last = useRef(0);

  useEffect(() => {
    if (!paused) return;
    last.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - last.current;
      last.current = now;
      if (delta > 0) shiftAnchors(delta);
    }, 200);
    return () => clearInterval(id);
  }, [paused, shiftAnchors]);
}
