"""Capture the scoreboard (timed) and crop the calibrated enemy level + portrait
regions into a montage, so we can verify calibration and see image quality."""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import cv2, numpy as np
from capture.screen import ScreenCapture
from tracker import calibration

DELAY = 8

def main():
    print(f"Hold Tab in a Dota match — capturing in {DELAY}s")
    for i in range(DELAY,0,-1): print(f"  {i}...", flush=True); time.sleep(1)
    sc = ScreenCapture(monitor_index=1).open()
    frame = sc.capture_monitor(); sc.close()
    h,w = frame.shape[:2]
    calib = calibration.get_calibration(w,h)
    if not calib:
        print(f"No calibration for {w}x{h}"); return

    lx, lb = calib["level_x"], calib["level_box"]
    px, pw, ph = calib["portrait_x"], calib["portrait_w"], calib["portrait_h"]
    levels, ports = [], []
    for y in calib["rows"]:
        lv = frame[y-lb//2:y+lb//2, lx-lb//2:lx+lb//2]
        po = frame[y-ph//2:y+ph//2, px-pw//2:px+pw//2]
        levels.append(cv2.resize(lv,(80,80)))
        ports.append(cv2.resize(po,(160,90)))
    # Save montages
    cv2.imwrite("calib_levels.png", np.hstack(levels))
    cv2.imwrite("calib_portraits.png", np.vstack(ports))
    print("Saved calib_levels.png and calib_portraits.png")

if __name__ == "__main__":
    main()
