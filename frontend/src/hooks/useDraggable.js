import { useState, useRef, useCallback, useEffect } from 'react';
import { mouseLock } from './mouseLock';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

/**
 * Makes an overlay element draggable and persists its position.
 *
 * Reposition mode: hold Ctrl and drag to move. A normal click passes through
 * to the element's own handlers (so clicking the Roshan icon still works).
 *
 * @param {string} id        unique key for localStorage
 * @param {{x:number,y:number}} fallback  default position (from measurements)
 * @returns { pos, dragProps, repositioning }
 */
export function useDraggable(id, fallback) {
  const storeKey = `overlay_pos_${id}`;

  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return fallback;
  });

  // If fallback changes (resolution change) and we have no saved pos, follow it
  const savedRef = useRef(!!localStorage.getItem(storeKey));
  useEffect(() => {
    if (!savedRef.current) setPos(fallback);
  }, [fallback.x, fallback.y]);

  const drag = useRef(null);
  const [repositioning, setRepositioning] = useState(false);

  const onMouseDown = useCallback((e) => {
    if (!e.ctrlKey) return;           // only Ctrl+drag repositions
    e.preventDefault();
    e.stopPropagation();
    drag.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    setRepositioning(true);
    // Keep the overlay interactive for the whole drag (survives cursor leaving panel)
    mouseLock.set(true);
    if (isElectron) window.electronAPI.setIgnoreMouse(false);

    const onMove = (ev) => {
      if (!drag.current) return;
      const nx = drag.current.origX + (ev.clientX - drag.current.startX);
      const ny = drag.current.origY + (ev.clientY - drag.current.startY);
      setPos({ x: Math.max(0, nx), y: Math.max(0, ny) });
    };
    const onUp = () => {
      if (drag.current) {
        setPos(p => {
          try { localStorage.setItem(storeKey, JSON.stringify(p)); } catch {}
          savedRef.current = true;
          return p;
        });
      }
      drag.current = null;
      setRepositioning(false);
      mouseLock.set(false);
      if (isElectron) window.electronAPI.setIgnoreMouse(true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos.x, pos.y, storeKey]);

  return {
    pos,
    repositioning,
    dragProps: { onMouseDown },
  };
}
