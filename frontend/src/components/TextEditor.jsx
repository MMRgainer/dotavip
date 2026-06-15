/**
 * Text editor — edit every UI string in a convenient list.
 * Edits save instantly (localStorage) and show live in the app.
 * "Export" copies all texts so they can be baked into the app permanently.
 */
import { useState, useReducer } from 'react';
import { T, LANGS, LANG_LABEL, useLang, setLang, getOverride, setOverride, clearOverrides, exportMerged } from '../i18n';

export default function TextEditor({ onClose }) {
  const lang = useLang();
  const [copied, setCopied] = useState(false);
  // Editing changes overrides, NOT the language — useLang's snapshot stays the
  // same, so React wouldn't re-render the controlled textareas (typed chars
  // would be reverted). Force a re-render on every edit.
  const [, forceRender] = useReducer(x => x + 1, 0);

  const valueFor = (key) => {
    const ov = getOverride(lang, key);
    return ov != null ? ov : (T[key]?.[lang] ?? T[key]?.en ?? '');
  };

  const doExport = async () => {
    const json = JSON.stringify(exportMerged(), null, 2);
    try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(()=>setCopied(false), 2000); } catch {}
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'#0b0f17', zIndex:9999, overflowY:'auto', padding:'20px 26px',
      fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e2e8f0' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16, position:'sticky', top:0, background:'#0b0f17', paddingBottom:10, zIndex:1 }}>
        <div style={{ fontSize:18, fontWeight:800 }}>Редактор тексту</div>
        <div style={{ display:'flex', gap:4 }}>
          {LANGS.map(l => (
            <button key={l} onClick={()=>setLang(l)} style={{ padding:'5px 11px', fontSize:12, fontWeight:700, borderRadius:7, cursor:'pointer',
              border:`1px solid ${l===lang?'#38bdf8':'#334155'}`, background:l===lang?'#38bdf8':'transparent', color:l===lang?'#06121f':'#94a3b8' }}>{LANG_LABEL[l]}</button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={doExport} style={btn('#0d9488')}>{copied ? 'Скопійовано ✓' : 'Експорт (копіювати все)'}</button>
          <button onClick={()=>{ if(confirm('Скинути всі правки?')) { clearOverrides(); forceRender(); } }} style={btn('#b91c1c')}>Скинути правки</button>
          <button onClick={onClose} style={btn('#2563eb')}>Готово</button>
        </div>
      </div>

      <div style={{ fontSize:13, color:'#64748b', marginBottom:14 }}>
        Редагуй мовою <b>{LANG_LABEL[lang]}</b> (перемкни кнопками вище для інших мов). Зміни застосовуються одразу.
      </div>

      <div style={{ maxWidth:900 }}>
        {Object.keys(T).map(key => (
          <div key={key} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'7px 0', borderBottom:'1px solid #161e2e' }}>
            <div style={{ width:150, flexShrink:0, fontSize:11, color:'#475569', paddingTop:8, fontFamily:'monospace' }}>{key}</div>
            <textarea value={valueFor(key)} onChange={e => { setOverride(lang, key, e.target.value); forceRender(); }} rows={1}
              style={{ flex:1, background:'#111827', color:'#e2e8f0', border:'1px solid #334155', borderRadius:6,
                padding:'7px 9px', fontSize:13, resize:'vertical', fontFamily:'inherit', minHeight:34 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const btn = (bg) => ({ background:bg, color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:700, cursor:'pointer' });
