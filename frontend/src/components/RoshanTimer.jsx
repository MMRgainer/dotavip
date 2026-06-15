import { useState, useEffect } from 'react';
import { useOverlayStore } from '../store/overlayStore';

const MIN_RESPAWN = 480; // 8 min
const MAX_RESPAWN = 660; // 11 min

function fmt(s) {
  if (s == null) return '--:--';
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.floor(Math.max(0, s) % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function Arc({ pct, color, size = 90 }) {
  const r = 34, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={7} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.min(Math.max(pct, 0), 1))}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s linear' }}
      />
    </svg>
  );
}

export default function RoshanTimer({ onKill, onReset }) {
  const { roshan } = useOverlayStore();
  const [, setTick] = useState(0);

  // Re-render every 500 ms so the display updates smoothly
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const elapsed = roshan.killedAt ? (Date.now() - roshan.killedAt) / 1000 : null;
  const minRemaining = elapsed != null ? Math.max(0, MIN_RESPAWN - elapsed) : null;
  const maxRemaining = elapsed != null ? Math.max(0, MAX_RESPAWN - elapsed) : null;
  const pct = elapsed != null ? elapsed / MAX_RESPAWN : 0;

  let state = roshan.state;
  if (elapsed != null) {
    if (elapsed >= MAX_RESPAWN) state = 'alive';
    else if (elapsed >= MIN_RESPAWN) state = 'maybe_alive';
    else state = 'dead';
  }

  const meta = {
    alive:       { label: 'ALIVE',  color: '#22c55e', bg: 'rgba(34,197,94,0.07)'  },
    dead:        { label: 'DEAD',   color: '#ef4444', bg: 'rgba(239,68,68,0.07)'  },
    maybe_alive: { label: 'MAYBE',  color: '#f59e0b', bg: 'rgba(245,158,11,0.07)' },
  }[state] ?? { label: 'ALIVE', color: '#22c55e', bg: 'transparent' };

  return (
    <div className="panel" style={{ background: meta.bg, borderColor: meta.color + '44' }}>
      <h2 className="panel-title" style={{ color: meta.color }}>⚔ Roshan</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ position: 'relative', width: 90, height: 90 }}>
          <Arc pct={pct} color={meta.color} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: '0.06em' }}>
              {meta.label}
            </span>
            {elapsed != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                {fmt(elapsed)}
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {state === 'alive' && elapsed == null && (
            <p style={{ color: '#475569', fontSize: 13 }}>No kill recorded yet</p>
          )}
          {state === 'alive' && elapsed != null && (
            <p style={{ color: '#22c55e', fontSize: 14, fontWeight: 700 }}>✓ Guaranteed alive</p>
          )}
          {state !== 'alive' && elapsed != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#f59e0b', letterSpacing: '0.07em' }}>MIN SPAWN IN</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: minRemaining === 0 ? '#4ade80' : '#fbbf24' }}>
                  {minRemaining === 0 ? '✓ WINDOW OPEN' : fmt(minRemaining)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#22c55e', letterSpacing: '0.07em' }}>MAX SPAWN IN</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: maxRemaining === 0 ? '#4ade80' : '#86efac' }}>
                  {maxRemaining === 0 ? '✓ ALIVE NOW' : fmt(maxRemaining)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-danger" onClick={onKill}>Roshan Killed</button>
        <button className="btn btn-secondary" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}
