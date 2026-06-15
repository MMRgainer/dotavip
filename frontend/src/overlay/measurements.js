/**
 * Resolution-independent positioning — copied directly from DotaCoach.
 *
 * DotaCoach does NOT compute positions from ratios. Instead it keeps a
 * lookup table of exact pixel measurements per resolution. We copy their
 * table (the values are reverse-engineered from their bundled code) and
 * pick the entry matching the game's resolution, with nearest-match fallback.
 *
 * Key fields (inGame):
 *   heroesRadiantBottomLeftXPos — X where the 5 Radiant hero portraits start
 *   heroesDireBottomLeftXPos    — X where the 5 Dire hero portraits start
 *   heroesWidth                 — total width spanning all 5 portraits
 *   heroesHeight                — height of one hero portrait
 *   roshanGlyph { xPos, yPos, size } — Roshan/Aegis/Glyph 2×2 panel box
 *
 * Derived:
 *   heroSlotWidth = heroesWidth / 5
 *   buyback row   = y: heroesHeight * 1.67, height: heroesHeight/2 + 2   (per hero slot)
 *   ult row       = directly below buyback
 *   roshanGlyph cell = size / 2  (2×2 grid: Roshan, Aegis, Glyph, empty)
 */

// ── DotaCoach measurement table (most common resolutions) ───────────────────
const TABLE = {
  '1920x1080': {
    fontSize: 13,
    inGame: {
      heroesRadiantBottomLeftXPos: 549,
      heroesDireBottomLeftXPos:    1062,
      heroesHeight: 39,
      heroesWidth:  308,
      roshanGlyph: { xPos: 250, yPos: 841, size: 106 },
    },
  },
  '2560x1440': {
    fontSize: 17,
    inGame: {
      heroesRadiantBottomLeftXPos: 734,
      heroesDireBottomLeftXPos:    1415,
      heroesHeight: 53,
      heroesWidth:  411,
      roshanGlyph: { xPos: 335, yPos: 1115, size: 134 },
    },
  },
  '2560x1600': {
    fontSize: 19,
    inGame: {
      // Approximated from 2560x1440 scaled to height; refine later if needed
      heroesRadiantBottomLeftXPos: 734,
      heroesDireBottomLeftXPos:    1415,
      heroesHeight: 59,
      heroesWidth:  411,
      roshanGlyph: { xPos: 335, yPos: 1240, size: 149 },
    },
  },
  '3840x2160': {
    fontSize: 26,
    inGame: {
      // 4K — exactly 2× of 1920x1080
      heroesRadiantBottomLeftXPos: 1098,
      heroesDireBottomLeftXPos:    2124,
      heroesHeight: 78,
      heroesWidth:  616,
      roshanGlyph: { xPos: 500, yPos: 1682, size: 212 },
    },
  },
};

/**
 * Get measurements for a given game resolution.
 * Exact match → use it. Otherwise → scale the nearest 16:9 entry.
 */
export function getMeasurements(width, height) {
  const key = `${width}x${height}`;
  if (TABLE[key]) return TABLE[key].inGame;

  // Fallback: scale from 1920x1080 (16:9 baseline) by height ratio
  const base = TABLE['1920x1080'].inGame;
  const s = height / 1080;
  const xs = width / 1920;
  return {
    heroesRadiantBottomLeftXPos: Math.round(base.heroesRadiantBottomLeftXPos * xs),
    heroesDireBottomLeftXPos:    Math.round(base.heroesDireBottomLeftXPos * xs),
    heroesHeight: Math.round(base.heroesHeight * s),
    heroesWidth:  Math.round(base.heroesWidth * xs),
    roshanGlyph: {
      xPos: Math.round(base.roshanGlyph.xPos * xs),
      yPos: Math.round(base.roshanGlyph.yPos * s),
      size: Math.round(base.roshanGlyph.size * s),
    },
    _scaled: true,
  };
}

/**
 * Compute the X center of each of the 5 enemy hero portraits in the topbar.
 * @param {object} m       measurements.inGame
 * @param {boolean} enemyIsDire  true if enemies are on Dire (right) side
 * @returns {number[]} 5 center-X positions
 */
export function enemyHeroSlotsX(m, enemyIsDire) {
  const startX = enemyIsDire ? m.heroesDireBottomLeftXPos : m.heroesRadiantBottomLeftXPos;
  const slotW  = m.heroesWidth / 5;
  return [0, 1, 2, 3, 4].map(i => Math.round(startX + slotW * i + slotW / 2));
}

/**
 * Buyback/Ult button geometry under each hero portrait.
 */
export function topbarButtonGeometry(m) {
  const slotW = m.heroesWidth / 5;
  const S = 0.85;                                   // 15% smaller buttons
  const rowH = Math.round((m.heroesHeight / 2) * S);
  // DotaCoach places buyback at heroesHeight*1.67 — this leaves the band just
  // under the portrait free for Dota's native respawn countdown. The row is
  // also user-draggable (Ctrl+drag) so it can be fine-tuned per setup.
  const buybackY = Math.round(m.heroesHeight * 1.67);
  return {
    slotWidth:  Math.round(slotW),
    buttonW:    Math.round(slotW * 0.92 * S),
    rowH,
    buybackY,
    ultY:       buybackY + rowH + 2,
    fontSize:   Math.max(8, Math.round(m.heroesHeight * 0.28 * S)),
  };
}
