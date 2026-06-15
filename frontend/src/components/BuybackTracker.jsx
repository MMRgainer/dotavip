/**
 * Enemy Buyback Tracker.
 *
 * Displays 5 enemy player slots with a buyback available/unavailable indicator.
 * Data comes from the backend's OpenCV scoreboard detection.
 */

import { useOverlayStore } from '../store/overlayStore';

const SLOT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

function BuybackSlot({ slot, available }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 10px',
      borderRadius: 6,
      background: available ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.07)',
      border: `1px solid ${available ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
    }}>
      {/* Coloured player dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: SLOT_COLORS[slot],
        flexShrink: 0,
      }} />

      <span style={{ fontSize: 13, color: '#cbd5e1', flex: 1 }}>
        Enemy {slot + 1}
      </span>

      <span style={{
        fontSize: 11, fontWeight: 700,
        color: available ? '#22c55e' : '#ef4444',
        letterSpacing: '0.05em',
      }}>
        {available ? '✓ BB' : '✗ NO BB'}
      </span>

      {/* Visual coin icon — simple emoji fallback until real asset added */}
      <span style={{ fontSize: 14, opacity: available ? 1 : 0.3 }}>🪙</span>
    </div>
  );
}

export default function BuybackTracker() {
  const { buyback } = useOverlayStore();

  const availableCount = buyback.filter(Boolean).length;

  return (
    <div className="panel">
      <h2 className="panel-title">
        🪙 Buyback
        <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>
          {availableCount}/5 available
        </span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {buyback.map((available, i) => (
          <BuybackSlot key={i} slot={i} available={available} />
        ))}
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#475569' }}>
        Auto-detected from scoreboard (Tab screen)
      </div>
    </div>
  );
}
