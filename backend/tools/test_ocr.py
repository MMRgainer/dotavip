import sys, time, json, difflib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import cv2, numpy as np, pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from capture.screen import ScreenCapture
from tracker import calibration

DB = json.load(open(Path(__file__).parent.parent/"assets"/"hero_abilities.json", encoding="utf-8"))
NAMES = {v["display_name"].upper(): k for k,v in DB.items()}

def ocr_level(cell):
    g = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    _, th = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    if th.mean() > 127: th = cv2.bitwise_not(th)   # ensure digit is white
    return pytesseract.image_to_string(th, config='--psm 8 -c tessedit_char_whitelist=0123456789').strip()

def ocr_name(crop):
    g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    _, th = cv2.threshold(g, 150, 255, cv2.THRESH_BINARY)
    txt = pytesseract.image_to_string(th, config='--psm 6').upper()
    # match any line/token to a hero name
    best=None; bestr=0
    for hn,key in NAMES.items():
        r = difflib.SequenceMatcher(None, hn, txt.replace("\n"," ")).ratio()
        # also substring check
        if hn in txt: r = 1.0
        if r>bestr: bestr=r; best=key
    return best, bestr, txt.strip().replace("\n"," ")

print("Hold Tab — 8s"); 
for i in range(8,0,-1): print(i,end=" ",flush=True); time.sleep(1)
print()
sc=ScreenCapture(monitor_index=1).open(); frame=sc.capture_monitor(); sc.close()
h,w=frame.shape[:2]; c=calibration.get_calibration(w,h)
lx,lb=c["level_x"],c["level_box"]; px,pw=c["portrait_x"],c["portrait_w"]
name_x0 = px + pw//2 + 8
for i,y in enumerate(c["rows"]):
    lev = frame[y-lb//2:y+lb//2, lx-lb//2:lx+lb//2]
    nm  = frame[y-22:y+26, name_x0:name_x0+210]
    L = ocr_level(lev)
    hero,score,raw = ocr_name(nm)
    print(f"Row {i+1}: level='{L}'  hero={hero} ({score:.2f}) raw='{raw}'")
