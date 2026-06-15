/**
 * DotaVIP — main window.
 * Left: status checkpoints. Center: scoreboard setup + how-to guide.
 */

import { useEffect, useState, useRef } from 'react';
import { useT } from './i18n';
import { pub } from './pub';
import AppSettings from './components/AppSettings';

const API = 'http://127.0.0.1:8765';

const card   = { background:'#111827', border:'1px solid #1e293b', borderRadius:12, padding:'20px 24px', marginBottom:18 };
const hTitle = { fontSize:14, fontWeight:800, color:'#cbd5e1', marginBottom:16, letterSpacing:'.07em', textAlign:'center' };
const btn    = { background:'#2563eb', color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', fontSize:14, fontWeight:700, cursor:'pointer' };

// ── left sidebar checkpoints ─────────────────────────────────────────────────
function Checkpoints({ status, onHoverReading }) {
  const t = useT();
  const s = status || {}; const gsi = s.gsi || {};
  const linkOk    = !!gsi.installed;
  const readingOk = !!(s.calibrated && s.tesseract);
  const inGame    = !!s.in_game;

  const Item = ({ state, label, extra }) => {
    // state: 'ok' | 'bad' | 'wait'
    const color = state==='ok' ? '#22c55e' : state==='wait' ? '#f59e0b' : '#ef4444';
    const mark  = state==='ok' ? '✓' : state==='wait' ? '●' : '!';
    return (
      <div {...extra} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 12px', borderRadius:9,
        background:'#0f172a', border:'1px solid #1e293b', marginBottom:10, cursor: extra?.onMouseEnter ? 'help' : 'default' }}>
        <span className={state==='bad' ? 'blink' : ''} style={{ display:'inline-flex', width:24, height:24, borderRadius:'50%',
          alignItems:'center', justifyContent:'center', background:color, color:'#06121f', fontWeight:900, fontSize:14, flexShrink:0 }}>{mark}</span>
        <span style={{ fontSize:13.5, color:'#cbd5e1' }}>{label}</span>
      </div>
    );
  };

  return (
    <div style={{ width:260, flexShrink:0 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#64748b', letterSpacing:'.08em', marginBottom:10, textAlign:'center' }}>{t('checks_title')}</div>
      <Item state={linkOk ? 'ok' : 'bad'} label={t('chk_link')} />
      <Item state={readingOk ? 'ok' : 'bad'} label={t('chk_reading')}
        extra={!readingOk ? { onMouseEnter:()=>onHoverReading(true), onMouseLeave:()=>onHoverReading(false) } : undefined} />
      <Item state={inGame ? 'ok' : 'wait'} label={inGame ? t('chk_ingame') : t('chk_waiting')} />
    </div>
  );
}

// ── calibration ──────────────────────────────────────────────────────────────
const STEP_KEYS = ['level_first','radiant_first','radiant_last','dire_first','dire_last'];
const STEP_WHAT = ['c_level1','c_rad_first','c_rad_last','c_dire_first','c_dire_last'];

// Round (i) badge — shows a fullscreen screenshot while hovered.
function InfoImg({ src }) {
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);
  return (
    <>
      <span onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        style={{ display:'inline-flex', width:18, height:18, borderRadius:'50%', border:'1px solid #38bdf8',
          color:'#38bdf8', fontSize:12, fontWeight:700, fontStyle:'italic', alignItems:'center',
          justifyContent:'center', cursor:'help', marginLeft:8, verticalAlign:'middle', flexShrink:0 }}>i</span>
      {show && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(2,6,23,.93)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:24, pointerEvents:'none' }}>
          {err ? (
            <div style={{ color:'#64748b', fontSize:15, border:'1px dashed #334155', borderRadius:10,
              padding:'28px 40px', background:'#0a0f1a' }}>📷 Скріншот буде додано пізніше</div>
          ) : (
            <img src={src} onError={() => setErr(true)}
              style={{ maxWidth:'96%', maxHeight:'96%', objectFit:'contain', borderRadius:8,
                boxShadow:'0 12px 64px rgba(0,0,0,.85)', border:'1px solid #334155' }} />
          )}
        </div>
      )}
    </>
  );
}

// Renders the saved calibration snapshot: screenshot + 5 numbered dots.
function CalibrationSnapshot({ snapshot, successMsg }) {
  const t = useT();
  if (!snapshot) return null;
  const { width, height, clicks } = snapshot;
  const LABELS  = ['1','2','3','4','5'];
  const COLORS  = ['#38bdf8','#22c55e','#f59e0b','#f472b6','#a78bfa'];
  const KEYS    = ['level_first','radiant_first','radiant_last','dire_first','dire_last'];
  const NAMES   = ['c_level1','c_rad_first','c_rad_last','c_dire_first','c_dire_last'];
  // Cache-bust so the image reloads after recalibration
  const imgSrc  = `${API}/calibrate/preview.png?t=${snapshot._ts || 0}`;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '.07em',
        textAlign: 'center', marginBottom: 10 }}>{t('calib_preview_title') || 'ЗБЕРЕЖЕНІ ТОЧКИ КАЛІБРУВАННЯ'}</div>
      <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
        <img src={imgSrc}
          style={{ width: '100%', display: 'block', borderRadius: 6, border: '1px solid #1e293b' }} />
        {KEYS.map((key, i) => {
          const pt = clicks[key];
          if (!pt) return null;
          // Convert original pixel coords to percentage for responsive layout
          const left = `${(pt.x / width * 100).toFixed(2)}%`;
          const top  = `${(pt.y / height * 100).toFixed(2)}%`;
          return (
            <div key={key} title={t(NAMES[i]) || NAMES[i]} style={{
              position: 'absolute', left, top,
              transform: 'translate(-50%, -50%)',
              width: 22, height: 22, borderRadius: '50%',
              background: COLORS[i], color: '#06121f',
              fontWeight: 900, fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 0 2px #0b0f17, 0 0 8px ${COLORS[i]}88`,
              pointerEvents: 'none', userSelect: 'none',
            }}>{LABELS[i]}</div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
        {KEYS.map((key, i) => (
          <span key={key} style={{ fontSize: 11.5, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[i], display: 'inline-block', flexShrink: 0 }} />
            {LABELS[i]} — {t(NAMES[i]) || NAMES[i]}
          </span>
        ))}
      </div>

      {/* One-time success message shown only immediately after calibration */}
      {successMsg && (
        <div style={{ marginTop: 16, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)',
          borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            ✓ {t('calib_success_title') || 'Калібрування успішне'}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {successMsg}
          </div>
        </div>
      )}
    </div>
  );
}

function CalibrationModal({ calibrated, reload, onClose }) {
  const t = useT();
  const [phase, setPhase] = useState('idle');
  const [count, setCount] = useState(0);
  const [img, setImg] = useState(null);
  const [clicks, setClicks] = useState({});
  const [stepIdx, setStepIdx] = useState(0);
  const [msg, setMsg] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [ocrRows, setOcrRows] = useState([]);
  const imgRef = useRef();

  // Load saved snapshot on open; add _ts=now so img always busts cache
  useEffect(() => {
    fetch(`${API}/calibrate/snapshot`)
      .then(r => r.json())
      .then(d => { if (d.snapshot) setSnapshot({ ...d.snapshot, _ts: Date.now() }); })
      .catch(() => {});
  }, []);

  const handleStart = () => {
    if (calibrated && !window.confirm(t('recalibrate_confirm'))) return;
    start();
  };

  const start = async () => {
    setClicks({}); setStepIdx(0); setImg(null); setMsg(''); setOcrRows([]); setSuccessMsg('');
    const delay = 5; setPhase('counting'); setCount(delay);
    const iv = setInterval(() => setCount(c => c-1), 1000);
    try {
      const r = await fetch(`${API}/calibrate/capture?delay=${delay}`);
      const d = await r.json();
      clearInterval(iv);
      if (!r.ok || !d.image) {
        setPhase('error');
        setMsg(d?.detail || t('capture_fail'));
        return;
      }
      setImg({ data:`data:image/png;base64,${d.image}`, width:d.width, height:d.height });
      setPhase('clicking');
    } catch { clearInterval(iv); setPhase('error'); setMsg(t('capture_fail')); }
  };

  const onClick = (e) => {
    if (phase!=='clicking' || !img) return;
    const r = imgRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX-r.left)*img.width/r.width);
    const y = Math.round((e.clientY-r.top)*img.height/r.height);
    const next = { ...clicks, [STEP_KEYS[stepIdx]]:{x,y} };
    setClicks(next);
    if (stepIdx < 4) setStepIdx(stepIdx+1); else save(next);
  };

  const save = async (c) => {
    setPhase('saving');
    try {
      const imageB64 = img.data.replace(/^data:image\/png;base64,/, '');
      const res = await fetch(`${API}/calibrate`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ width:img.width, height:img.height, image: imageB64,
          level_first:c.level_first, radiant_first:c.radiant_first, radiant_last:c.radiant_last,
          dire_first:c.dire_first, dire_last:c.dire_last }),
      });
      const data = await res.json();
      const ts = Date.now();
      setSnapshot({ width: img.width, height: img.height, clicks: c, _ts: ts });
      const rows = data?.rows || [];
      setOcrRows(rows);
      setPhase('confirm');
      reload();
    } catch { setPhase('error'); setMsg(t('save_fail')); }
  };

  const confirmYes = () => {
    const lines = ocrRows.map(h => `• ${h.hero || '?'}  (рівень ${h.level ?? '?'})`).join('\n');
    setSuccessMsg(ocrRows.length
      ? `Суперників розпізнано: ${ocrRows.length}\n${lines}`
      : 'Точки збережено успішно.');
    setPhase('done');
  };

  const confirmNo = () => {
    start();
  };

  const ACCENT = '#38bdf8';
  const colTitle = { fontSize:18, fontWeight:800, color:'#cbd5e1', letterSpacing:'.1em', textAlign:'center', marginBottom:26 };

  // numbered guide step; steps 1-3 carry a hover (i) → fullscreen screenshot
  const gstep = (n, text, imgSrc) => (
    <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:20 }}>
      <div style={{ flexShrink:0, width:30, height:30, borderRadius:'50%', background:ACCENT, color:'#06121f',
        fontWeight:800, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' }}>{n}</div>
      <div style={{ flex:1, color:'#cbd5e1', fontSize:15.5, lineHeight:1.55, paddingTop:3 }}>
        {text}{imgSrc && <InfoImg src={imgSrc} />}
      </div>
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'#0b0f17', display:'flex', flexDirection:'column' }}>
      <button onClick={onClose} title={t('close')} style={{ position:'absolute', top:16, right:22, zIndex:5,
        background:'transparent', border:'none', color:'#94a3b8', fontSize:26, cursor:'pointer', lineHeight:1 }}>✕</button>

      <div style={{ flex:1, display:'flex', minHeight:0 }}>
        {/* ── LEFT: guide ──────────────────────────────────────────────────── */}
        <div style={{ flex:1, padding:'46px 52px', overflowY:'auto' }}>
          <div style={colTitle}>{t('guide_title')}</div>
          {gstep(1, t('calib_g1'), pub('guide/guide_img1.png'))}
          {gstep(2, t('calib_g2'), pub('guide/guide_img2.png'))}
          {gstep(3, t('calib_g_display'), pub('guide/guide_borderless.png'))}
          {gstep(4, t('calib_g3'), pub('guide/guide_img3.png'))}
          {gstep(5, t('calib_g4'), null)}
        </div>

        {/* divider — app accent colour */}
        <div style={{ width:2, flexShrink:0, background:ACCENT, boxShadow:`0 0 14px ${ACCENT}` }} />

        {/* ── RIGHT: setup / calibration ───────────────────────────────────── */}
        <div style={{ flex:1, padding:'46px 52px', overflowY:'auto' }}>
          <div style={colTitle}>
            {t('setup_title')} {calibrated && <span style={{color:'#22c55e'}}>✓ {t('done')}</span>}
          </div>
          <div style={{ textAlign:'center' }}>
            {phase==='idle' && <button onClick={handleStart} style={{ ...btn, padding:'12px 26px', fontSize:15 }}>
              {calibrated ? t('recalibrate') : t('calib_btn')}</button>}
            {phase==='counting' && <div style={{ color:ACCENT, fontWeight:700, fontSize:16 }}>{t('countdown',{n:count})}</div>}
          </div>
          {phase==='clicking' && img && (<>
            <div style={{ color:'#fbbf24', fontWeight:700, margin:'14px 0 8px', textAlign:'center' }}>{t('step_of',{ i:stepIdx+1, what:t(STEP_WHAT[stepIdx]) })}</div>
            <img ref={imgRef} src={img.data} onClick={onClick} style={{ maxWidth:'100%', cursor:'crosshair', borderRadius:6, display:'block' }} />
          </>)}
          {phase==='saving' && <div style={{color:ACCENT, textAlign:'center', marginTop:14}}>{t('saving')}</div>}

          {phase==='confirm' && (
            <div style={{ marginTop:18, background:'rgba(56,189,248,.07)', border:'1px solid rgba(56,189,248,.25)',
              borderRadius:10, padding:'16px 20px' }}>
              <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:14, marginBottom:10 }}>
                Розпізнані герої суперника:
              </div>
              {ocrRows.length === 0
                ? <div style={{ color:'#f59e0b', fontSize:13, marginBottom:12 }}>
                    Героїв не розпізнано — можливо, таблиця результатів була закрита.
                  </div>
                : <ul style={{ margin:'0 0 14px', padding:'0 0 0 18px', color:'#94a3b8', fontSize:13.5, lineHeight:2 }}>
                    {ocrRows.map((h, i) => (
                      <li key={i}><span style={{ color:'#e2e8f0', fontWeight:600 }}>{h.hero || '?'}</span>
                        {' '}<span style={{ color:'#64748b' }}>— рівень {h.level ?? '?'}</span></li>
                    ))}
                  </ul>
              }
              <div style={{ color:'#cbd5e1', fontSize:13.5, marginBottom:14 }}>
                Чи правильно розпізнано героїв суперника?
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={confirmYes} style={{ ...btn, background:'#16a34a', padding:'9px 22px' }}>
                  ✓ Так, правильно
                </button>
                <button onClick={confirmNo} style={{ ...btn, background:'#7f1d1d', padding:'9px 22px' }}>
                  ✗ Ні, пройти ще раз
                </button>
              </div>
            </div>
          )}

          {phase==='done'  && <div style={{color:'#22c55e', textAlign:'center', marginTop:14}}>✓ {t('calib_saved')} <button onClick={start} style={{...btn, marginLeft:10}}>{t('try_again')}</button></div>}
          {phase==='error' && <div style={{color:'#ef4444', textAlign:'center', marginTop:14}}>{msg} <button onClick={start} style={{...btn, marginLeft:10}}>{t('try_again')}</button></div>}

          {/* Persistent preview — shown when snapshot exists and not mid-calibration */}
          {snapshot && phase !== 'clicking' && phase !== 'counting' && phase !== 'saving' && (
            <CalibrationSnapshot snapshot={snapshot} successMsg={successMsg} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── small round (i) info button with hover tooltip ───────────────────────────
function InfoDot({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position:'relative', display:'inline-flex', verticalAlign:'middle', marginLeft:6 }}
      onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <span style={{ width:16, height:16, borderRadius:'50%', border:'1px solid #475569', color:'#94a3b8',
        fontSize:11, fontWeight:700, fontStyle:'italic', display:'inline-flex', alignItems:'center',
        justifyContent:'center', cursor:'help' }}>i</span>
      {show && (
        <span style={{ position:'absolute', bottom:'150%', left:'50%', transform:'translateX(-50%)', width:250,
          background:'#0a0f1a', border:'1px solid #334155', borderRadius:8, padding:'8px 10px', color:'#cbd5e1',
          fontSize:12.5, lineHeight:1.5, zIndex:20, boxShadow:'0 8px 24px rgba(0,0,0,.85)', textAlign:'left' }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── guide ────────────────────────────────────────────────────────────────────
function Guide() {
  const t = useT();
  const row = (icon, h, b) => (
    <div style={{ display:'flex', gap:14, alignItems:'center', padding:'13px 0', borderTop:'1px solid #1e293b' }}>
      <div style={{ width:52, height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ color:'#e2e8f0', fontWeight:700, marginBottom:3, fontSize:15, textAlign:'left' }}>{h}</div>
        <div style={{ color:'#94a3b8', fontSize:14, lineHeight:1.5, textAlign:'left' }}>{b}</div>
      </div>
    </div>
  );
  const tag = (txt) => <span style={{fontSize:11, fontWeight:700, color:'#cbd5e1', border:'1px solid #475569', borderRadius:3, padding:'2px 6px'}}>{txt}</span>;
  const img = (src) => <img src={src} style={{ width:40, height:40, objectFit:'contain' }} />;
  return (
    <div style={card}>
      <div style={{ ...hTitle, textAlign:'left' }}>{t('step3')}</div>
      {row(tag(t('bb')),  t('g_bb_h'),   t('g_bb_b'))}
      {row(tag(t('ult')), t('g_ult_h'),  t('g_ult_b'))}
      {row(tag('▾'),      t('g_menu_h'), t('g_menu_b'))}
      {row(tag(t('bkb')), t('g_bkb_h'),  t('g_bkb_b'))}
      {row(img(pub('rosh/Roshan.png')), t('g_rosh_h'),  t('g_rosh_b'))}
      {row(img(pub('rosh/Glyph.png')),  t('g_glyph_h'), t('g_glyph_b'))}
      {row(<span style={{fontSize:22}}>🖱️</span>, t('g_move_h'), t('g_move_b'))}
      {row(<span style={{fontSize:22}}>⌨️</span>, t('g_read_h'),
        <>{t('g_read_b')}<InfoDot text={t('g_read_info')} /></>)}
    </div>
  );
}

// ── root ─────────────────────────────────────────────────────────────────────
export default function SettingsApp() {
  const t = useT();
  const [status, setStatus] = useState(null);
  const [highlight, setHighlight] = useState(false);
  const [scale, setScale] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showCalib, setShowCalib] = useState(false);
  const reload = () => fetch(`${API}/setup/status`).then(r=>r.json()).then(setStatus).catch(()=>setStatus(null));
  useEffect(() => { reload(); const id = setInterval(reload, 3000); return () => clearInterval(id); }, []);

  // Dynamic scaling: everything grows/shrinks with the window size.
  useEffect(() => {
    const f = () => setScale(Math.max(0.62, Math.min(1.15, window.innerWidth / 1500)));
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);

  return (
    <div style={{ fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e2e8f0', background:'#0b0f17', minHeight:'100vh', position:'relative' }}>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} } .blink{ animation:blink 1s infinite; }`}</style>

      {showSettings && <AppSettings onClose={() => setShowSettings(false)} />}
      {showCalib && <CalibrationModal calibrated={status?.calibrated} reload={reload} onClose={() => setShowCalib(false)} />}

      {/* top-right corner: settings gear */}
      <div style={{ position:'absolute', top:22, right:26, zIndex:10 }}>
        <button onClick={() => setShowSettings(true)} title={t('settings_title')}
          style={{ background:'transparent', border:'1px solid #334155',
            color:'#94a3b8', borderRadius:8, padding:'6px 11px', fontSize:15, cursor:'pointer', lineHeight:1 }}>⚙</button>
      </div>

      {/* logo — top-left */}
      <div style={{ position:'absolute', top:22, left:30, display:'flex', alignItems:'center', gap:12, zoom:scale }}>
        <img src={pub('rosh/Roshan.png')} alt="" width={40} height={40} style={{objectFit:'contain'}} />
        <div>
          <div style={{ fontSize:24, fontWeight:800 }}>Dota<span style={{color:'#38bdf8'}}>VIP</span></div>
          <div style={{ fontSize:13, color:'#64748b' }}>{t('tagline')}</div>
        </div>
      </div>

      {/* checkpoints — floating left (do not affect centering) */}
      <div style={{ position:'absolute', top:110, left:30, zoom:scale }}>
        <Checkpoints status={status} onHoverReading={setHighlight} />
      </div>

      {/* main column — flex-centered on the whole window */}
      <div style={{ display:'flex', justifyContent:'center' }}>
        <div style={{ width:820, maxWidth:'92%', zoom:scale, padding:'92px 0 30px' }}>
          {/* Scoreboard setup — opens in its own window. Button stays top-center. */}
          <div style={{ display:'flex', justifyContent:'center', marginBottom:18 }}>
            <button onClick={() => setShowCalib(true)} style={{
              ...btn, padding:'12px 26px', fontSize:15, display:'inline-flex', alignItems:'center', gap:10,
              transition:'box-shadow .2s', boxShadow: highlight ? '0 0 0 2px #38bdf8, 0 0 22px rgba(56,189,248,.5)' : 'none' }}>
              ⚙ {t('step2')}
              {status?.calibrated && <span style={{ color:'#86efac', fontWeight:800 }}>✓</span>}
            </button>
          </div>
          <Guide />
          <div style={{ fontSize:13, color:'#475569', marginTop:8, textAlign:'center' }}>{t('footer')}</div>
        </div>
      </div>
    </div>
  );
}
