"""
Calibration helper (timed): captures the screen after a countdown so we can
measure the enemy level column. Just hold Tab while it counts down.
"""
import sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from capture.screen import ScreenCapture

OUT = Path(__file__).parent.parent / "scoreboard_calib.png"
DELAY = 10

def main():
    sc = ScreenCapture(monitor_index=1).open()
    print(f"Capturing in {DELAY}s — switch to Dota and HOLD Tab now!")
    for i in range(DELAY, 0, -1):
        print(f"  {i}...", flush=True)
        time.sleep(1)
    frame = sc.capture_monitor()
    ScreenCapture.save(frame, str(OUT))
    sc.close()
    print(f"Saved {OUT} ({frame.shape[1]}x{frame.shape[0]})")

if __name__ == "__main__":
    main()
