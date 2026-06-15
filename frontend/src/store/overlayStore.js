import { create } from 'zustand';

export const useOverlayStore = create((set, get) => ({
  // ── connection ────────────────────────────────────────────────────────────
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // ── game state from GSI ───────────────────────────────────────────────────
  inGame: false,
  gameTime: 0,
  clockTime: 0,
  paused: false,
  localHero: '',
  localTeam: '',   // 'radiant' | 'dire'

  // ── dropdown menu (which enemy slot's ▾ menu is open; null = none) ─────────
  // Lifted into the store so a global click (from the backend mouse hook) can
  // close it, and so only one menu is open at a time.
  openMenuSlot: null,
  openMenu:  (slot) => set({ openMenuSlot: slot }),
  closeMenu: () => set({ openMenuSlot: null }),
  toggleMenu: (slot) => set(s => ({ openMenuSlot: s.openMenuSlot === slot ? null : slot })),

  // ── enemy heroes (5 slots) ────────────────────────────────────────────────
  enemyHeroes: ['', '', '', '', ''],
  enemyUltLevels: [0, 0, 0, 0, 0],   // from scoreboard OCR (0 = ult not yet available)
  // Slots the user assigned BY HAND (hero picker in the ULT menu). Locked from
  // the auto-parser (GSI draft / OCR hero) until the game ends; levels still
  // auto-apply. Reset when a new game starts.
  manualSlots: [false, false, false, false, false],

  // Per-enemy CD modifiers (persist across popup open/close)
  // Octarine Core −25% — applies to ULT and BKB. (Arcane rune removed.)
  enemyMods: [
    { octarine:false }, { octarine:false }, { octarine:false },
    { octarine:false }, { octarine:false },
  ],
  toggleEnemyMod: (slot, key) => set(s => {
    const m = s.enemyMods.map((x, i) => i === slot ? { ...x, [key]: !x[key] } : x);
    return { enemyMods: m };
  }),

  // Which buttons to show per enemy slot. ult on by default (matches old
  // behaviour); bkb optional (not every enemy buys a BKB). Set in the ULT
  // dropdown. Reset on new game.
  enemyOpts: [
    { ult:true, bkb:false }, { ult:true, bkb:false }, { ult:true, bkb:false },
    { ult:true, bkb:false }, { ult:true, bkb:false },
  ],
  toggleEnemyOpt: (slot, key) => set(s => ({
    enemyOpts: s.enemyOpts.map((o, i) => i === slot ? { ...o, [key]: !o[key] } : o),
  })),
  setEnemyHero: (slot, heroKey) =>
    set(s => { const n = [...s.enemyHeroes]; n[slot] = heroKey; return { enemyHeroes: n }; }),
  // Manual pick from the ULT menu — locks the slot from the auto-parser
  setEnemyHeroManual: (slot, heroKey) =>
    set(s => {
      const heroes = [...s.enemyHeroes]; heroes[slot] = heroKey;
      const manual = [...s.manualSlots]; manual[slot] = true;
      return { enemyHeroes: heroes, manualSlots: manual };
    }),
  clearEnemyHeroes: () => set({ enemyHeroes: ['', '', '', '', ''] }),

  // ── Roshan / Aegis / Glyph timers ─────────────────────────────────────────
  // Each is a Date.now() timestamp when started, or null.
  turbo:      false,
  roshanAt:   null,
  aegisAt:    null,
  aegisHero:  '',     // hero key that picked up aegis (from GSI), optional
  glyphAt:    null,

  setTurbo:   (v) => set({ turbo: v }),
  // Roshan kill also auto-starts Aegis
  killRoshan: () => set({ roshanAt: Date.now(), aegisAt: Date.now() }),
  cancelRoshan: () => set({ roshanAt: null, aegisAt: null }),
  startAegis: (hero = '') => set({ aegisAt: Date.now(), aegisHero: hero }),
  cancelAegis: () => set({ aegisAt: null, aegisHero: '' }),
  startGlyph: () => set({ glyphAt: Date.now() }),
  cancelGlyph: () => set({ glyphAt: null }),

  // GSI sequence tracking (null = not yet baselined; set from first state)
  _roshanSeq: null,
  _aegisSeq:  null,

  // ── active timers (cooldowns + buybacks) ──────────────────────────────────
  // { id, type: 'cd'|'bb', slot, heroKey, label, icon, duration, startedAt }
  timers: [],

  startTimer: (t) => set(s => ({
    timers: [
      // replace existing same hero+type+label
      ...s.timers.filter(x => !(x.slot === t.slot && x.type === t.type && x.label === t.label)),
      { ...t, id: Math.random().toString(36).slice(2), startedAt: Date.now() },
    ],
  })),

  pruneTimers: () => set(s => ({
    timers: s.timers.filter(t => (Date.now() - t.startedAt) / 1000 < t.duration),
  })),

  removeTimer: (id) => set(s => ({ timers: s.timers.filter(t => t.id !== id) })),

  // Pause freeze: every timer's remaining time is `duration - (now - anchor)`.
  // While the game is paused we push every anchor forward by the real elapsed
  // time, so the remaining stays put. On resume we stop shifting and the
  // countdowns continue from exactly where they were. Covers ult/buyback/BKB
  // (startedAt) and Roshan/Aegis/Glyph (roshanAt/aegisAt/glyphAt).
  shiftAnchors: (deltaMs) => set(s => ({
    timers:   s.timers.map(t => ({ ...t, startedAt: t.startedAt + deltaMs })),
    roshanAt: s.roshanAt != null ? s.roshanAt + deltaMs : null,
    aegisAt:  s.aegisAt  != null ? s.aegisAt  + deltaMs : null,
    glyphAt:  s.glyphAt  != null ? s.glyphAt  + deltaMs : null,
  })),

  // Per-game state tracking (match_seq from backend; grows on every new map)
  _matchSeq: null,
  _gameOver: false,

  // ── server state apply ────────────────────────────────────────────────────
  applyState: (data) => {
    // ── New game? Reset everything per-game (manual picks, heroes, timers) ──
    const matchSeq = data.match_seq ?? 0;
    const prevSeq  = get()._matchSeq;
    const isNewGame = prevSeq !== null && matchSeq > prevSeq;
    if (isNewGame || prevSeq === null) {
      // baseline (first message) or reset (new map)
      if (isNewGame) {
        set({
          enemyHeroes:    ['', '', '', '', ''],
          enemyUltLevels: [0, 0, 0, 0, 0],
          manualSlots:    [false, false, false, false, false],
          enemyMods: [
            { octarine:false }, { octarine:false }, { octarine:false },
            { octarine:false }, { octarine:false },
          ],
          enemyOpts: [
            { ult:true, bkb:false }, { ult:true, bkb:false }, { ult:true, bkb:false },
            { ult:true, bkb:false }, { ult:true, bkb:false },
          ],
          timers: [],
          roshanAt: null, aegisAt: null, aegisHero: '', glyphAt: null,
        });
      }
      set({ _matchSeq: matchSeq });
    }

    // ── Game over → unlock manual picks (next game auto-detects as usual) ───
    const gameOver = !!data.game_over;
    if (gameOver && !get()._gameOver) {
      set({ manualSlots: [false, false, false, false, false] });
    }

    const manual = get().manualSlots;
    const newEnemies = data.draft ?? ['', '', '', '', ''];
    const cur = get().enemyHeroes;

    // Merge: fill empty slots, never overwrite manually set heroes
    const next = [...cur];
    const occupied = new Set(next.filter(Boolean));
    newEnemies.forEach((hero, i) => {
      if (!hero) return;
      if (occupied.has(hero)) return;
      if (manual[i]) return;                  // hand-picked slot is locked
      if (!next[i]) {
        next[i] = hero;
        occupied.add(hero);
      }
    });

    const patch = {
      inGame:    data.in_game   ?? false,
      gameTime:  data.game_time ?? 0,
      clockTime: data.clock_time ?? 0,
      paused:    data.paused ?? false,
      _gameOver: gameOver,
      localHero: data.local_hero ?? '',
      localTeam: data.local_team ?? '',
      enemyHeroes: next,
    };

    // ── Scoreboard OCR (Tab) → auto-fill enemy heroes + ult levels ──────────
    const sb = data.enemy_scoreboard;
    if (Array.isArray(sb) && sb.length) {
      const heroes = [...next];
      const ults = [...get().enemyUltLevels];
      for (const e of sb) {
        if (e.slot == null) continue;
        // OCR-detected hero wins — unless the user set this slot by hand
        if (e.hero && !manual[e.slot]) heroes[e.slot] = e.hero;
        // levels ALWAYS apply, even on manually locked slots
        if (e.ult_level != null) ults[e.slot] = e.ult_level;
      }
      patch.enemyHeroes = heroes;
      patch.enemyUltLevels = ults;
    }

    // ── Auto-detect Roshan / Aegis from GSI sequence counters ───────────────
    const s = get();
    const rSeq = data.roshan_kill_seq ?? 0;
    const aSeq = data.aegis_seq ?? 0;

    // Back-date the start to the actual GAME-TIME of the event, so detection
    // delay (GSI events can lag a few seconds) doesn't skew the timer.
    const gt    = data.game_time ?? 0;
    const rKillGt = data.roshan_kill_gt ?? gt;
    const aGt     = data.aegis_gt ?? gt;
    const rAnchor = Date.now() - Math.max(0, gt - rKillGt) * 1000;
    const aAnchor = Date.now() - Math.max(0, gt - aGt) * 1000;

    // First message after connecting → just baseline, never trigger.
    if (s._roshanSeq === null || s._aegisSeq === null) {
      patch._roshanSeq = rSeq;
      patch._aegisSeq  = aSeq;
    } else {
      if (rSeq > s._roshanSeq) {
        patch._roshanSeq = rSeq;
        patch.roshanAt   = rAnchor;
        patch.aegisAt    = aAnchor;
      }
      if (aSeq > s._aegisSeq) {
        patch._aegisSeq = aSeq;
        patch.aegisAt   = aAnchor;
      }
    }

    set(patch);
  },

  // ── hero / ability data ───────────────────────────────────────────────────
  heroList: [],
  setHeroList: (list) => set({ heroList: list }),
  abilityMap: {},
  setAbilities: (hero, abilities) =>
    set(s => ({ abilityMap: { ...s.abilityMap, [hero]: abilities } })),
}));
