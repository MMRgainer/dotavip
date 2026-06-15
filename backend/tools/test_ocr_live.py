"""
Live OCR test — kill feed band detection + Tesseract.
Run: .venv\\Scripts\\python tools/test_ocr_live.py [iterations]

Saves debug images each cycle:
  kill_feed_raw.png     — raw captured region
  kf_debug_mask.png     — white-pixel mask (should light up when kills happen)
  kf_debug_band_N.png   — each detected kill feed band
"""

import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
from capture.screen import ScreenCapture
from capture.regions import get_profile
from ocr.reader import KillFeedReader

MONITOR = 1
PROFILE = get_profile("2560x1440")
READER  = KillFeedReader()
ITERS   = int(sys.argv[1]) if len(sys.argv) > 1 else 999

def main():
    print("=== Kill Feed OCR Test === (Ctrl+C to stop)")
    print("Waiting for kills in the kill feed...\n")

    with ScreenCapture(monitor_index=MONITOR) as sc:
        for i in range(ITERS):
            frame = sc.capture_relative(PROFILE.kill_feed)
            cv2.imwrite("kill_feed_raw.png", frame)

            # Save debug images (mask + bands)
            READER.save_debug(frame, "kf_debug")

            bands = READER._extract_bands(frame)
            text  = READER.read_text(frame)
            roshan = READER.detect_roshan_kill(frame)

            print(f"[{i:03d}] bands={len(bands)}", end="")
            if text.strip():
                print(f"  →  {text.strip()!r}", end="")
            else:
                print("  (no text)", end="")
            if roshan:
                print("  🔴 ROSHAN!", end="")
            print()

            time.sleep(1.5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
