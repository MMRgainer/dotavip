"""
Live monitor — captures Dota monitor and prints all detections.

Kill feed : ~4fps in main thread (fast, ~12ms).
Draft     : background thread, every 5s (slow: ~0.5s with scale=0.25).
Buyback   : main thread, every 1s.
"""

import sys, time, threading
sys.stdout.reconfigure(line_buffering=True)
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
from datetime import datetime

from capture.screen  import ScreenCapture
from capture.regions import get_profile
from ocr.reader      import KillFeedReader
from cv.matcher      import HeroMatcher, BuybackDetector

MONITOR = 1
PROFILE = get_profile("2560x1440")
READER  = KillFeedReader()
HEROES  = HeroMatcher()
BUYBACK = BuybackDetector()

BUYBACK_ROWS = [
    {"left": 1900, "top": 195, "width": 60, "height": 55},
    {"left": 1900, "top": 308, "width": 60, "height": 55},
    {"left": 1900, "top": 421, "width": 60, "height": 55},
    {"left": 1900, "top": 534, "width": 60, "height": 55},
    {"left": 1900, "top": 647, "width": 60, "height": 55},
]

def ts():
    return datetime.now().strftime("%H:%M:%S")

# ── Draft background thread ───────────────────────────────────────────────────
_draft_result: list[str] = []
_draft_lock   = threading.Lock()

def _draft_loop():
    """Runs template matching every 5s in background — doesn't block kill feed."""
    global _draft_result
    prev = []
    while True:
        try:
            with ScreenCapture(monitor_index=MONITOR) as sc:
                frame = sc.capture_relative(PROFILE.draft)
            t0 = time.monotonic()
            matches = HEROES.find_all(frame)
            elapsed = time.monotonic() - t0
            heroes  = sorted({m.name for m in matches})
            with _draft_lock:
                _draft_result = heroes
            if heroes != prev:
                prev = heroes
                if heroes:
                    print(f"[{ts()}] DRAFT ({elapsed:.2f}s): {heroes}", flush=True)
        except Exception as e:
            print(f"[{ts()}] draft ERR: {e}", flush=True)
        time.sleep(5)

# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    print(f"[{ts()}] Live monitor started — monitor {MONITOR}, 2560x1440", flush=True)
    print(f"[{ts()}] Kill feed: 4fps | Draft: bg thread/5s | Buyback: 1s", flush=True)
    print(f"[{ts()}] Dashboard: http://localhost:5173", flush=True)
    print(flush=True)

    # Start draft thread
    t = threading.Thread(target=_draft_loop, daemon=True)
    t.start()

    prev_kf_text   = ""
    cycle          = 0
    last_buyback_t = 0.0
    last_heartbeat = 0.0
    bands          = []

    with ScreenCapture(monitor_index=MONITOR) as sc:
        while True:
            t0  = time.monotonic()
            now = t0
            cycle += 1

            # ── Kill feed ──────────────────────────────────────────────────
            try:
                kf     = sc.capture_relative(PROFILE.kill_feed)
                bands  = READER._extract_bands(kf)
                text   = READER.read_text(kf)
                roshan = READER.detect_roshan_kill(kf)

                if text.strip() and text.strip() != prev_kf_text:
                    prev_kf_text = text.strip()
                    print(f"[{ts()}] KILL FEED ({len(bands)} bands): {text.strip()!r}", flush=True)
                    if roshan:
                        print(f"[{ts()}] *** ROSHAN KILLED ***", flush=True)
                        cv2.imwrite("roshan_capture.png", kf)
                elif not text.strip():
                    prev_kf_text = ""
            except Exception as e:
                print(f"[{ts()}] kf ERR: {e}", flush=True)

            # ── Buyback ────────────────────────────────────────────────────
            if now - last_buyback_t >= 1.0:
                last_buyback_t = now
                try:
                    sb = sc.capture_relative(PROFILE.scoreboard)
                    bb = BUYBACK.detect_all_enemies(sb, BUYBACK_ROWS)
                    if any(bb):
                        print(f"[{ts()}] BUYBACK: {['BB' if b else '--' for b in bb]}", flush=True)
                except Exception:
                    pass

            # ── Heartbeat every 10s ───────────────────────────────────────
            if now - last_heartbeat >= 10.0:
                last_heartbeat = now
                print(f"[{ts()}] heartbeat  cycle={cycle}  bands={len(bands)}", flush=True)

            elapsed = time.monotonic() - t0
            time.sleep(max(0, 0.25 - elapsed))

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n[{ts()}] Stopped.")
