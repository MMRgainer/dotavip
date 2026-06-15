"""
Quick capture smoke-test.

Usage (from backend/ with the venv active):
    python test_capture.py [monitor_index]

What it does
------------
1. Lists all connected monitors with their geometry.
2. Captures monitor 1 (or the index given on the CLI) in full.
3. Saves it as test.png next to this script.
4. Prints a resolution-matched summary of the Dota 2 screen zones.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

from capture.screen import ScreenCapture
from capture.regions import get_profile, DEFAULT_RESOLUTION


def main() -> None:
    # Allow overriding the monitor index from the command line
    monitor_index = int(sys.argv[1]) if len(sys.argv) > 1 else 1

    print("=" * 60)
    print("  Dota Overlay — Screen Capture Test")
    print("=" * 60)

    with ScreenCapture(monitor_index=monitor_index) as sc:

        # ── 1. List all monitors ───────────────────────────────────────────
        monitors = sc.list_monitors()
        print(f"\nFound {len(monitors) - 1} physical monitor(s):")
        print(f"  [0] Virtual combined desktop")
        for i, mon in enumerate(monitors[1:], start=1):
            marker = " ← capturing this one" if i == monitor_index else ""
            print(
                f"  [{i}] {mon['width']}x{mon['height']}"
                f"  @ ({mon['left']}, {mon['top']}){marker}"
            )

        # ── 2. Capture the chosen monitor ──────────────────────────────────
        target = sc.get_monitor()
        print(
            f"\nCapturing monitor {monitor_index}: "
            f"{target['width']}x{target['height']} @ "
            f"({target['left']}, {target['top']}) ..."
        )

        t0 = time.perf_counter()
        frame = sc.capture_monitor()
        elapsed_ms = (time.perf_counter() - t0) * 1000

        print(f"  Captured in {elapsed_ms:.1f} ms")
        print(f"  Frame shape : {frame.shape}  (H × W × channels)")
        print(f"  dtype       : {frame.dtype}")

        # ── 3. Save to test.png ────────────────────────────────────────────
        out_path = Path(__file__).parent / "test.png"
        sc.save(frame, str(out_path))
        print(f"\n  Saved → {out_path}")

    # ── 4. Print Dota 2 zone info ──────────────────────────────────────────
    # Auto-detect resolution from the captured monitor
    res_str = f"{target['width']}x{target['height']}"
    try:
        profile = get_profile(res_str)
        print(f"\nDota 2 regions for {profile.resolution}:")
    except ValueError:
        profile = get_profile(DEFAULT_RESOLUTION)
        print(
            f"\nResolution '{res_str}' not in registry — "
            f"showing default ({DEFAULT_RESOLUTION}):"
        )

    for zone, region in profile.all().items():
        print(
            f"  {zone:<12} left={region['left']:>4}  top={region['top']:>4}  "
            f"w={region['width']:>4}  h={region['height']:>4}"
        )

    print("\n" + "=" * 60)
    print("  Test complete. Open test.png to verify the capture.")
    print("=" * 60)


if __name__ == "__main__":
    main()
