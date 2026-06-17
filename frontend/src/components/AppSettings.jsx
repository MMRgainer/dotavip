/**
 * App settings window (opened with the ⚙ gear icon, top-right of the main
 * window). Rendered as a modal overlay. First setting: Windows autostart.
 */

import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { playChime } from '../overlay/chime';
import LangSwitcher from './LangSwitcher';

function Toggle({ on, onChange, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!on)} style={{
      width: 46, height: 24, borderRadius: 12, cursor: disabled ? 'default' : 'pointer',
      background: on ? '#2563eb' : '#334155', position: 'relative',
      transition: 'background .15s', flexShrink: 0, opacity: disabled ? .5 : 1,
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 24 : 2, width: 20, height: 20,
        borderRadius: '50%', background: '#fff', transition: 'left .15s',
      }} />
    </div>
  );
}

// Small round (i) info icon with a hover tooltip — matches the app style.
function InfoDot({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 7 }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #38bdf8', color: '#38bdf8',
        fontSize: 11, fontWeight: 700, fontStyle: 'italic', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'help' }}>i</span>
      {show && (
        <span style={{ position: 'absolute', bottom: '150%', left: '50%', transform: 'translateX(-50%)', width: 270,
          background: '#0a0f1a', border: '1px solid #334155', borderRadius: 8, padding: '9px 11px', color: '#cbd5e1',
          fontSize: 12, lineHeight: 1.5, zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,.85)', textAlign: 'left' }}>
          {text}
        </span>
      )}
    </span>
  );
}

export default function AppSettings({ onClose }) {
  const t = useT();
  const api = window.electronAPI;
  const [autostart, setAutostart] = useState(null);   // null = loading / unavailable
  const [updateReady,  setUpdateReady]  = useState(false);
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [appVersion,   setAppVersion]   = useState('');
  const [installing,   setInstalling]   = useState(false);
  const [checking,     setChecking]     = useState(false);
  // Lotus / Wisdom-rune reminders (shared with the overlay via localStorage)
  const [remOn,  setRemOn]  = useState(() => { try { return localStorage.getItem('rem_enabled') !== '0'; } catch { return true; } });
  const [remVol, setRemVol] = useState(() => { try { const v = parseFloat(localStorage.getItem('rem_volume')); return isNaN(v) ? 0.5 : v; } catch { return 0.5; } });

  const lastChimeRef = useRef(0);
  const setRemindersOn = (v) => { setRemOn(v); try { localStorage.setItem('rem_enabled', v ? '1' : '0'); } catch {} };
  const setRemindersVol = (v) => {
    setRemVol(v);
    try { localStorage.setItem('rem_volume', String(v)); } catch {}
    // Live preview: play the chime at the chosen volume while dragging
    // (throttled so it isn't a machine-gun of overlapping beeps).
    const now = Date.now();
    if (v > 0 && now - lastChimeRef.current > 220) {
      lastChimeRef.current = now;
      playChime(v);
    }
  };

  useEffect(() => {
    if (!api?.getAutostart) return;
    api.getAutostart().then(v => setAutostart(!!v)).catch(() => setAutostart(null));
  }, []);

  useEffect(() => {
    if (!api?.getAppVersion) return;
    api.getAppVersion().then(v => setAppVersion(v)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!api?.getUpdateStatus) return;
    const poll = () => {
      api.getUpdateReady().then(v => setUpdateReady(!!v)).catch(() => {});
      api.getUpdateStatus().then(v => setUpdateStatus(v || 'idle')).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3_000);
    return () => clearInterval(id);
  }, []);

  const handleCheckNow = async () => {
    setChecking(true);
    await api?.checkForUpdates?.().catch(() => {});
    setTimeout(() => setChecking(false), 4_000);
  };

  const toggleAutostart = async (v) => {
    setAutostart(v);
    try { await api?.setAutostart?.(v); } catch { /* keep optimistic value */ }
  };

  const row = (label, desc, control) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0',
      borderBottom: '1px solid #1e293b' }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{label}</div>
        <div style={{ color: '#64748b', fontSize: 12.5, lineHeight: 1.5 }}>{desc}</div>
      </div>
      {control}
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(2,6,23,.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxWidth: '92%', maxHeight: '86vh', overflowY: 'auto',
        background: '#111827', border: '1px solid #1e293b', borderRadius: 14,
        padding: '22px 26px', boxShadow: '0 16px 64px rgba(0,0,0,.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#e2e8f0', flex: 1 }}>
            ⚙ {t('settings_title')}
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#64748b',
            fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1,
          }}>✕</button>
        </div>

        {row(
          t('language_label'),
          t('language_desc'),
          <LangSwitcher />,
        )}

        {row(
          t('autostart_label'),
          t('autostart_desc'),
          autostart === null
            ? <span style={{ color: '#475569', fontSize: 12 }}>—</span>
            : <Toggle on={autostart} onChange={toggleAutostart} />,
        )}

        {/* Lotus / Wisdom-rune reminders — toggle + volume + info icon */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginBottom: 3 }}>
                {t('reminders_label')}<InfoDot text={t('reminders_info')} />
              </div>
              <div style={{ color: '#64748b', fontSize: 12.5, lineHeight: 1.5 }}>{t('reminders_desc')}</div>
            </div>
            <Toggle on={remOn} onChange={setRemindersOn} />
          </div>
          {remOn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span style={{ color: '#94a3b8', fontSize: 12.5, minWidth: 110 }}>{t('reminders_volume')}</span>
              <input type="range" min="0" max="1" step="0.05" value={remVol}
                onChange={e => setRemindersVol(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }} />
              <span style={{ color: '#64748b', fontSize: 12, minWidth: 36, textAlign: 'right' }}>
                {Math.round(remVol * 100)}%
              </span>
            </div>
          )}
        </div>

        {row(
          t('update_label') || 'Оновлення',
          (() => {
            if (!api?.getUpdateStatus) return t('update_unavail') || 'Недоступно в цій версії';
            if (updateStatus === 'checking')    return t('update_checking')    || 'Перевіряємо наявність оновлень…';
            if (updateStatus === 'downloading') return t('update_downloading') || 'Завантаження оновлення…';
            if (updateStatus === 'available')   return t('update_available')   || 'Знайдено нову версію, завантажуємо…';
            if (updateStatus === 'ready')       return t('update_ready_desc')  || 'Оновлення готове. Буде встановлено після закриття Dota 2.';
            if (updateStatus === 'error')       return t('update_error')       || 'Помилка перевірки оновлень.';
            // idle or up-to-date
            return appVersion
              ? (t('update_current') || `Версія ${appVersion} — актуальна`).replace('{v}', appVersion)
              : (t('update_uptodate') || 'Версія актуальна');
          })(),
          updateReady
            ? <button
                onClick={async () => { setInstalling(true); await api?.installUpdateNow?.().catch(() => {}); }}
                disabled={installing}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '8px 14px', fontSize: 12.5, fontWeight: 700,
                  cursor: installing ? 'default' : 'pointer', opacity: installing ? .6 : 1, whiteSpace: 'nowrap' }}>
                {installing ? '…' : (t('update_install_btn') || 'Встановити')}
              </button>
            : updateStatus === 'up-to-date'
              ? <button disabled style={{
                  background: 'transparent', color: '#22c55e', border: '1px solid #22c55e',
                  borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 700,
                  cursor: 'default', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span>✓</span> {t('update_uptodate') || 'Актуальна'}
                </button>
              : <button
                  onClick={handleCheckNow}
                  disabled={checking || updateStatus === 'checking' || updateStatus === 'downloading'}
                  style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155',
                    borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
                    cursor: checking ? 'default' : 'pointer', opacity: checking ? .5 : 1, whiteSpace: 'nowrap' }}>
                  {checking ? '…' : (t('update_check_btn') || 'Перевірити')}
                </button>,
        )}
      </div>
    </div>
  );
}
