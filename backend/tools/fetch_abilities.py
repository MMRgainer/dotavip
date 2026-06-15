"""
Downloads full hero + ability data from dotaconstants (GitHub, public).
Produces: assets/hero_abilities.json

Sources:
  heroes list:    https://api.opendota.com/api/heroes
  ability data:   https://raw.githubusercontent.com/odota/dotaconstants/master/build/hero_abilities.json
  ability values: https://raw.githubusercontent.com/odota/dotaconstants/master/build/abilities.json

Run: python tools/fetch_abilities.py
"""

from __future__ import annotations
import json, urllib.request, time
from pathlib import Path

OUT = Path(__file__).parent.parent / "assets" / "hero_abilities.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "dota-overlay/1.0"}

def fetch(url: str) -> dict | list:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def main():
    print("Fetching hero list from OpenDota...")
    heroes_raw = fetch("https://api.opendota.com/api/heroes")
    # id → localized_name, name (npc_dota_hero_antimage → antimage)
    hero_map = {
        h["name"].replace("npc_dota_hero_", ""): h["localized_name"]
        for h in heroes_raw
    }
    print(f"  {len(hero_map)} heroes")

    print("Fetching hero_abilities from dotaconstants...")
    hero_abilities_raw = fetch(
        "https://raw.githubusercontent.com/odota/dotaconstants/master/build/hero_abilities.json"
    )

    print("Fetching ability values from dotaconstants...")
    abilities_raw = fetch(
        "https://raw.githubusercontent.com/odota/dotaconstants/master/build/abilities.json"
    )

    result = {}

    for hero_key, display_name in hero_map.items():
        npc_name = f"npc_dota_hero_{hero_key}"
        hero_ab_info = hero_abilities_raw.get(npc_name, {})
        ability_names = [a for a in hero_ab_info.get("abilities", []) if isinstance(a, str)]

        abilities_out = []
        for ab_name in ability_names:
            ab = abilities_raw.get(ab_name, {})
            if not ab:
                continue
            # Skip hidden / non-combat abilities
            behavior = ab.get("behavior", "")
            if "HIDDEN" in str(behavior).upper():
                continue

            # Extract cooldown array
            cd_raw = ab.get("cd", ab.get("cooldown", ""))
            if not cd_raw and cd_raw != 0:
                continue
            if isinstance(cd_raw, (int, float)):
                cooldowns = [float(cd_raw)]
            elif isinstance(cd_raw, str):
                parts = cd_raw.strip().split()
                try:
                    cooldowns = [float(x) for x in parts if x]
                except ValueError:
                    continue
            elif isinstance(cd_raw, list):
                try:
                    cooldowns = [float(x) for x in cd_raw]
                except (ValueError, TypeError):
                    continue
            else:
                continue

            if not cooldowns or all(c == 0 for c in cooldowns):
                continue  # passive / no cooldown

            # ── Determine true level count ────────────────────────────────────
            # When a cooldown is constant across levels, dotaconstants stores a
            # single value (e.g. Chemical Rage cd="60") even though the ability
            # has 3 levels. The real level count is revealed by the per-level
            # attribute arrays (e.g. bonus_movespeed: ["20","30","40"] → 3).
            level_count = len(cooldowns)
            for attr in ab.get("attrib", []):
                val = attr.get("value")
                if isinstance(val, list) and len(val) > level_count:
                    level_count = len(val)

            # Pad cooldowns to the true level count (constant cd repeats)
            if len(cooldowns) < level_count:
                cooldowns = cooldowns + [cooldowns[-1]] * (level_count - len(cooldowns))

            abilities_out.append({
                "name": ab_name,
                "display_name": ab.get("dname", ab_name),
                "cooldowns": cooldowns,
                "max_level": level_count,
            })

        if abilities_out:
            result[hero_key] = {
                "display_name": display_name,
                "abilities": abilities_out,
            }

    OUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"\nSaved {len(result)} heroes -> {OUT}")
    # Quick preview
    sample = next(iter(result.items()))
    print(f"Sample ({sample[0]}): {[a['display_name'] for a in sample[1]['abilities']]}")

if __name__ == "__main__":
    main()
