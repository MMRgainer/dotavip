import { useOverlayStore } from '../store/overlayStore';

export default function StatusBar() {
  const connected = useOverlayStore(s => s.connected);
  const inGame    = useOverlayStore(s => s.inGame);
  const gameTime  = useOverlayStore(s => s.gameTime);
  const localHero = useOverlayStore(s => s.localHero);

  const mins = Math.floor(gameTime / 60);
  const secs = String(gameTime % 60).padStart(2, '0');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 16px',
      background: '#0d1117',
      borderBottom: '1px solid #1e293b',
      fontSize: 12,
    }}>
      <span style={{ color: '#334155', fontWeight: 700, letterSpacing: '.1em' }}>DOTA OVERLAY</span>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {inGame && (
          <>
            <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{mins}:{secs}</span>
            {localHero && <span style={{ color: '#475569' }}>{localHero.replace(/_/g, ' ')}</span>}
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', boxShadow: connected ? '0 0 6px #22c55e' : 'none' }} />
        <span style={{ color: connected ? '#22c55e' : '#ef4444' }}>{connected ? 'connected' : 'connecting…'}</span>
      </div>
    </div>
  );
}
