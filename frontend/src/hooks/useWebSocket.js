import { useEffect, useRef, useCallback } from 'react';
import { useOverlayStore } from '../store/overlayStore';
import { overlayInteractive } from './overlayInteractive';

const WS_URL = 'ws://127.0.0.1:8765/ws';

export function useWebSocket() {
  const wsRef        = useRef(null);
  const retryRef     = useRef(null);
  const setConnected = useOverlayStore(s => s.setConnected);
  const applyState   = useOverlayStore(s => s.applyState);
  const setHeroList  = useOverlayStore(s => s.setHeroList);
  const openMenuSlot = useOverlayStore(s => s.openMenuSlot);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Fetch hero list once on connect
      fetch('/api/heroes')
        .then(r => r.json())
        .then(d => { if (d.heroes) setHeroList(d.heroes); })
        .catch(() => {});
    };

    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'state') applyState(msg.data);
        else if (msg.type === 'click') {
          // Player clicked somewhere. Close the dropdown UNLESS the cursor is
          // over our own menu (then the click is meant for the menu itself).
          const st = useOverlayStore.getState();
          if (st.openMenuSlot != null && !overlayInteractive.active()) st.closeMenu();
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      retryRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();
  }, [setConnected, applyState, setHeroList]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Tell the backend when a menu opens/closes so its mouse hook only forwards
  // clicks while a menu is actually open (no chatter otherwise).
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'menu_state', open: openMenuSlot != null }));
    }
  }, [openMenuSlot]);

  const send = useCallback(msg => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send };
}
