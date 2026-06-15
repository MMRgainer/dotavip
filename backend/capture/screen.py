"""
Screen capture module using mss.

Supports 1080p / 1440p / 4K via config-driven resolution selection.
All coordinates are stored in regions.py; this module only handles the
raw pixel grab and format conversion.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Generator

import mss
import mss.tools
import numpy as np
from mss.base import MSSBase
from PIL import Image

logger = logging.getLogger(__name__)


class ScreenCapture:
    """
    Grab rectangular regions from any connected monitor.

    Parameters
    ----------
    monitor_index:
        1-based mss monitor index (0 = virtual combined desktop).
        On a two-monitor setup, 1 = primary, 2 = secondary.
    scale_factor:
        Pixel density multiplier for HiDPI / Retina screens.
        Windows usually reports physical pixels, so leave as 1.0
        unless you are seeing doubled coordinates.
    """

    def __init__(self, monitor_index: int = 1, scale_factor: float = 1.0) -> None:
        self.monitor_index = monitor_index
        self.scale_factor = scale_factor
        self._sct: MSSBase | None = None

    # ── lifecycle ──────────────────────────────────────────────────────────────

    def open(self) -> "ScreenCapture":
        """Open the underlying mss context. Call before any grab."""
        if self._sct is None:
            self._sct = mss.mss()
            logger.debug("mss context opened (monitor %d)", self.monitor_index)
        return self

    def close(self) -> None:
        """Release the mss context and OS resources."""
        if self._sct is not None:
            self._sct.close()
            self._sct = None
            logger.debug("mss context closed")

    def __enter__(self) -> "ScreenCapture":
        return self.open()

    def __exit__(self, *_: object) -> None:
        self.close()

    @contextmanager
    def _ensure_open(self) -> Generator[MSSBase, None, None]:
        """Yield the sct handle, opening it temporarily if needed."""
        if self._sct is not None:
            yield self._sct
        else:
            with mss.mss() as sct:
                yield sct

    # ── monitor info ───────────────────────────────────────────────────────────

    def list_monitors(self) -> list[dict]:
        """
        Return monitor geometry for every display.

        Index 0 is the virtual combined desktop; 1-N are physical monitors.
        Each dict has keys: left, top, width, height.
        """
        with self._ensure_open() as sct:
            return list(sct.monitors)

    def get_monitor(self) -> dict:
        """Return geometry dict for the configured monitor_index."""
        monitors = self.list_monitors()
        if self.monitor_index >= len(monitors):
            raise IndexError(
                f"monitor_index={self.monitor_index} out of range "
                f"(found {len(monitors) - 1} monitor(s))"
            )
        return monitors[self.monitor_index]

    # ── capture helpers ────────────────────────────────────────────────────────

    def capture_monitor(self) -> np.ndarray:
        """Capture the entire configured monitor. Returns BGR uint8 array."""
        monitor = self.get_monitor()
        return self._grab(monitor)

    def capture_region(self, region: dict) -> np.ndarray:
        """
        Capture an absolute screen region.

        Parameters
        ----------
        region:
            Dict with keys ``left``, ``top``, ``width``, ``height``
            in screen pixels (absolute, not relative to monitor origin).
        """
        scaled = self._scale_region(region)
        return self._grab(scaled)

    def capture_relative(self, region: dict) -> np.ndarray:
        """
        Capture a region defined relative to the configured monitor's top-left.

        Accepts the same dict format as capture_region; coordinates are
        automatically offset by the monitor's left/top position.
        """
        mon = self.get_monitor()
        absolute = {
            "left": mon["left"] + region["left"],
            "top": mon["top"] + region["top"],
            "width": region["width"],
            "height": region["height"],
        }
        return self.capture_region(absolute)

    # ── format conversions ─────────────────────────────────────────────────────

    @staticmethod
    def to_pil(frame: np.ndarray) -> Image.Image:
        """Convert a BGR numpy array to an RGB PIL Image."""
        rgb = frame[:, :, ::-1]  # BGR → RGB
        return Image.fromarray(rgb)

    @staticmethod
    def to_gray(frame: np.ndarray) -> np.ndarray:
        """Convert a BGR numpy array to single-channel grayscale."""
        import cv2
        return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    @staticmethod
    def save(frame: np.ndarray, path: str) -> None:
        """Save a BGR numpy array to disk (PNG/JPG inferred from extension)."""
        import cv2
        cv2.imwrite(path, frame)
        logger.info("Saved capture to %s", path)

    # ── internals ──────────────────────────────────────────────────────────────

    def _grab(self, region: dict) -> np.ndarray:
        """Grab pixels and return a BGR uint8 numpy array."""
        with self._ensure_open() as sct:
            raw = sct.grab(region)
            # mss returns BGRA; drop alpha and keep BGR for OpenCV compatibility
            frame = np.array(raw, dtype=np.uint8)[:, :, :3]
        return frame

    def _scale_region(self, region: dict) -> dict:
        """Apply scale_factor to a region dict (for HiDPI screens)."""
        if self.scale_factor == 1.0:
            return region
        sf = self.scale_factor
        return {
            "left": int(region["left"] * sf),
            "top": int(region["top"] * sf),
            "width": int(region["width"] * sf),
            "height": int(region["height"] * sf),
        }
