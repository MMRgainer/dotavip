"""
Test hero portrait recognition.

Downloads reference hero cards (cached), then matches each of the 5 captured
enemy portraits (from calib_portraits.png) against the reference DB and prints
the best guesses. Lets us validate reliability before wiring it in.
"""
import sys, json, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import cv2, numpy as np

REF_DIR = Path(__file__).parent.parent / "assets" / "hero_portraits"
REF_DIR.mkdir(parents=True, exist_ok=True)
DB = json.load(open(Path(__file__).parent.parent / "assets" / "hero_abilities.json", encoding="utf-8"))
CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/{}.png"

CANON = (64, 36)   # canonical match size (w,h)

def download_refs():
    keys = list(DB.keys())
    for i, k in enumerate(keys):
        p = REF_DIR / f"{k}.png"
        if p.exists(): continue
        try:
            req = urllib.request.Request(CDN.format(k), headers={"User-Agent":"x"})
            p.write_bytes(urllib.request.urlopen(req, timeout=15).read())
        except Exception as e:
            print("fail", k, e)
        if i % 20 == 0: print(f"  {i}/{len(keys)}")
    print("refs ready")

def load_canon(path_or_img):
    img = cv2.imread(str(path_or_img)) if isinstance(path_or_img,(str,Path)) else path_or_img
    if img is None: return None
    img = cv2.resize(img, CANON)
    return img

def score(a, b):
    # combine grayscale correlation + color histogram correlation
    ag = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bg = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY).astype(np.float32)
    ag=(ag-ag.mean()); bg=(bg-bg.mean())
    denom = (np.sqrt((ag**2).sum())*np.sqrt((bg**2).sum()) + 1e-6)
    corr = float((ag*bg).sum()/denom)
    # color hist
    ha = cv2.calcHist([a],[0,1,2],None,[8,8,8],[0,256]*3); cv2.normalize(ha,ha)
    hb = cv2.calcHist([b],[0,1,2],None,[8,8,8],[0,256]*3); cv2.normalize(hb,hb)
    hist = float(cv2.compareHist(ha,hb,cv2.HISTCMP_CORREL))
    return 0.6*corr + 0.4*hist

def main():
    download_refs()
    refs = {p.stem: load_canon(p) for p in REF_DIR.glob("*.png")}
    refs = {k:v for k,v in refs.items() if v is not None}
    print(f"{len(refs)} reference portraits\n")

    montage = cv2.imread(str(Path(__file__).parent.parent / "calib_portraits.png"))
    # vstack of 5 x (160x90)
    for i in range(5):
        port = montage[i*90:(i+1)*90, 0:160]
        c = load_canon(port)
        ranked = sorted(((score(c,r), k) for k,r in refs.items()), reverse=True)
        top = ranked[:3]
        print(f"Portrait {i+1}: " + ", ".join(f"{k}({s:.2f})" for s,k in top))

if __name__ == "__main__":
    main()
