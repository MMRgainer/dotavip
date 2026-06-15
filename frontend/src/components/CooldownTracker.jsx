import { useState, useEffect, useCallback } from 'react';
import { useOverlayStore } from '../store/overlayStore';

const API = 'http://127.0.0.1:8765';
const SLOT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

// ── Live countdown bar ────────────────────────────────────────────────────────

function CooldownBar({ cd, onExpire }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = (Date.now() - cd.startedAt) / 1000;
  const remaining = Math.max(0, cd.duration - elapsed);
  const pct = cd.duration > 0 ? (remaining / cd.duration) * 100 : 0;

  useEffect(() => {
    if (remaining === 0) {
      const t = setTimeout(onExpire, 500); // short delay before removing
      return () => clearTimeout(t);
    }
  }, [remaining === 0]);

  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const label = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${Math.ceil(remaining)}s`;
  const barColor = pct > 60 ? '#ef4444' : pct > 25 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{
      padding: '7px 10px', borderRadius: 7,
      background: '#0f172a',
      border: `1px solid ${SLOT_COLORS[cd.player_slot]}33`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
        <span style={{ fontSize: 12, color: SLOT_COLORS[cd.player_slot], fontWeight: 700, whiteSpace: 'nowrap' }}>
          E{cd.player_slot + 1} · {cd.heroDisplay}
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cd.abilityDisplay}
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, color: barColor, minWidth: 38, textAlign: 'right', flexShrink: 0 }}>
          {label}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: '#1e293b' }}>
        <div style={{
          height: '100%', borderRadius: 3, width: `${pct}%`,
          background: barColor,
          transition: 'width 0.22s linear, background 0.3s',
        }} />
      </div>
    </div>
  );
}


// ── Slot row (picker for one enemy) ──────────────────────────────────────────

function SlotRow({ slot, onTrigger }) {
  const { heroList, abilityMap, setAbilities, enemyHeroes, setEnemyHero } = useOverlayStore();
  const [ability, setAbility] = useState('');
  const [level, setLevel]     = useState(1);

  const hero = enemyHeroes[slot] ?? '';

  useEffect(() => {
    setAbility(''); setLevel(1);
    if (!hero || abilityMap[hero]) return;
    fetch(`${API}/heroes/${hero}/abilities`)
      .then(r => r.json())
      .then(d => setAbilities(hero, d.abilities))
      .catch(() => {});
  }, [hero]);

  const abilities  = hero ? (abilityMap[hero] ?? []) : [];
  const selectedAb = abilities.find(a => a.name === ability);
  const maxLevel   = selectedAb?.max_level ?? 4;
  const cdPreview  = selectedAb
    ? selectedAb.cooldowns[Math.min(level - 1, selectedAb.cooldowns.length - 1)]
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
      padding: '5px 0', borderBottom: '1px solid #1e293b',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: SLOT_COLORS[slot], flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: '#64748b', width: 48, flexShrink: 0 }}>E{slot + 1}</span>

      <select className="select" value={hero} onChange={e => setEnemyHero(slot, e.target.value)}
        style={{ flex: '1 1 110px', minWidth: 0 }}>
        <option value="">— Hero —</option>
        {heroList.map(h => <option key={h.key} value={h.key}>{h.display_name}</option>)}
      </select>

      <select className="select" value={ability}
        onChange={e => { setAbility(e.target.value); setLevel(1); }}
        disabled={!hero} style={{ flex: '1 1 120px', minWidth: 0 }}>
        <option value="">— Ability —</option>
        {abilities.map(a => <option key={a.name} value={a.name}>{a.display_name}</option>)}
      </select>

      <select className="select" value={level} onChange={e => setLevel(Number(e.target.value))}
        disabled={!ability} style={{ width: 56, flexShrink: 0 }}>
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map(l =>
          <option key={l} value={l}>Lv{l}</option>
        )}
      </select>

      {cdPreview != null && (
        <span style={{ fontSize: 11, color: '#f59e0b', flexShrink: 0, minWidth: 34 }}>{cdPreview}s</span>
      )}

      <button className="btn btn-primary"
        onClick={() => onTrigger(slot, hero, ability, cdPreview ?? 0, level,
          heroList.find(h => h.key === hero)?.display_name ?? hero,
          selectedAb?.display_name ?? ability)}
        disabled={!hero || !ability || !cdPreview}
        style={{ flexShrink: 0 }}>
        Track
      </button>
    </div>
  );
}


// ── Main component ─────────────────────────────────────────────────────────────

export default function CooldownTracker({ onWsSend }) {
  const { cooldowns, addCooldown, pruneCooldowns, heroList, setHeroList } = useOverlayStore();

  // Prune expired every second
  useEffect(() => {
    const id = setInterval(pruneCooldowns, 1000);
    return () => clearInterval(id);
  }, [pruneCooldowns]);

  // Load hero list once
  useEffect(() => {
    if (heroList.length) return;
    fetch(`${API}/heroes`)
      .then(r => r.json())
      .then(d => setHeroList(d.heroes))
      .catch(() => {});
  }, [heroList.length]);

  const handleTrigger = useCallback((slot, hero, ability, duration, level, heroDisplay, abilityDisplay) => {
    if (!hero || !ability || !duration) return;

    // Immediately start countdown client-side
    addCooldown({ hero, heroDisplay, ability, abilityDisplay, duration, player_slot: slot });

    // Also notify backend (for future multi-client sync)
    onWsSend({ type: 'cooldown_trigger', hero, ability, level, player_slot: slot });
  }, [addCooldown, onWsSend]);

  const handleExpire = useCallback((id) => {
    useOverlayStore.setState(s => ({
      cooldowns: s.cooldowns.filter(c => c.id !== id),
    }));
  }, []);

  return (
    <div className="panel">
      <h2 className="panel-title">
        ⏱ Skill Cooldowns
        {cooldowns.length > 0 && (
          <span style={{ marginLeft: 8, fontSize: 11, color: '#f59e0b', fontWeight: 400 }}>
            {cooldowns.length} active
          </span>
        )}
      </h2>

      {/* 5 enemy slots */}
      <div style={{ marginBottom: 10 }}>
        {[0, 1, 2, 3, 4].map(slot => (
          <SlotRow key={slot} slot={slot} onTrigger={handleTrigger} />
        ))}
      </div>

      {/* Active cooldown bars */}
      {cooldowns.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {cooldowns.map(cd => (
            <CooldownBar key={cd.id} cd={cd} onExpire={() => handleExpire(cd.id)} />
          ))}
        </div>
      ) : (
        <div style={{ color: '#334155', fontSize: 12, marginTop: 4 }}>No active cooldowns</div>
      )}
    </div>
  );
}
