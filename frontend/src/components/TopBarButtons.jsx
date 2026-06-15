/**
 * BB + Ult buttons under each enemy hero portrait — DotaCoach style.
 *
 * When activated, the button itself becomes the countdown (the word "Викуп"
 * is replaced by a small mm:ss timer in the same spot). No separate timer list.
 */

import { useState, useEffect, useRef } from 'react';
import { useOverlayStore } from '../store/overlayStore';
import { useMouseThrough } from '../hooks/useMouseThrough';
import { useDraggable } from '../hooks/useDraggable';
import { enemyHeroSlotsX, topbarButtonGeometry } from '../overlay/measurements';
import { useT } from '../i18n';
import { pub } from '../pub';
import UltPopup from './UltPopup';

const BB_DURATION  = 480; // 8 min
const BKB_DURATION = 95;  // Black King Bar cooldown is always 95s
const CDN_HERO    = h => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${h}.png`;
const CDN_ABILITY = a => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${a}.png`;
const BKB_ICON    = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/black_king_bar.png';

function fmt(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set(n => n+1), 1000); return () => clearInterval(id); }, []);
}

// ── Hero picker (manual hero assignment / change at any moment) ──────────────
// Shows ALL heroes from the DB (127) in a scrollable grid; search filters.
function HeroPicker({ onPick }) {
  const t = useT();
  const heroList = useOverlayStore(s => s.heroList);
  const [q, setQ] = useState('');
  const filtered = heroList.filter(h => h.display_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ background:'#0a0f1a', border:'1px solid #334155', borderRadius:10, padding:10, width:220,
      boxShadow:'0 8px 32px rgba(0,0,0,.9)' }}>
      <div style={{ color:'#94a3b8', fontSize:11, marginBottom:6, fontWeight:700 }}>{t('who_is')}</div>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('search_hero')}
        style={{ width:'100%', padding:'6px 8px', marginBottom:8, background:'#1e293b',
          border:'1px solid #334155', borderRadius:6, color:'#e2e8f0', fontSize:12, outline:'none', boxSizing:'border-box' }} />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4, maxHeight:230, overflowY:'auto' }}>
        {filtered.map(h => (
          <img key={h.key} src={CDN_HERO(h.key)} alt={h.display_name} title={h.display_name}
            onClick={() => onPick(h.key)}
            style={{ width:'100%', aspectRatio:'1.4', objectFit:'cover', borderRadius:4, cursor:'pointer', border:'1px solid #334155' }}
            onError={e => { e.target.style.opacity='.2'; }} />
        ))}
      </div>
      {!filtered.length && <div style={{ color:'#475569', fontSize:11, textAlign:'center', padding:'8px 0' }}>—</div>}
    </div>
  );
}

// ── Per-slot button options (УЛЬТ / БКБ toggles) — lives at the top of the
// ULT dropdown so it's reachable even when both buttons are turned off. ───────
function SlotOptions({ slot, heroKey, onChangeHero }) {
  const t = useT();
  const opts      = useOverlayStore(s => s.enemyOpts[slot]);
  const toggleOpt = useOverlayStore(s => s.toggleEnemyOpt);

  const pill = (on, label, color, onClick, tip) => (
    <button onClick={onClick} title={tip} style={{
      flex:1, padding:'7px 4px', fontSize:12, fontWeight:800, cursor:'pointer',
      borderRadius:7, border:`1px solid ${on ? color : '#334155'}`,
      background: on ? color + '33' : '#1e293b', color: on ? '#fff' : '#64748b',
    }}>{label}</button>
  );

  return (
    <div style={{ background:'#0a0f1a', border:'1px solid #334155', borderRadius:10,
      padding:10, width:200, boxShadow:'0 8px 32px rgba(0,0,0,.9)' }}>
      <div style={{ display:'flex', alignItems:'center', marginBottom:6 }}>
        <div style={{ color:'#94a3b8', fontSize:11, fontWeight:700, flex:1 }}>{t('opt_buttons')}</div>
        {heroKey && onChangeHero && (
          <button onClick={onChangeHero} title={t('change_hero')} style={{
            width:24, height:24, padding:0, background:'#1e293b', border:'1px solid #334155',
            borderRadius:6, color:'#94a3b8', fontSize:13, cursor:'pointer' }}>⇄</button>
        )}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {pill(opts.ult, t('ult'), '#7c3aed', () => toggleOpt(slot, 'ult'), t('tip_opt_ult'))}
        {pill(opts.bkb, t('bkb'), '#0891b2', () => toggleOpt(slot, 'bkb'), t('tip_opt_bkb'))}
      </div>
    </div>
  );
}

function HeroButtons({ slot, heroKey, cx, geo, buyY, ultY, dragProps }) {
  const t = useT();
  useTick();
  // Menu open-state lives in the store (one menu at a time; closable by a global
  // in-game click). `picking` (hero grid) stays local to this slot.
  const popup       = useOverlayStore(s => s.openMenuSlot === slot);
  const openMenu    = useOverlayStore(s => s.openMenu);
  const closeMenu   = useOverlayStore(s => s.closeMenu);
  const toggleMenu  = useOverlayStore(s => s.toggleMenu);
  const [picking, setPicking] = useState(false);   // hero-change grid inside the popup
  const timers        = useOverlayStore(s => s.timers);
  const startTimer    = useOverlayStore(s => s.startTimer);
  const removeTimer   = useOverlayStore(s => s.removeTimer);
  const abilityMap    = useOverlayStore(s => s.abilityMap);
  const setAbilities  = useOverlayStore(s => s.setAbilities);
  const setEnemyHeroManual = useOverlayStore(s => s.setEnemyHeroManual);
  const autoUltLevel  = useOverlayStore(s => s.enemyUltLevels[slot]) || 0;
  const mods          = useOverlayStore(s => s.enemyMods[slot]);
  const opts          = useOverlayStore(s => s.enemyOpts[slot]);
  const { onMouseEnter, onMouseLeave } = useMouseThrough();
  const ref = useRef();

  const abilities = heroKey ? (abilityMap[heroKey] || []) : [];

  useEffect(() => {
    if (!heroKey || abilityMap[heroKey]) return;
    fetch(`http://127.0.0.1:8765/heroes/${heroKey}/abilities`)
      .then(r => r.json()).then(d => { if (d.abilities) setAbilities(heroKey, d.abilities); })
      .catch(() => {});
  }, [heroKey]);

  // Close when clicking elsewhere ON THE OVERLAY (in-game clicks are handled by
  // the backend mouse hook → 'click' WS message).
  useEffect(() => {
    if (!popup) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { closeMenu(); setPicking(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [popup, closeMenu]);

  const getUlt = () => {
    const active = abilities.filter(a => !a.passive && (a.cooldowns?.length ?? 0) > 0);
    return active[active.length - 1] || null;
  };

  // Active timers for this slot
  const findTimer = (type) => {
    const t = timers.find(x => x.slot === slot && x.type === type);
    if (!t) return null;
    const remaining = t.duration - (Date.now() - t.startedAt) / 1000;
    return remaining > 0 ? { ...t, remaining } : null;
  };
  const bb  = findTimer('bb');
  const ult = findTimer('ult');
  const bkb = findTimer('bkb');

  const handleBB = () => {
    if (bb) { removeTimer(bb.id); return; }          // running → cancel
    startTimer({ type:'bb', slot, label:'Buyback',
      icon: heroKey ? CDN_HERO(heroKey) : pub('rosh/Aegis.png'), duration:BB_DURATION });
  };

  const handleBKB = () => {
    if (bkb) { removeTimer(bkb.id); return; }         // running → cancel
    // BKB cooldown is 95s, reduced 25% by Octarine Core if marked for this enemy
    const dur = mods?.octarine ? Math.round(BKB_DURATION * 0.75) : BKB_DURATION;
    startTimer({ type:'bkb', slot, label:'BKB', icon:BKB_ICON, duration:dur });
  };

  // Direct start (centre click): start ult timer with the auto/last level, no
  // modifiers. Arrow (▾) opens the popup for level + modifiers.
  const handleUltStart = () => {
    if (ult) { removeTimer(ult.id); return; }        // running → cancel
    if (!heroKey) { openMenu(slot); return; }         // unknown hero → picker
    const ab = getUlt();
    if (!ab) { openMenu(slot); return; }
    const maxLvl = ab.cooldowns?.length ?? 3;
    const lvl = Math.min(maxLvl, autoUltLevel > 0 ? autoUltLevel : 1);
    let cd = ab.cooldowns?.[lvl - 1] ?? ab.cooldowns?.[0] ?? 100;
    if (mods?.octarine) cd *= 0.75;   // Octarine Core -25%
    cd = Math.round(cd);
    startTimer({ type:'ult', slot, label: ab.display_name,
      icon: CDN_ABILITY(ab.name), duration: cd });
  };

  // Arrow always just opens/closes the dropdown (ult timer is cancelled by
  // clicking the running ult button, not the arrow).
  const handleUltArrow = () => { toggleMenu(slot); setPicking(false); };

  const left   = Math.round(cx - geo.buttonW / 2);
  const arrowW = Math.max(16, geo.rowH);

  // Optional rows fill the slots under Buyback in order: ULT then BKB. When ULT
  // is off, BKB moves up into ULT's place. The FIRST optional row carries the
  // dropdown arrow; if no optional row is shown, a standalone arrow stays put.
  const rows = [];
  if (opts.ult) rows.push('ult');
  if (opts.bkb) rows.push('bkb');
  const rowY = (i) => ultY + i * (geo.rowH + 2);
  const lastRowY = rows.length ? rowY(rows.length - 1) : ultY;
  const popupTop = lastRowY + geo.rowH + 4;

  // DotaCoach-style button: white text, thin white border, dark gradient bg
  // (stays readable over grass/any background). Active state = slightly more
  // opaque dark bg with a faint colour tint, text stays white.
  const btnBase = {
    position:'absolute', width:geo.buttonW, height:geo.rowH, left,
    fontSize:geo.fontSize, fontWeight:700,
    border:'1px solid rgba(255,255,255,.40)', borderRadius:4,
    cursor:'pointer', pointerEvents:'all', letterSpacing:'.02em',
    display:'flex', alignItems:'center', justifyContent:'center',
    background:'linear-gradient(180deg, rgba(24,29,35,.42) 0%, rgba(8,12,17,.42) 100%)',
    color:'#ffffff',
    textShadow:'0 1px 3px rgba(0,0,0,.95), 0 0 2px rgba(0,0,0,.9)',
    transition:'background .12s',
    fontVariantNumeric:'tabular-nums',
    boxSizing:'border-box',
  };

  const activeBg = (tint) =>
    `linear-gradient(180deg, ${tint} 0%, rgba(8,12,17,.75) 100%)`;

  return (
    <div ref={ref} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...dragProps}>
      {/* Buyback — becomes countdown when active */}
      <button onClick={handleBB} title={t('tip_buyback')}
        style={{ ...btnBase, top:buyY,
          background: bb ? activeBg('rgba(16,64,38,.82)') : btnBase.background,
          borderColor: bb ? 'rgba(34,197,94,.7)' : btnBase.border }}>
        {bb ? fmt(bb.remaining) : t('bb')}
      </button>

      {/* ── Optional rows (ULT / BKB). First one carries the dropdown arrow. ── */}
      {rows.map((kind, i) => {
        const arrow = (
          <div onClick={handleUltArrow} title={t('tip_menu')}
            style={{ width: arrowW, height:'100%',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', borderLeft:'1px solid rgba(255,255,255,.25)' }}>
            ▾
          </div>
        );
        const cfg = kind === 'ult'
          ? { active: !!ult,  onClick: handleUltStart, tip: t('tip_ult'),
              label: ult ? fmt(ult.remaining) : t('ult'),
              tint: 'rgba(46,30,78,.82)', edge: 'rgba(167,139,250,.7)' }
          : { active: !!bkb,  onClick: handleBKB,      tip: t('tip_bkb_btn'),
              label: bkb ? fmt(bkb.remaining) : t('bkb'),
              tint: 'rgba(8,72,90,.82)', edge: 'rgba(34,211,238,.7)' };
        const lit = cfg.active || (i === 0 && popup);
        return (
          <div key={kind} style={{ ...btnBase, top:rowY(i), padding:0,
              background: lit ? activeBg(cfg.tint) : btnBase.background,
              borderColor: lit ? cfg.edge : btnBase.border }}>
            <div onClick={cfg.onClick} title={cfg.tip}
              style={{ flex:1, height:'100%', display:'flex', alignItems:'center',
                justifyContent:'center', cursor:'pointer' }}>
              {cfg.label}
            </div>
            {i === 0 && arrow}
          </div>
        );
      })}

      {/* Both options off → only the dropdown arrow stays in its place ──────── */}
      {rows.length === 0 && (
        <div style={{ position:'absolute', top:ultY, left, width:geo.buttonW,
            height:geo.rowH, pointerEvents:'none', display:'flex', justifyContent:'flex-end' }}>
          <div onClick={handleUltArrow} title={t('tip_menu')}
            style={{ ...btnBase, position:'static', width:arrowW,
              background: popup ? activeBg('rgba(46,30,78,.82)') : btnBase.background,
              borderColor: popup ? 'rgba(167,139,250,.7)' : btnBase.border }}>
            ▾
          </div>
        </div>
      )}

      {popup && (
        <div style={{ position:'absolute', left, top:popupTop, zIndex:100,
          pointerEvents:'all', display:'flex', flexDirection:'column', gap:6 }}>
          {/* manual close — small red cross at the menu's top-right corner */}
          <button onClick={() => { closeMenu(); setPicking(false); }} title={t('close')}
            style={{ position:'absolute', top:-9, right:-9, width:20, height:20, zIndex:101,
              borderRadius:'50%', background:'#dc2626', color:'#fff', border:'1px solid #0a0f1a',
              cursor:'pointer', fontSize:12, fontWeight:700, lineHeight:1,
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 2px 8px rgba(0,0,0,.6)' }}>✕</button>
          {(!heroKey || picking) ? (
            <HeroPicker onPick={(k) => { setEnemyHeroManual(slot, k); setPicking(false); }} />
          ) : (
            <>
              <SlotOptions slot={slot} heroKey={heroKey} onChangeHero={() => setPicking(true)} />
              {opts.ult && (getUlt() ? (
                <UltPopup key={heroKey} heroKey={heroKey} ability={getUlt()} slot={slot}
                  onStart={(tm) => { startTimer(tm); closeMenu(); }}
                  onClose={() => closeMenu()} />
              ) : (
                <div style={{ background:'#0a0f1a', border:'1px solid #334155', borderRadius:8,
                  padding:10, color:'#64748b', fontSize:12, width:200 }}>
                  {t('loading')}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TopBarButtons({ measurements }) {
  const enemyHeroes = useOverlayStore(s => s.enemyHeroes);
  const localTeam   = useOverlayStore(s => s.localTeam);
  const inGame      = useOverlayStore(s => s.inGame);

  const geo  = topbarButtonGeometry(measurements);
  // Whole button row is vertically draggable (Ctrl+drag any button); persisted.
  const drag = useDraggable('topbar', { x: 0, y: geo.buybackY });

  if (!inGame) return null;

  const enemyIsDire = localTeam !== 'dire';
  const slotsX = enemyHeroSlotsX(measurements, enemyIsDire);
  const buyY = drag.pos.y;
  const ultY = drag.pos.y + geo.rowH + 2;

  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
      {[0,1,2,3,4].map(i => (
        <HeroButtons key={i} slot={i} heroKey={enemyHeroes[i]} cx={slotsX[i]} geo={geo}
          buyY={buyY} ultY={ultY} dragProps={drag.dragProps} />
      ))}
    </div>
  );
}
