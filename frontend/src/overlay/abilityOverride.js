/**
 * Heroes whose "ult" button should track a NON-ultimate ability instead of the
 * real ultimate (because the basic skill is the cooldown worth watching).
 *
 * Currently only Undying: the ult button tracks Tombstone (his 3rd skill). Its
 * cooldown depends on the SKILL level, which in turn follows the hero level:
 *   hero lvl 1-2 → skill 1, 3-4 → skill 2, 5-6 → skill 3, 7+ → skill 4
 *   i.e. skillLevel = clamp(ceil(heroLevel / 2), 1, 4)
 *
 * `ability` is the ability key as it appears in the hero ability DB.
 */
export const ULT_OVERRIDE = {
  undying: {
    ability: 'undying_tombstone',
    skillLevel: (heroLevel) => Math.min(4, Math.max(1, Math.ceil((heroLevel || 1) / 2))),
  },
};

/** Resolve the ability the ult button should track for this hero, or null. */
export function overrideAbility(heroKey, abilities) {
  const ov = ULT_OVERRIDE[heroKey];
  if (!ov || !abilities) return null;
  return abilities.find(a => a.name === ov.ability) || null;
}

/** Skill level to use for the override ability given the enemy's hero level. */
export function overrideLevel(heroKey, heroLevel) {
  const ov = ULT_OVERRIDE[heroKey];
  return ov ? ov.skillLevel(heroLevel) : null;
}
