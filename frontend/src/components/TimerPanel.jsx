import { useEffect, useState } from 'react';
import { useOverlayStore } from '../store/overlayStore';

const SLOT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6'];

function TimerRow({ timer, onRemove }) {
  const elapsed   = (Date.now() - timer.startedAt) / 1000;
  const remaining = Math.max(0, timer.duration - elapsed);
  const pct       = remaining / timer.duration;
  const color     = SLOT_COLORS[timer.slot] ?? '#64748b';
  const mins      = Math.floor(remaining / 60);
  const secs      = Math.floor(remaining % 60);
  const timeStr   = mins > 0 ? `${mins}:${String(secs).padStart(2,'0')}` : `${secs}s`;
  const isDone    = remaining <= 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 10px',
      background: '#111827',
      borderRadius: 8,
      border: `1px solid ${isDone ? '#1e293b' : color + '55'}`,
      opacity: isDone ? 0.45 : 1,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#0f172a', border: `1px solid ${color}44` }}>
        <img src={timer.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.opacity = '.15'; }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timer.label}</span>
          <span style={{ fontSize: 9, color, fontWeight: 700, flexShrink: 0 }}>{timer.type === 'bb' ? 'BB' : 'CD'}</span>
        </div>
        <div style={{ height: 4, background: '#1e293b', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 2, transition: 'width .25s linear' }} />
        </div>
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, color: isDone ? '#334155' : color, fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right' }}>
        {isDone ? '✓' : timeStr}
      </div>

      <button
        onClick={() => onRemove(timer.id)}
        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
        title="Remove"
      >×</button>
    </div>
  );
}

export default function TimerPanel() {
  const timers      = useOverlayStore(s => s.timers);
  const pruneTimers = useOverlayStore(s => s.pruneTimers);
  const removeTimer = useOverlayStore(s => s.removeTimer);
  const [, tick]    = useState(0);

  // Tick every 1000ms for live countdown (1s resolution is fine, reduces renders)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Prune finished timers every second
  useEffect(() => {
    const id = setInterval(pruneTimers, 1000);
    return () => clearInterval(id);
  }, [pruneTimers]);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const overlayStyle = isElectron ? {
    position: 'fixed', right: 20, bottom: 20,
    width: 260, maxHeight: 300, overflowY: 'auto',
    zIndex: 50, pointerEvents: 'all',
  } : {};

  if (!timers.length) {
    if (isElectron) return null; // Don't show empty panel in overlay mode
    return (
      <div style={{
        background: '#0d1117', border: '1px solid #1e293b',
        borderRadius: 10, padding: '14px 16px',
        color: '#334155', fontSize: 12, textAlign: 'center',
      }}>
        No active timers — click BB or Ult buttons to track
      </div>
    );
  }

  return (
    <div style={{
      background: '#0a0f1acc', backdropFilter: 'blur(8px)',
      border: '1px solid #1e293b88',
      borderRadius: 10, padding: '12px 16px',
      ...overlayStyle,
    }}>
      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', marginBottom: 8 }}>
        TIMERS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {timers.map(t => (
          <TimerRow key={t.id} timer={t} onRemove={removeTimer} />
        ))}
      </div>
    </div>
  );
}
