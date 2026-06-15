"""
Saves the buyback icon template from the user-provided screenshot.
Run: python tools/save_buyback_template.py <path_to_screenshot>

Crops the golden coins region from the image and saves it as
assets/templates/buyback_icon.png
"""

import sys
from pathlib import Path
import cv2
import numpy as np

def extract_buyback(src_path: str) -> None:
    img = cv2.imread(src_path)
    if img is None:
        print(f"Cannot read: {src_path}")
        return

    # The coins are roughly the bottom-center of the image the user provided.
    # We'll detect them by finding the golden/yellow cluster.
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Gold color range in HSV
    lower_gold = np.array([15, 100, 150])
    upper_gold = np.array([35, 255, 255])
    mask = cv2.inRange(hsv, lower_gold, upper_gold)

    # Find bounding box of the gold region
    coords = cv2.findNonZero(mask)
    if coords is None:
        print("Could not detect gold region — saving full image as template")
        cropped = img
    else:
        x, y, w, h = cv2.boundingRect(coords)
        pad = 5
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(img.shape[1], x + w + pad)
        y2 = min(img.shape[0], y + h + pad)
        cropped = img[y1:y2, x1:x2]
        print(f"Gold region detected at ({x1},{y1}) → ({x2},{y2}), size {x2-x1}x{y2-y1}")

    out = Path(__file__).parent.parent / "assets" / "templates" / "buyback_icon.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), cropped)
    print(f"Saved → {out}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tools/save_buyback_template.py <screenshot.png>")
        sys.exit(1)
    extract_buyback(sys.argv[1])
