import { LANGS, LANG_LABEL, useLang, setLang } from '../i18n';

export default function LangSwitcher() {
  const lang = useLang();
  return (
    <div style={{ display:'flex', gap:4 }}>
      {LANGS.map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding:'5px 11px', fontSize:12, fontWeight:700, borderRadius:7, cursor:'pointer',
          border: `1px solid ${l===lang ? '#38bdf8' : '#334155'}`,
          background: l===lang ? '#38bdf8' : 'transparent',
          color: l===lang ? '#06121f' : '#94a3b8',
        }}>{LANG_LABEL[l]}</button>
      ))}
    </div>
  );
}
