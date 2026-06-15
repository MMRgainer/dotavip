/**
 * Roshan / Aegis / Glyph timers — DotaCoach-style circular cells.
 *
 * Exported as TWO independent blocks so each can be dragged separately:
 *   - RoshanAegisBlock : Roshan + Aegis (Aegis appears after Roshan killed)
 *   - GlyphBlock       : Glyph alone
 *
 * State lives in the zustand store so GSI events auto-start the timers.
 */

import { useState, useEffect } from 'react';
import { useOverlayStore } from '../store/overlayStore';
import { useMouseThrough } from '../hooks/useMouseThrough';
import { useT } from '../i18n';
import { pub } from '../pub';

const NORMAL = { respawnMin: 8*60,  respawnMax: 11*60,  aegis: 5*60 };
const TURBO  = { respawnMin: 4*60,  respawnMax: 5.5*60, aegis: 4*60 };
const GLYPH_CD = 5 * 60;

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set(n => n+1), 1000); return () => clearInterval(id); }, []);
}

/** One circular timer cell. */
function Cell({ size, svgSrc, pngSrc, countdown, countdownHigh, onActivate, onCancel, blink }) {
  const active   = countdown !== undefined && countdown !== null;
  const inner    = size * 0.82;
  const fontSize = Math.max(9, Math.round(size * 0.26));

  if (!active) {
    return (
      <div onClick={onActivate}
        style={{ width:size, height:size, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <img src={svgSrc || pngSrc} alt=""
          style={{ width:inner, height:inner, objectFit:'contain', transition:'transform .12s', filter:'drop-shadow(0 1px 3px rgba(0,0,0,.8))' }}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'} />
      </div>
    );
  }

  const lines = countdownHigh !== undefined ? [fmt(countdown), fmt(countdownHigh)] : [fmt(countdown)];
  return (
    <div className={blink ? 'blink' : ''} style={{ width:size, height:size, position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <img src={pub('rosh/Counter.png')} alt="" style={{ width:inner, height:inner, objectFit:'contain', position:'absolute' }} />
      <div style={{
        position:'absolute', fontSize: countdownHigh !== undefined ? fontSize*0.8 : fontSize,
        fontWeight:700, color:'#fff', textAlign:'center', lineHeight:1.2,
        textShadow:'0 1px 4px #000', pointerEvents:'none',
      }}>
        {lines.map((l,i) => <div key={i}>{l}</div>)}
      </div>
      <img src={pngSrc} alt="" style={{ position:'absolute', bottom:'12%', right:'8%', width:size*0.26, height:size*0.26, objectFit:'contain' }} />
      <div onClick={onCancel} style={{
        position:'absolute', top:'2%', right:'4%', width:size*0.24, height:size*0.24,
        borderRadius:'50%', background:'rgba(239,68,68,.85)', display:'flex',
        alignItems:'center', justifyContent:'center', cursor:'pointer',
        fontSize:fontSize*0.9, fontWeight:900, color:'#fff', lineHeight:1,
      }}>×</div>
    </div>
  );
}

// ── Roshan + Aegis (one draggable unit; Aegis tied to Roshan) ────────────────
export function RoshanAegisBlock({ cell = 67 }) {
  useTick();
  const tHint = useT()('turbo_hint');
  const { onMouseEnter, onMouseLeave } = useMouseThrough();
  const turbo    = useOverlayStore(s => s.turbo);
  const roshanAt = useOverlayStore(s => s.roshanAt);
  const aegisAt  = useOverlayStore(s => s.aegisAt);
  const killRoshan   = useOverlayStore(s => s.killRoshan);
  const cancelRoshan = useOverlayStore(s => s.cancelRoshan);
  const startAegis   = useOverlayStore(s => s.startAegis);
  const cancelAegis  = useOverlayStore(s => s.cancelAegis);
  const setTurbo     = useOverlayStore(s => s.setTurbo);

  const cfg = turbo ? TURBO : NORMAL;
  const roshanCd = () => {
    if (!roshanAt) return undefined;
    const el = (Date.now()-roshanAt)/1000;
    return el >= cfg.respawnMax ? 0 : Math.max(0, cfg.respawnMin - el);
  };
  const roshanCdHigh = () => {
    if (!roshanAt) return undefined;
    const el = (Date.now()-roshanAt)/1000;
    return el >= cfg.respawnMax ? undefined : Math.max(0, cfg.respawnMax - el);
  };
  const aegisCd = () => aegisAt ? Math.max(0, cfg.aegis - (Date.now()-aegisAt)/1000) : undefined;
  const showAegis = !!aegisAt;   // hide once Aegis expires; only Roshan stays
  const aRem = aegisAt ? cfg.aegis - (Date.now()-aegisAt)/1000 : 999;
  const aegisBlink = aRem > 0 && aRem <= 5;          // blink last 5 seconds

  // When a timer finishes, revert the icon to its start (clickable) state.
  useEffect(() => {
    if (roshanAt && (Date.now()-roshanAt)/1000 >= cfg.respawnMax) cancelRoshan();
    if (aegisAt  && (Date.now()-aegisAt)/1000  >= cfg.aegis)       cancelAegis();
  });

  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      onDoubleClick={() => setTurbo(!turbo)}
      title={(turbo ? 'Turbo · ' : 'Normal · ') + tHint}
      style={{ display:'flex', userSelect:'none' }}>
      <Cell size={cell} svgSrc={pub('rosh/Roshan.svg')} pngSrc={pub('rosh/Roshan.png')}
        countdown={roshanCd()} countdownHigh={roshanCdHigh()}
        onActivate={killRoshan} onCancel={cancelRoshan} />
      {showAegis && (
        <Cell size={cell} svgSrc={pub('rosh/Aegis.png')} pngSrc={pub('rosh/Aegis.png')}
          countdown={aegisCd()} blink={aegisBlink}
          onActivate={() => startAegis()} onCancel={cancelAegis} />
      )}
    </div>
  );
}

// ── Glyph (separate draggable) ───────────────────────────────────────────────
export function GlyphBlock({ cell = 67 }) {
  useTick();
  const { onMouseEnter, onMouseLeave } = useMouseThrough();
  const glyphAt     = useOverlayStore(s => s.glyphAt);
  const startGlyph  = useOverlayStore(s => s.startGlyph);
  const cancelGlyph = useOverlayStore(s => s.cancelGlyph);

  const glyphCd = () => glyphAt ? Math.max(0, GLYPH_CD - (Date.now()-glyphAt)/1000) : undefined;

  useEffect(() => {
    if (glyphAt && (Date.now()-glyphAt)/1000 >= GLYPH_CD) cancelGlyph();
  });

  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ display:'flex', userSelect:'none' }}>
      <Cell size={cell} svgSrc={pub('rosh/Glyph.svg')} pngSrc={pub('rosh/Glyph.png')}
        countdown={glyphCd()} onActivate={startGlyph} onCancel={cancelGlyph} />
    </div>
  );
}

// ── Browser-mode convenience (both stacked) ──────────────────────────────────
export default function RoshanPanel({ size = 134 }) {
  const cell = size / 2;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <RoshanAegisBlock cell={cell} />
      <GlyphBlock cell={cell} />
    </div>
  );
}
