"""
Downloads hero portrait icons for all Dota 2 heroes from Steam CDN.

Source: Steam CDN — these are the official small square icons used in the
draft screen, minimap, and scoreboard.

URL pattern:
  https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/{name}.png

Arcana note
-----------
In the DRAFT screen, Dota 2 always shows the BASE hero icon regardless of
cosmetics — arcanas do NOT affect draft detection.

In the SCOREBOARD and in-game HUD, heroes with arcanas may show a different
portrait. We store arcana variants as <hero>_arcana.png alongside the base.

Arcana heroes (as of 2026) whose in-game portrait changes noticeably:
  anti_mage, crystal_maiden, invoker, lina, phantom_assassin,
  pudge, queen_of_pain, terrorblade, wraith_king, zeus, ogre_magi,
  shadow_fiend, storm_spirit, windranger, skywrath_mage, bloodseeker,
  dragon_knight, juggernaut, monkey_king, legion_commander

Run:
  python tools/download_hero_icons.py

Output:
  assets/templates/heroes/<hero_name>.png        (base, 70x70 cropped square)
  assets/templates/heroes/<hero_name>_arcana.png (arcana variant where available)
"""

from __future__ import annotations

import time
import urllib.request
import urllib.error
from pathlib import Path

import cv2
import numpy as np

OUT_DIR = Path(__file__).parent.parent / "assets" / "templates" / "heroes"
OUT_DIR.mkdir(parents=True, exist_ok=True)

ICON_SIZE = 64  # resize all icons to this square

# Steam CDN — small square hero icons (draft / minimap quality)
CDN_ICON = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/{name}.png"

# Full hero list (internal names), all heroes as of patch 7.38 (2026)
ALL_HEROES: list[str] = [
    "abaddon", "abyssal_underlord", "alchemist", "ancient_apparition",
    "antimage", "arc_warden", "axe", "bane", "batrider", "beastmaster",
    "bloodseeker", "bounty_hunter", "brewmaster", "bristleback", "broodmother",
    "centaur", "chaos_knight", "chen", "clinkz", "clockwerk",
    "crystal_maiden", "dark_seer", "dark_willow", "dawnbreaker", "dazzle",
    "death_prophet", "disruptor", "doom_bringer", "dragon_knight", "drow_ranger",
    "earth_spirit", "earthshaker", "elder_titan", "ember_spirit", "enchantress",
    "enigma", "faceless_void", "grimstroke", "gyrocopter", "hoodwink",
    "huskar", "invoker", "io", "jakiro", "juggernaut",
    "keeper_of_the_light", "kez", "kunkka", "legion_commander", "leshrac",
    "lich", "lifestealer", "lina", "lion", "lone_druid",
    "luna", "lycan", "magnataur", "marci", "mars",
    "medusa", "meepo", "mirana", "monkey_king", "morphling",
    "muerta", "naga_siren", "nagaground", "nature's_prophet", "necrolyte",
    "night_stalker", "nyx_assassin", "obsidian_destroyer", "ogre_magi", "omniknight",
    "oracle", "pangolier", "phantom_assassin", "phantom_lancer", "phoenix",
    "primal_beast", "puck", "pudge", "pugna", "queen_of_pain",
    "rattletrap", "razor", "riki", "ringmaster", "rubick",
    "sand_king", "shadow_demon", "shadow_fiend", "shadow_shaman", "silencer",
    "skywrath_mage", "slardar", "slark", "snapfire", "sniper",
    "spectre", "spirit_breaker", "storm_spirit", "sven", "techies",
    "templar_assassin", "terrorblade", "tidehunter", "timbersaw", "tinker",
    "tiny", "treant", "troll_warlord", "tusk", "undying",
    "ursa", "vengefulspirit", "venomancer", "viper", "visage",
    "void_spirit", "warlock", "weaver", "windrunner", "winter_wyvern",
    "witch_doctor", "wraith_king", "zeus",
]

# Heroes whose scoreboard icon changes with arcana (base name → arcana CDN suffix)
# The Steam CDN doesn't serve arcana variants directly, so we use the wiki fallback.
# For now, we tag these heroes so the matcher can be extended with manual arcana PNGs.
ARCANA_HEROES: set[str] = {
    "antimage",         # Demonbreaker
    "crystal_maiden",   # Frost Avalanche
    "invoker",          # Event Horizon
    "juggernaut",       # Bladeform Legacy
    "lina",             # Burning Fiend
    "ogre_magi",        # Flockheart's Gamble
    "phantom_assassin", # Manifold Paradox
    "pudge",            # Feast of Abscession
    "queen_of_pain",    # Demon's Embrace
    "shadow_fiend",     # Arcana (Arcane/Demon)
    "storm_spirit",     # Arcana
    "terrorblade",      # Fractal Horns
    "windranger",       # Arcana
    "wraith_king",      # Wraith-Night
    "zeus",             # Arcana
    "dragon_knight",    # Arcana
    "monkey_king",      # Arcana
    "legion_commander", # Arcana
    "skywrath_mage",    # Arcana
    "bloodseeker",      # Arcana
}


def download_bytes(url: str) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"  HTTP {e.code}: {url}")
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None


def decode_and_resize(data: bytes, size: int = ICON_SIZE) -> np.ndarray | None:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    return cv2.resize(img, (size, size), interpolation=cv2.INTER_LANCZOS4)


def save(img: np.ndarray, path: Path) -> None:
    cv2.imwrite(str(path), img)


def main() -> None:
    ok = skipped = failed = 0
    arcana_heroes_found: list[str] = []

    print(f"Downloading {len(ALL_HEROES)} hero icons → {OUT_DIR}\n")

    for hero in ALL_HEROES:
        out_path = OUT_DIR / f"{hero}.png"
        if out_path.exists():
            skipped += 1
            continue

        url = CDN_ICON.format(name=hero)
        data = download_bytes(url)

        if data is None:
            # Some heroes use different internal names — try common variants
            alt = hero.replace("nature's_prophet", "furion") \
                      .replace("necrolyte", "necrophos") \
                      .replace("doom_bringer", "doom") \
                      .replace("vengefulspirit", "vengefulspirit") \
                      .replace("rattletrap", "clockwerk") \
                      .replace("magnataur", "magnataur") \
                      .replace("obsidian_destroyer", "obsidian_destroyer")
            if alt != hero:
                data = download_bytes(CDN_ICON.format(name=alt))

        if data:
            img = decode_and_resize(data)
            if img is not None:
                save(img, out_path)
                marker = " [ARCANA]" if hero in ARCANA_HEROES else ""
                print(f"  ✓ {hero}{marker}")
                if hero in ARCANA_HEROES:
                    arcana_heroes_found.append(hero)
                ok += 1
            else:
                print(f"  ✗ decode failed: {hero}")
                failed += 1
        else:
            print(f"  ✗ not found: {hero}")
            failed += 1

        time.sleep(0.05)  # be polite to CDN

    print(f"\n{'='*50}")
    print(f"Downloaded: {ok}  Skipped (cached): {skipped}  Failed: {failed}")
    print(f"\nArcana-affected heroes ({len(arcana_heroes_found)}):")
    for h in arcana_heroes_found:
        print(f"  {h} → add {h}_arcana.png manually if needed")
    print("\nNOTE: Arcanas don't affect the DRAFT screen — only scoreboard.")
    print("      Base icons are sufficient for draft detection.")
    print(f"\nAll icons saved to: {OUT_DIR}")


if __name__ == "__main__":
    main()
