"""
Visual region calibration tool.

Captures monitor 1 (Dota), draws colored rectangles for every defined
region, and saves to calibration.png. Open the image to verify alignment.

Run from backend/:
    .venv\\Scripts\\python tools/calibrate_regions.py

Optional: pass a screenshot path to skip live capture:
    .venv\\Scripts\\python tools/calibrate_regions.py screenshot.png
"""

import sys
from pathlib import Path
import cv2
import numpy as np

# Allow imports from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from capture.screen import ScreenCapture
from capture.regions import get_profile

MONITOR_INDEX = 1          # Dota monitor (mss index 1 = 2560x1440)
RESOLUTION    = "2560x1440"

# Region → (BGR color, label)
REGION_STYLE = {
    "kill_feed":  ((0, 255, 255),  "KILL FEED"),    # yellow
    "scoreboard": ((255, 128, 0),  "SCOREBOARD"),   # blue
    "draft":      ((0, 255, 0),    "DRAFT"),         # green
    "minimap":    ((255, 0, 255),  "MINIMAP"),       # magenta
}

def draw_region(img: np.ndarray, region: dict, color: tuple, label: str) -> None:
    x1 = region["left"]
    y1 = region["top"]
    x2 = x1 + region["width"]
    y2 = y1 + region["height"]

    # Clamp to image bounds
    h, w = img.shape[:2]
    x1c, y1c = max(0, x1), max(0, y1)
    x2c, y2c = min(w, x2), min(h, y2)

    # Semi-transparent fill
    overlay = img.copy()
    cv2.rectangle(overlay, (x1c, y1c), (x2c, y2c), color, -1)
    cv2.addWeighted(overlay, 0.15, img, 0.85, 0, img)

    # Solid border
    cv2.rectangle(img, (x1c, y1c), (x2c, y2c), color, 3)

    # Label background + text
    font      = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1.0
    thickness  = 2
    (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)
    tx = x1c + 8
    ty = y1c + th + 8
    cv2.rectangle(img, (tx - 4, ty - th - 4), (tx + tw + 4, ty + baseline), (0, 0, 0), -1)
    cv2.putText(img, label, (tx, ty), font, font_scale, color, thickness, cv2.LINE_AA)

    # Dimensions annotation
    dim_label = f"{region['width']}x{region['height']} @ ({x1},{y1})"
    (dw, dh), _ = cv2.getTextSize(dim_label, font, 0.55, 1)
    cv2.rectangle(img, (x1c + 6, y2c - dh - 10), (x1c + dw + 14, y2c - 2), (0, 0, 0), -1)
    cv2.putText(img, dim_label, (x1c + 10, y2c - 6), font, 0.55, color, 1, cv2.LINE_AA)


def main():
    profile = get_profile(RESOLUTION)

    if len(sys.argv) > 1:
        # Load from file
        src = sys.argv[1]
        frame = cv2.imread(src)
        if frame is None:
            print(f"Cannot read: {src}")
            sys.exit(1)
        print(f"Loaded screenshot: {src}  ({frame.shape[1]}x{frame.shape[0]})")
    else:
        # Live capture
        print(f"Capturing monitor {MONITOR_INDEX}...")
        with ScreenCapture(monitor_index=MONITOR_INDEX) as sc:
            mon = sc.get_monitor()
            print(f"  Monitor: {mon['width']}x{mon['height']} @ ({mon['left']},{mon['top']})")
            frame = sc.capture_monitor()
        print(f"  Frame: {frame.shape[1]}x{frame.shape[0]}")

    annotated = frame.copy()

    for zone, (color, label) in REGION_STYLE.items():
        region = getattr(profile, zone)
        draw_region(annotated, region, color, label)
        print(f"  {label:12s}  left={region['left']:4d}  top={region['top']:4d}  "
              f"w={region['width']:4d}  h={region['height']:4d}")

    out = Path(__file__).parent.parent / "calibration.png"
    cv2.imwrite(str(out), annotated)
    print(f"\nSaved → {out}")
    print("Open calibration.png and check that the colored boxes align with the HUD.")
    print()
    print("If they are off, adjust the values in backend/capture/regions.py")
    print("and re-run this script until they match.")


if __name__ == "__main__":
    main()
