import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import cv2, numpy as np
REF_DIR = Path(__file__).parent.parent / "assets" / "hero_portraits"
def face_crop_ref(img):
    h,w = img.shape[:2]
    # scoreboard shows roughly center face; crop center 64% and slightly upper
    x0,x1 = int(w*0.18), int(w*0.82); y0,y1 = int(h*0.05), int(h*0.85)
    return img[y0:y1, x0:x1]
def canon(img, face=False):
    if face: img = face_crop_ref(img)
    return cv2.resize(img,(48,48))
def score(a,b):
    ag=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY).astype(np.float32);bg=cv2.cvtColor(b,cv2.COLOR_BGR2GRAY).astype(np.float32)
    ag-=ag.mean();bg-=bg.mean()
    corr=float((ag*bg).sum()/(np.sqrt((ag**2).sum()*(bg**2).sum())+1e-6))
    ha=cv2.calcHist([a],[0,1,2],None,[8,8,8],[0,256]*3);cv2.normalize(ha,ha)
    hb=cv2.calcHist([b],[0,1,2],None,[8,8,8],[0,256]*3);cv2.normalize(hb,hb)
    return 0.5*corr+0.5*float(cv2.compareHist(ha,hb,cv2.HISTCMP_CORREL))
refs={p.stem:canon(cv2.imread(str(p)),face=True) for p in REF_DIR.glob("*.png") if cv2.imread(str(p)) is not None}
montage=cv2.imread("calib_portraits.png")
for i in range(5):
    port=montage[i*90:(i+1)*90,0:160]
    c=canon(port)
    ranked=sorted(((score(c,r),k) for k,r in refs.items()),reverse=True)[:3]
    print(f"Portrait {i+1}: "+", ".join(f"{k}({s:.2f})" for s,k in ranked))
