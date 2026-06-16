"""
Scoreboard OCR — reads enemy hero names + levels from a captured frame using
the saved calibration. Hero names are matched (fuzzy) to our hero DB; levels
are read as digits.
"""
from __future__ import annotations

import difflib
import json
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

def _find_tesseract() -> str:
    import os, sys
    # 1) explicit override
    env = os.environ.get("DOTAVIP_TESSERACT")
    if env and os.path.isfile(env):
        return env
    # 2) bundled next to the exe (production): <exe dir>/tesseract/tesseract.exe
    base = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else None
    candidates = []
    if base:
        candidates.append(os.path.join(base, "tesseract", "tesseract.exe"))
        candidates.append(os.path.join(base, "..", "tesseract", "tesseract.exe"))
    # 3) common system installs
    candidates += [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return "tesseract"   # rely on PATH

try:
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = _find_tesseract()
    _HAS_TESS = True
except Exception:
    _HAS_TESS = False

_DB = json.loads((Path(__file__).parent.parent / "assets" / "hero_abilities.json").read_text(encoding="utf-8"))
_NAMES = {v["display_name"].upper(): k for k, v in _DB.items()}


def _ocr_level(cell: np.ndarray) -> Optional[int]:
    if cell.size == 0:
        return None
    g = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
    # Trim to the central area to drop the circular badge ring
    h, w = g.shape
    m = int(min(h, w) * 0.18)
    g = g[m:h - m, m:w - m]
    if g.size == 0:
        return None
    g = cv2.resize(g, None, fx=5, fy=5, interpolation=cv2.INTER_CUBIC)

    _, th = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if th.mean() > 127:
        th = cv2.bitwise_not(th)

    # Remove blobs that touch the border (leftover ring fragments)
    n, lbl, stats, _ = cv2.connectedComponentsWithStats(th, connectivity=8)
    H, W = th.shape
    clean = np.zeros_like(th)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if area < 40:
            continue
        touches = (x <= 1 or y <= 1 or x + bw >= W - 1 or y + bh >= H - 1)
        if touches:
            continue
        clean[lbl == i] = 255
    if clean.sum() < 255 * 30:        # nothing meaningful left → fall back
        clean = th
    clean = cv2.copyMakeBorder(clean, 25, 25, 25, 25, cv2.BORDER_CONSTANT, value=0)

    votes = {}
    for psm in (10, 8, 7, 13):
        txt = pytesseract.image_to_string(
            clean, config=f"--psm {psm} -c tessedit_char_whitelist=0123456789"
        ).strip()
        if txt.isdigit() and 1 <= int(txt) <= 30:
            votes[txt] = votes.get(txt, 0) + 1
    if votes:
        return int(max(votes, key=votes.get))
    return None


import re

# Hero names reduced to letters-only for robust comparison
_NAMES_CLEAN = {re.sub(r"[^A-Z]", "", hn.upper()): key for hn, key in _NAMES.items()}

def _match_name(raw: str) -> tuple[Optional[str], float]:
    clean = re.sub(r"[^A-Z]", "", raw.upper())
    if len(clean) < 2:                      # nothing usable
        return None, 0.0
    # Exact full-string match first. This is the ONLY way a very short hero name
    # like "IO" (Wisp) can match: the WHOLE recognised text must equal "IO".
    # That auto-detects Io when its two letters are read cleanly, while never
    # letting "IO" sneak in as a substring of a longer word / OCR misread.
    exact = _NAMES_CLEAN.get(clean)
    if exact:
        return exact, 1.0
    if len(clean) < 3:                      # 2-char text that isn't an exact hero → don't guess
        return None, 0.0
    best, best_r = None, 0.0
    for hn, key in _NAMES_CLEAN.items():
        # Substring containment counts only for hero names of 3+ letters.
        # Two-letter names like "IO" appear inside many longer names and OCR
        # misreads (e.g. WARLOCK misread as WARIOCK contains "IO"), so they must
        # NOT win by containment — only by the exact match handled above.
        if len(hn) >= 3 and hn in clean:
            cover = len(hn) / len(clean)        # how much of the text the name fills
            if cover >= 0.6:
                return key, 1.0                 # name dominates the text → confident
            cand = 0.6 + 0.3 * cover            # short name inside longer text → likely, not certain
            if cand > best_r:
                best_r, best = cand, key
            continue
        r = difflib.SequenceMatcher(None, hn, clean).ratio()
        if r > best_r:
            best_r, best = r, key
    return (best if best_r >= 0.62 else None), best_r


def _binarizations(crop: np.ndarray):
    """Several binarizations so dim/short hero names survive at least one."""
    g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    outs = []
    # Otsu
    _, o = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if o.mean() > 127: o = cv2.bitwise_not(o)
    outs.append(o)
    # Fixed thresholds (grey text varies in brightness)
    for t in (105, 135, 165):
        _, b = cv2.threshold(g, t, 255, cv2.THRESH_BINARY)
        if b.mean() > 127: b = cv2.bitwise_not(b)
        outs.append(b)
    return [cv2.copyMakeBorder(x, 14, 14, 14, 14, cv2.BORDER_CONSTANT, value=0) for x in outs]


def _ocr_hero(crop: np.ndarray) -> tuple[Optional[str], float, str]:
    best, best_r, best_raw = None, 0.0, ""
    for th in _binarizations(crop):
        for psm in (7, 6):
            raw = pytesseract.image_to_string(
                th, config=f"--psm {psm} -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            )
            hero, r = _match_name(raw)
            if r > best_r:
                best, best_r, best_raw = hero, r, raw.upper().replace("\n", " ").strip()
            if best_r >= 1.0:
                return best, best_r, best_raw
    return best, best_r, best_raw


def ult_level_from_hero_level(level: Optional[int]) -> int:
    """6→1, 12→2, 18→3 (standard ult level rule)."""
    if level is None:
        return 0
    if level >= 18: return 3
    if level >= 12: return 2
    if level >= 6:  return 1
    return 0


def read_scoreboard(frame: np.ndarray, calib: dict, team: str = "dire") -> list[dict]:
    """Read one team's 5 rows. team = the ENEMY side ('radiant' | 'dire').

    Returns up to 5 entries: {slot, hero, level, ult_level, raw_name, name_score}.
    """
    if not _HAS_TESS:
        return []
    lx, lb = calib["level_x"], calib["level_box"]
    nh = calib.get("name_h", 40)
    nl = calib.get("name_left")
    nr = calib.get("name_right")

    # Both-team calibration: pick the requested side. Fallback to legacy flat.
    side = calib.get(team)
    if side:
        rows = side["rows"]; name_ys = side["name_ys"]
    else:
        rows = calib.get("rows", []); name_ys = calib.get("name_ys", [])

    out = []
    for i, y in enumerate(rows):
        lev_cell = frame[y - lb // 2:y + lb // 2, lx - lb // 2:lx + lb // 2]
        level = _ocr_level(lev_cell) if lev_cell.size else None
        # Hero name = consistent horizontal band, Y from each click.
        # Widen a bit (names vary in length) and add vertical margin.
        if i < len(name_ys) and nl is not None and nr is not None:
            cy = name_ys[i]
            x0 = max(0, nl - 45)
            hh = int(nh * 0.75)
            name_crop = frame[cy - hh:cy + hh, x0:nr]
            hero, score, raw = _ocr_hero(name_crop) if name_crop.size else (None, 0.0, "")
        else:
            hero, score, raw = None, 0.0, ""
        out.append({
            "slot": i,
            "hero": hero,
            "level": level,
            "ult_level": ult_level_from_hero_level(level),
            "raw_name": raw,
            "name_score": round(score, 2),
        })
    return out
