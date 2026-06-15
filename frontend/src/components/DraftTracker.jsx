/**
 * Enemy draft panel — 5 hero portrait icons.
 * Heroes come from auto-detection (topbar) or are set via the Cooldown Tracker.
 * Portrait images served directly from Steam CDN.
 */

import { useOverlayStore } from '../store/overlayStore';

const CDN_PORTRAIT = (hero) =>
  `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hero}.png`;

const SLOT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

function HeroSlot({ slot, heroKey, displayName }) {
  const isEmpty = !heroKey;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* Portrait */}
      <div style={{
        width: 72, height: 52,
        borderRadius: 6,
        border: `2px solid ${isEmpty ? '#1e293b' : SLOT_COLORS[slot]}`,
        overflow: 'hidden',
        background: '#0f172a',
        position: 'relative',
        flexShrink: 0,
      }}>
        {!isEmpty ? (
          <img
            src={CDN_PORTRAIT(heroKey)}
            alt={displayName}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#334155', fontSize: 20,
          }}>?</div>
        )}

        {/* Slot number badge */}
        <div style={{
          position: 'absolute', bottom: 2, right: 3,
          background: 'rgba(0,0,0,0.75)',
          color: SLOT_COLORS[slot],
          fontSize: 9, fontWeight: 700,
          padding: '1px 3px', borderRadius: 3,
          lineHeight: 1,
        }}>
          E{slot + 1}
        </div>
      </div>

      {/* Hero name */}
      <div style={{
        fontSize: 10,
        color: isEmpty ? '#334155' : '#94a3b8',
        textAlign: 'center',
        maxWidth: 72,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
      }}>
        {isEmpty ? '—' : (displayName || heroKey).replace(/_/g, ' ')}
      </div>
    </div>
  );
}

export default function DraftTracker() {
  const enemyHeroes = useOverlayStore(s => s.enemyHeroes);
  const heroList    = useOverlayStore(s => s.heroList);   // [{key, display_name}]

  const getDisplayName = (key) => {
    if (!key) return '';
    const found = heroList.find(h => h.key === key);
    return found ? found.display_name : key;
  };

  const detectedCount = enemyHeroes.filter(Boolean).length;

  return (
    <div className="panel">
      <h2 className="panel-title">
        🗡 Enemy Heroes
        {detectedCount > 0 && (
          <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
            {detectedCount}/5 detected
          </span>
        )}
      </h2>

      <div style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '8px 0',
      }}>
        {enemyHeroes.map((heroKey, i) => (
          <HeroSlot
            key={i}
            slot={i}
            heroKey={heroKey}
            displayName={getDisplayName(heroKey)}
          />
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 4 }}>
        Auto-detected • set manually in Cooldowns ↙
      </div>
    </div>
  );
}
