"""
Downloads large hero portrait images (256×144) from Steam CDN.
These match the in-game top bar hero portraits for template matching.
Output: assets/templates/portraits/<hero>.png  (resized to 78×58 for slot matching)
"""
import sys, time, urllib.request, urllib.error
sys.path.insert(0, '.')
import cv2, numpy as np
from pathlib import Path

OUT = Path("assets/templates/portraits")
OUT.mkdir(parents=True, exist_ok=True)

SLOT_W, SLOT_H = 78, 58
CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{name}.png"
HEADERS = {"User-Agent": "Mozilla/5.0"}

# Same hero list as icons, with CDN name fixes
from tools.download_hero_icons import ALL_HEROES

def download(hero, cdn_name):
    out = OUT / f"{hero}.png"
    if out.exists():
        return "cached"
    url = CDN.format(name=cdn_name)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as r:
            data = r.read()
        arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return "decode_fail"
        resized = cv2.resize(img, (SLOT_W, SLOT_H), interpolation=cv2.INTER_LANCZOS4)
        cv2.imwrite(str(out), resized)
        return f"ok {img.shape[1]}x{img.shape[0]}"
    except Exception as e:
        return f"fail: {e}"

cdn_name_map = {
    "clockwerk":    "rattletrap",
    "io":           "wisp",
    "lifestealer":  "life_stealer",
    "queen_of_pain":"queenofpain",
    "shadow_fiend": "nevermore",
    "timbersaw":    "shredder",
    "wraith_king":  "skeleton_king",
    "zeus":         "zuus",
    "nagaground":   None,
}

ok = skip = fail = 0
for hero in ALL_HEROES:
    if hero == "nagaground":
        continue
    cdn = cdn_name_map.get(hero, hero)
    result = download(hero, cdn)
    if result == "cached":
        skip += 1
    elif result.startswith("ok"):
        print(f"  ✓ {hero}  {result}")
        ok += 1
    else:
        print(f"  ✗ {hero}  {result}")
        fail += 1
    time.sleep(0.04)

print(f"\nDone: {ok} downloaded, {skip} cached, {fail} failed")
print(f"Portraits saved to: {OUT}")
