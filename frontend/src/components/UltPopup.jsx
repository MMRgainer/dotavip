import { useState } from 'react';
import { useOverlayStore } from '../store/overlayStore';
import { useT } from '../i18n';

const CDN_ABILITY = a => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${a}.png`;

const SLOT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6'];

function calcCd(base, octarine) {
  let cd = base;
  if (octarine) cd *= 0.75;
  return Math.round(cd);
}

export default function UltPopup({ heroKey, ability, slot, initialLevel, onStart, onClose, onChangeHero }) {
  const t = useT();
  const maxLvl0 = ability.cooldowns?.length ?? 3;
  // Default level: an explicit override (e.g. Undying Tombstone follows hero
  // level) wins; otherwise the auto ult level from scoreboard OCR (6/12/18 →
  // 1/2/3), falling back to 1.
  const autoLvl = useOverlayStore(s => s.enemyUltLevels[slot]) || 0;
  const defaultLvl = initialLevel != null ? initialLevel : (autoLvl > 0 ? autoLvl : 1);
  const [level,    setLevel]   = useState(Math.min(maxLvl0, defaultLvl));

  // Modifiers persist per enemy slot (don't reset when popup closes)
  const mods   = useOverlayStore(s => s.enemyMods[slot]);
  const toggleMod = useOverlayStore(s => s.toggleEnemyMod);
  const octarine = mods.octarine;
  const setOctarine = () => toggleMod(slot, 'octarine');

  const cds     = ability.cooldowns ?? [];
  // Only show the level picker when the cooldown actually changes with level.
  // Heroes like Dragon Knight have several ult levels but a constant CD.
  const variesByLevel = new Set(cds).size > 1;
  const maxLvl  = cds.length || 3;
  const baseCd  = cds[level - 1] ?? cds[0] ?? 60;
  const finalCd = calcCd(baseCd, octarine);
  const color   = SLOT_COLORS[slot] ?? '#7c3aed';

  const CDN_HERO = h => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${h}.png`;

  return (
    <div style={{
      background: '#0a0f1a', border: `1px solid ${color}66`,
      borderRadius: 10, padding: 12, width: 200,
      boxShadow: '0 8px 32px rgba(0,0,0,.9)',
      pointerEvents: 'all',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <img src={CDN_ABILITY(ability.name)} alt="" width={34} height={34}
          style={{ borderRadius:4 }} onError={e => e.target.style.opacity='.2'} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:700 }}>{ability.display_name}</div>
          <div style={{ color:color, fontSize:12, fontWeight:700 }}>{finalCd}s</div>
        </div>
        {onChangeHero && (
          <button onClick={onChangeHero} title={t('change_hero')}
            style={{ flexShrink:0, width:28, height:28, padding:0,
              background:'#1e293b', border:'1px solid #334155', borderRadius:6,
              color:'#94a3b8', fontSize:14, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
            ⇄
          </button>
        )}
      </div>

      {/* Level — hidden for heroes whose ult CD doesn't change with level */}
      {variesByLevel && (
        <div style={{ marginBottom:8 }}>
          <div style={{ color:'#475569', fontSize:9, marginBottom:4, letterSpacing:'.06em' }}>{t('ult_level')}</div>
          <div style={{ display:'flex', gap:4 }}>
            {Array.from({length: maxLvl}, (_, i) => i+1).map(lvl => (
              <button key={lvl} onClick={() => setLevel(lvl)} title={t('tip_level')} style={{
                flex:1, padding:'5px 0', fontSize:13, fontWeight:700,
                background: level===lvl ? color : '#1e293b',
                color: level===lvl ? '#fff' : '#64748b',
                border:`1px solid ${level===lvl ? color : '#334155'}`,
                borderRadius:6, cursor:'pointer',
              }}>{lvl}</button>
            ))}
          </div>
        </div>
      )}

      {/* Modifier — Octarine Core only */}
      <div style={{ marginBottom:12 }}>
        <div style={{ color:'#475569', fontSize:9, marginBottom:4, letterSpacing:'.06em' }}>{t('bonuses')}</div>
        <button onClick={setOctarine} title={t('tip_octarine')} style={{
          width:'100%', padding:'6px 4px', fontSize:11, fontWeight:700,
          background: octarine ? '#0891b244' : '#1e293b',
          color: octarine ? '#67e8f9' : '#64748b',
          border:`1px solid ${octarine ? '#0891b2' : '#334155'}`,
          borderRadius:6, cursor:'pointer',
        }}>💎 Octarine −25%</button>
      </div>

      {/* Start */}
      <button onClick={() => onStart({
        type:'ult', slot, heroKey,
        label: ability.display_name,
        icon: CDN_ABILITY(ability.name),
        duration: finalCd,
      })} title={t('tip_start')} style={{
        width:'100%', padding:'8px 0',
        background: color, color:'#fff',
        border:'none', borderRadius:8,
        cursor:'pointer', fontSize:13, fontWeight:700,
      }}>
        ▶ {t('start_timer')}
      </button>
    </div>
  );
}
