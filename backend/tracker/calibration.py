"""
Scoreboard calibration.

The user opens the Tab scoreboard, we capture it, and they click on a few
reference points (first/last enemy level number, first enemy portrait). From
those we derive the per-row capture regions for level digits and hero portraits.

Stored per resolution ("2560x1440") so a calibration is reused next time and
can ship as a preset for common resolutions.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from capture.screen import ScreenCapture

_CALIB_PATH = Path(__file__).parent.parent / "assets" / "scoreboard_calibration.json"


# ── capture ──────────────────────────────────────────────────────────────────

def grab_png_base64(monitor_index: int = 1) -> tuple[str, int, int]:
    """Capture the monitor and return (base64 png, width, height)."""
    sc = ScreenCapture(monitor_index=monitor_index).open()
    try:
        frame = sc.capture_monitor()
    finally:
        sc.close()
    h, w = frame.shape[:2]
    ok, buf = cv2.imencode(".png", frame)
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return b64, w, h


# ── storage ──────────────────────────────────────────────────────────────────

def _load_all() -> dict:
    if _CALIB_PATH.exists():
        try:
            return json.loads(_CALIB_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def _save_all(data: dict) -> None:
    _CALIB_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CALIB_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")

def get_calibration(width: int, height: int) -> Optional[dict]:
    return _load_all().get(f"{width}x{height}")

def save_calibration(calib: dict) -> None:
    """calib must contain width, height, level_x, portrait_x, portrait_w,
    portrait_h, level_box, rows (list of 5 y-centers for enemies)."""
    data = _load_all()
    data[f"{calib['width']}x{calib['height']}"] = calib
    _save_all(data)


def _interp5(y0: float, y1: float) -> list[int]:
    return [round(y0 + (y1 - y0) * i / 4) for i in range(5)]


def build_from_clicks(width: int, height: int,
                      level_first: dict,
                      radiant_first: dict, radiant_last: dict,
                      dire_first: dict, dire_last: dict) -> dict:
    """
    Derive BOTH-team calibration from 5 clicks (image pixel coords):
      level_first   = {x,y}  level number of Radiant row 1 (top team, 1st row)
      radiant_first = {x,y}  hero NAME of Radiant row 1
      radiant_last  = {x,y}  hero NAME of Radiant row 5
      dire_first    = {x,y}  hero NAME of Dire row 1 (bottom team)
      dire_last     = {x,y}  hero NAME of Dire row 5

    Columns (level_x, name band) are shared by both teams; only row Y differ.
    """
    level_x = round(level_first["x"])
    dy = round(radiant_first["y"]) - round(level_first["y"])   # name line below level line

    rad_name_ys = _interp5(radiant_first["y"], radiant_last["y"])
    dire_name_ys = _interp5(dire_first["y"], dire_last["y"])

    row_h = abs(rad_name_ys[1] - rad_name_ys[0]) if len(rad_name_ys) > 1 else 40
    level_box = max(22, round(row_h * 0.7))

    name_xs = [round(c["x"]) for c in (radiant_first, radiant_last, dire_first, dire_last)]
    name_left = max(0, min(name_xs) - 80)
    name_right = level_x - round(level_box * 0.9)
    if name_right <= name_left:
        name_right = name_left + 220
    name_h = max(18, round(row_h * 0.52))

    return {
        "width": width, "height": height,
        "level_x": level_x,
        "level_box": level_box,
        "name_left": name_left,
        "name_right": name_right,
        "name_h": name_h,
        "radiant": {"name_ys": rad_name_ys,  "rows": [y - dy for y in rad_name_ys]},
        "dire":    {"name_ys": dire_name_ys, "rows": [y - dy for y in dire_name_ys]},
    }
