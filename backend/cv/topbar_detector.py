"""
Slot-based hero detection in the Dota 2 top bar.

Instead of sliding template matching across the full topbar, we crop each
of the 10 fixed hero slots, resize to 64×64, and compare against all
templates directly. This is fast (~50ms total) and accurate.

Slot layout at 2560×1440
-------------------------
5 Radiant heroes (left half) + 5 Dire heroes (right half).
Positions calibrated from live screenshot analysis.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from config.settings import settings

logger = logging.getLogger(__name__)

ICON_SIZE = 64  # templates are 64×64

# Slot definitions for 2560×1440.
# Each entry: (center_x, center_y) in full-screen coordinates.
# Portrait height ~65px, width ~175px.
_SLOTS_1440P = [
    # Radiant (left side) — calibrated from strip analysis at 5:51 game time
    ( 580, 32),
    ( 655, 32),
    ( 730, 32),
    ( 805, 32),
    ( 880, 32),
    # Dire (right side)
    (1420, 32),
    (1495, 32),
    (1570, 32),
    (1645, 32),
    (1720, 32),
]

_SLOT_W = 130   # wider crop = better icon clarity
_SLOT_H = 80    # taller = capture whole hero portrait + icon


@dataclass
class TopBarDetector:
    """
    Detects which hero is in each top-bar slot by:
    1. Cropping the slot region from the full frame.
    2. Resizing to ICON_SIZE × ICON_SIZE.
    3. Finding the highest-confidence template match.
    """

    # Use small 64×64 hero icons — sliding window inside each slot gives
    # much better confidence than comparing full portrait vs full portrait.
    template_dir: Path = field(
        default_factory=lambda: Path(settings.template_dir) / "heroes"
    )
    min_confidence: float = 0.25   # icon matching in small slots has inherently lower scores

    # hero_name → list of gray 64×64 templates
    _cache: dict[str, list[np.ndarray]] = field(
        default_factory=dict, init=False, repr=False
    )

    def __post_init__(self) -> None:
        self._load()

    def _load(self) -> None:
        if not self.template_dir.exists():
            logger.warning("Hero icon dir not found: %s", self.template_dir)
            return
        for png in self.template_dir.glob("*.png"):
            name = png.stem
            key  = name[: -len("_arcana")] if name.endswith("_arcana") else name
            tmpl = cv2.imread(str(png), cv2.IMREAD_GRAYSCALE)
            if tmpl is None:
                continue
            # Keep native 64×64 — sliding window will locate them inside the slot
            self._cache.setdefault(key, []).append(tmpl)
        logger.info("TopBarDetector: loaded %d icon templates", len(self._cache))

    def detect(self, full_frame: np.ndarray) -> list[Optional[str]]:
        """
        Detect heroes in all 10 slots with deduplication.

        Each hero can appear at most once — if the same hero wins in multiple
        slots we keep the highest-confidence occurrence and discard the rest.

        Returns list of 10 items (hero key or None), indices 0-4 Radiant, 5-9 Dire.
        """
        h, w = full_frame.shape[:2]
        # Collect (hero, confidence) per slot first
        raw: list[tuple[Optional[str], float]] = []

        for (cx, cy) in _SLOTS_1440P:
            x1 = max(0, cx - _SLOT_W // 2)
            y1 = max(0, cy - _SLOT_H // 2)
            x2 = min(w, x1 + _SLOT_W)
            y2 = min(h, y1 + _SLOT_H)

            crop = full_frame[y1:y2, x1:x2]
            if crop.size == 0:
                raw.append((None, 0.0))
                continue

            resized = cv2.resize(crop, (_SLOT_W, _SLOT_H))
            gray    = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            hero, conf = self._best_match(gray)
            raw.append((hero if conf >= self.min_confidence else None, conf))

        # Deduplicate: each hero name may appear only once (keep highest conf)
        seen: dict[str, tuple[int, float]] = {}  # hero → (slot_idx, conf)
        for slot_idx, (hero, conf) in enumerate(raw):
            if hero is None:
                continue
            if hero not in seen or conf > seen[hero][1]:
                seen[hero] = (slot_idx, conf)

        results: list[Optional[str]] = [None] * len(_SLOTS_1440P)
        for hero, (slot_idx, _) in seen.items():
            results[slot_idx] = hero

        return results

    def detect_names(self, full_frame: np.ndarray) -> list[str]:
        """Return unique hero names (no duplicates)."""
        return [h for h in self.detect(full_frame) if h is not None]

    # ── internals ──────────────────────────────────────────────────────────────

    def _best_match(self, gray_slot: np.ndarray) -> tuple[str, float]:
        """
        Sliding window matching — finds 64×64 icon inside the slot crop.
        Scales template down if needed to fit inside slot.
        Returns (hero_key, max_confidence).
        """
        best_name = ""
        best_conf = 0.0

        for hero, templates in self._cache.items():
            for tmpl in templates:
                # Scale down if needed (slot height might be < 64)
                t = tmpl
                if t.shape[0] > gray_slot.shape[0] or t.shape[1] > gray_slot.shape[1]:
                    # Scale to fit: use the limiting dimension
                    scale = min(gray_slot.shape[0] / t.shape[0], gray_slot.shape[1] / t.shape[1])
                    new_h = max(8, int(t.shape[0] * scale))
                    new_w = max(8, int(t.shape[1] * scale))
                    t = cv2.resize(t, (new_w, new_h))

                res = cv2.matchTemplate(gray_slot, t, cv2.TM_CCOEFF_NORMED)
                val = float(np.max(res))  # max of all window positions
                if val > best_conf:
                    best_conf = val
                    best_name = hero

        return best_name, best_conf
