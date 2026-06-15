/**
 * Enemy Panel — 5 hero cards with BB + Ult quick buttons.
 * Hover any hero → full ability list.
 * Click ability or Ult button → configure level/modifiers → start timer.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useOverlayStore } from '../store/overlayStore';

const CDN_HERO    = h => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${h}.png`;
const CDN_ABILITY = a => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${a}.png`;

const SLOT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6'];
const BB_DURATION = 480; // 8 min

// CD modifiers
const OCTARINE_MULT = 0.75; // -25%

function calcCd(base, octarine) {
  return Math.round(octarine ? base * OCTARINE_MULT : base);
}

// ── Ult Config Popup ──────────────────────────────────────────────────────────
function UltPopup({ heroKey, ability, slot, onStart, onClose }) {
  const [level,   setLevel]   = useState(ability.max_level ?? ability.cooldowns?.length ?? 3);
  const [octarine,setOctarine]= useState(false);

  const baseCd  = ability.cooldowns?.[level - 1] ?? ability.cooldowns?.[0] ?? 60;
  const finalCd = calcCd(baseCd, octarine);
  const maxLvl  = ability.max_level ?? ability.cooldowns?.length ?? 3;
  const color   = SLOT_COLORS[slot];

  const handleStart = () => {
    onStart({
      type:     'ult',
      slot,
      heroKey,
      label:    ability.display_name,
      icon:     CDN_ABILITY(ability.name),
      duration: finalCd,
    });
    onClose();
  };

  return (
    <div style={{
      background: '#0f172a', border: `1px solid ${color}`,
      borderRadius: 10, padding: 12, minWidth: 200,
      boxShadow: '0 8px 32px rgba(0,0,0,.8)',
    }}>
      {/* Ability header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <img src={CDN_ABILITY(ability.name)} alt="" style={{ width: 36, height: 36, borderRadius: 4 }} onError={e => e.target.style.opacity='.2'} />
        <div>
          <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{ability.display_name}</div>
          <div style={{ color: '#64748b', fontSize: 10 }}>Ultimate · {finalCd}s cooldown</div>
        </div>
      </div>

      {/* Level selector */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: '#475569', fontSize: 10, marginBottom: 5 }}>LEVEL</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: maxLvl }, (_, i) => i + 1).map(lvl => (
            <button key={lvl} onClick={() => setLevel(lvl)} style={{
              flex: 1, padding: '5px 0',
              background: level === lvl ? color : '#1e293b',
              color: level === lvl ? '#fff' : '#64748b',
              border: `1px solid ${level === lvl ? color : '#334155'}`,
              borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            }}>
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Modifiers */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#475569', fontSize: 10, marginBottom: 5 }}>MODIFIERS</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setOctarine(v => !v)} style={{
            flex: 1, padding: '5px 0', fontSize: 10,
            background: octarine ? '#0891b2' : '#1e293b',
            color: octarine ? '#fff' : '#64748b',
            border: `1px solid ${octarine ? '#0891b2' : '#334155'}`,
            borderRadius: 6, cursor: 'pointer',
          }}>
            💎 Octarine<br/><span style={{ fontSize: 9 }}>-25% CD</span>
          </button>
        </div>
      </div>

      {/* CD preview */}
      <div style={{ textAlign: 'center', marginBottom: 10, color: color, fontSize: 18, fontWeight: 700 }}>
        ⏱ {finalCd}s
        {octarine && <span style={{ color: '#64748b', fontSize: 11, marginLeft: 6 }}>({baseCd}s base)</span>}
      </div>

      {/* Start button */}
      <button onClick={handleStart} style={{
        width: '100%', padding: '8px 0',
        background: color, color: '#fff',
        border: 'none', borderRadius: 8, cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
      }}>
        Start Timer
      </button>
    </div>
  );
}

// ── Ability hover popup ───────────────────────────────────────────────────────
function AbilityPopup({ heroKey, slot, onStartTimer, onClose }) {
  const abilityMap   = useOverlayStore(s => s.abilityMap);
  const setAbilities = useOverlayStore(s => s.setAbilities);
  const abilities    = abilityMap[heroKey] || [];
  const [ultCfg, setUltCfg] = useState(null); // ability being configured

  useEffect(() => {
    if (!heroKey || abilities.length) return;
    fetch(`/api/heroes/${heroKey}/abilities`)
      .then(r => r.json())
      .then(d => { if (d.abilities) setAbilities(heroKey, d.abilities); })
      .catch(() => {});
  }, [heroKey]);

  const handleAbilityClick = useCallback((ab) => {
    const isUlt = ab === abilities[abilities.length - 1];
    if (isUlt) {
      setUltCfg(ab);
    } else {
      const cd = ab.cooldowns?.[ab.cooldowns.length - 1] ?? 30;
      onStartTimer({ type: 'cd', slot, heroKey, label: ab.display_name, icon: CDN_ABILITY(ab.name), duration: cd });
      onClose();
    }
  }, [abilities, slot, heroKey, onStartTimer, onClose]);

  if (ultCfg) {
    return (
      <UltPopup
        heroKey={heroKey}
        ability={ultCfg}
        slot={slot}
        onStart={onStartTimer}
        onClose={onClose}
      />
    );
  }

  if (!abilities.length) return <div style={{ padding: 8, color: '#64748b', fontSize: 11 }}>Loading…</div>;

  const color = SLOT_COLORS[slot];
  return (
    <div style={{
      background: '#0f172a', border: `1px solid ${color}`,
      borderRadius: 8, padding: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,.7)',
    }}>
      <div style={{ color: '#475569', fontSize: 9, marginBottom: 6, letterSpacing: '.05em' }}>ABILITIES</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {abilities.filter(a => !a.passive && (a.cooldowns?.length ?? 0) > 0).map((ab, i) => {
          const isUlt = i === abilities.filter(a => !a.passive && (a.cooldowns?.length ?? 0) > 0).length - 1;
          return (
            <div key={ab.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <button
                title={`${ab.display_name} (${ab.cooldowns?.slice(-1)[0]}s)`}
                onClick={() => handleAbilityClick(ab)}
                style={{
                  width: 44, height: 44, padding: 0, border: 'none',
                  borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                  outline: isUlt ? `2px solid ${color}` : '1px solid #334155',
                  background: '#1e293b',
                }}
              >
                <img src={CDN_ABILITY(ab.name)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.opacity='.2'} />
              </button>
              {isUlt && <span style={{ fontSize: 8, color, fontWeight: 700 }}>ULT</span>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: '#475569', textAlign: 'center', marginTop: 6 }}>click → start timer · ult → configure</div>
    </div>
  );
}

// ── Hero Card ─────────────────────────────────────────────────────────────────
function HeroCard({ slot, heroKey }) {
  const [popup, setPopup] = useState(null); // null | 'abilities' | 'ult'
  const startTimer = useOverlayStore(s => s.startTimer);
  const heroList   = useOverlayStore(s => s.heroList);
  const abilityMap = useOverlayStore(s => s.abilityMap);
  const setAbilities = useOverlayStore(s => s.setAbilities);
  const ref    = useRef();
  const color  = SLOT_COLORS[slot];
  const isEmpty = !heroKey;
  const displayName = heroList.find(h => h.key === heroKey)?.display_name || heroKey?.replace(/_/g, ' ') || '';

  // Pre-fetch abilities when hero is set
  useEffect(() => {
    if (!heroKey || abilityMap[heroKey]) return;
    fetch(`/api/heroes/${heroKey}/abilities`)
      .then(r => r.json())
      .then(d => { if (d.abilities) setAbilities(heroKey, d.abilities); })
      .catch(() => {});
  }, [heroKey]);

  // Close on outside click
  useEffect(() => {
    if (!popup) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setPopup(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [popup]);

  const handleBB = (e) => {
    e.stopPropagation();
    if (!heroKey) return;
    startTimer({ type: 'bb', slot, heroKey, label: `${displayName}`, icon: CDN_HERO(heroKey), duration: BB_DURATION });
  };

  const handleUlt = (e) => {
    e.stopPropagation();
    if (!heroKey) return;
    setPopup(p => p === 'ult' ? null : 'ult');
  };

  const handlePortraitClick = () => {
    if (!heroKey) return;
    setPopup(p => p === 'abilities' ? null : 'abilities');
  };

  const getUltAbility = () => {
    const abs = abilityMap[heroKey] || [];
    const active = abs.filter(a => !a.passive && (a.cooldowns?.length ?? 0) > 0);
    return active[active.length - 1] || null;
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 96 }}>
      {/* Portrait */}
      <div
        onClick={handlePortraitClick}
        style={{
          width: 96, height: 68,
          borderRadius: 8,
          border: `2px solid ${isEmpty ? '#1e293b' : (popup ? color : color + '88')}`,
          overflow: 'hidden',
          background: '#0f172a',
          cursor: isEmpty ? 'default' : 'pointer',
          transition: 'border-color .15s, box-shadow .15s',
          boxShadow: popup ? `0 0 14px ${color}55` : 'none',
          flexShrink: 0,
        }}
        title={isEmpty ? '' : 'Click → abilities'}
      >
        {!isEmpty ? (
          <img src={CDN_HERO(heroKey)} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} onError={e => e.target.style.display='none'} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', fontSize: 28 }}>?</div>
        )}
      </div>

      {/* Name */}
      <div style={{ fontSize: 10, color: isEmpty ? '#1e293b' : '#94a3b8', maxWidth: 96, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isEmpty ? `E${slot+1}` : displayName}
      </div>

      {/* BB + Ult buttons */}
      <div style={{ display: 'flex', gap: 4, width: '100%' }}>
        <button
          onClick={handleBB}
          disabled={isEmpty}
          title="Buyback timer (8 min)"
          style={{
            flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 700,
            background: isEmpty ? '#0f172a' : '#1e293b',
            color: isEmpty ? '#1e293b' : '#94a3b8',
            border: `1px solid ${isEmpty ? '#1e293b' : '#334155'}`,
            borderRadius: 5, cursor: isEmpty ? 'default' : 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={e => { if (!isEmpty) { e.currentTarget.style.background = '#ef444422'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}}
          onMouseLeave={e => { if (!isEmpty) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; }}}
        >
          BB
        </button>
        <button
          onClick={handleUlt}
          disabled={isEmpty}
          title="Ultimate cooldown timer"
          style={{
            flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 700,
            background: popup === 'ult' ? color + '33' : (isEmpty ? '#0f172a' : '#1e293b'),
            color: popup === 'ult' ? color : (isEmpty ? '#1e293b' : '#94a3b8'),
            border: `1px solid ${popup === 'ult' ? color : (isEmpty ? '#1e293b' : '#334155')}`,
            borderRadius: 5, cursor: isEmpty ? 'default' : 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={e => { if (!isEmpty) { e.currentTarget.style.background = color + '22'; e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}}
          onMouseLeave={e => { if (popup !== 'ult' && !isEmpty) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8'; }}}
        >
          ULT
        </button>
      </div>

      {/* Popups */}
      {popup && !isEmpty && (
        <div style={{ position: 'absolute', top: '105%', left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
          {popup === 'abilities' && (
            <AbilityPopup
              heroKey={heroKey}
              slot={slot}
              onStartTimer={startTimer}
              onClose={() => setPopup(null)}
            />
          )}
          {popup === 'ult' && (() => {
            const ult = getUltAbility();
            return ult ? (
              <UltPopup
                heroKey={heroKey}
                ability={ult}
                slot={slot}
                onStart={startTimer}
                onClose={() => setPopup(null)}
              />
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function EnemyPanel() {
  const enemyHeroes = useOverlayStore(s => s.enemyHeroes);
  const inGame      = useOverlayStore(s => s.inGame);

  return (
    <div style={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700, letterSpacing: '.08em' }}>⚔ ENEMIES</span>
        {!inGame && <span style={{ fontSize: 10, color: '#334155' }}>waiting for game…</span>}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {enemyHeroes.map((heroKey, i) => (
          <HeroCard key={i} slot={i} heroKey={heroKey} />
        ))}
      </div>
    </div>
  );
}
