"""
OpenCV template matching for hero icons and buyback indicator.

Hero templates
--------------
PNG files in assets/templates/heroes/<hero_name>.png
Expected size: 64×64 px (Dota 2 draft icon size at 1440p).
Templates are loaded lazily and cached on first use.

Buyback template
----------------
Single file: assets/templates/buyback_icon.png
The scoreboard buyback column shows a gold coin icon when a player has
buyback available; absence (or a dimmed icon) means it's on cooldown.
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


@dataclass
class MatchResult:
    name: str
    confidence: float
    x: int
    y: int
    w: int
    h: int

    @property
    def center(self) -> tuple[int, int]:
        return self.x + self.w // 2, self.y + self.h // 2


@dataclass
class HeroMatcher:
    """
    Detects hero icons in a draft-screen frame using normalised cross-correlation.

    Parameters
    ----------
    template_dir:
        Directory containing hero PNG templates (one file per hero,
        named <hero_name>.png, e.g. anti_mage.png).
    threshold:
        Minimum cv2.TM_CCOEFF_NORMED score to count as a match.
    """

    template_dir: Path = field(default_factory=lambda: Path(settings.template_dir) / "heroes")
    threshold: float = field(default_factory=lambda: settings.hero_match_threshold)
    # Downscale factor for matching — 0.5 = 4× faster, accuracy still fine for icons
    scale: float = 1.0

    # internal cache: hero_name → list of (template_bgr, (w, h))
    # Templates are pre-scaled by self.scale at load time.
    _cache: dict[str, list[tuple[np.ndarray, tuple[int, int]]]] = field(
        default_factory=dict, init=False, repr=False
    )

    def __post_init__(self) -> None:
        self._load_templates()

    def _load_templates(self) -> None:
        """
        Load all PNG files from template_dir into the cache.

        Arcana variants (<hero>_arcana.png) are stored under the base hero name
        as additional templates so the hero is still recognised when the enemy
        has an arcana equipped.  Both base and arcana templates compete during
        matching; the highest confidence wins.
        """
        if not self.template_dir.exists():
            logger.warning("Hero template dir not found: %s", self.template_dir)
            return

        # Separate base icons from arcana variants on first pass
        arcana_files: list[Path] = []
        base_files: list[Path] = []
        for png in self.template_dir.glob("*.png"):
            if png.stem.endswith("_arcana"):
                arcana_files.append(png)
            else:
                base_files.append(png)

        for png in base_files:
            tmpl = cv2.imread(str(png), cv2.IMREAD_COLOR)
            if tmpl is None:
                logger.warning("Could not load template: %s", png)
                continue
            tmpl = self._scale_tmpl(tmpl)
            h, w = tmpl.shape[:2]
            self._cache[png.stem] = [(tmpl, (w, h))]

        for png in arcana_files:
            base_name = png.stem[: -len("_arcana")]
            tmpl = cv2.imread(str(png), cv2.IMREAD_COLOR)
            if tmpl is None:
                continue
            tmpl = self._scale_tmpl(tmpl)
            h, w = tmpl.shape[:2]
            if base_name in self._cache:
                self._cache[base_name].append((tmpl, (w, h)))
            else:
                self._cache[base_name] = [(tmpl, (w, h))]

        logger.info(
            "Loaded %d hero templates (%d with arcana variants)",
            len(self._cache),
            sum(1 for v in self._cache.values() if len(v) > 1),
        )

    def reload(self) -> None:
        """Hot-reload templates from disk (call after adding new PNGs)."""
        self._cache.clear()
        self._load_templates()

    def _scale_tmpl(self, tmpl: np.ndarray) -> np.ndarray:
        if self.scale == 1.0:
            return tmpl
        h, w = tmpl.shape[:2]
        return cv2.resize(tmpl, (max(1, int(w * self.scale)), max(1, int(h * self.scale))),
                          interpolation=cv2.INTER_AREA)

    def _scale_frame(self, frame: np.ndarray) -> np.ndarray:
        if self.scale == 1.0:
            return frame
        h, w = frame.shape[:2]
        return cv2.resize(frame, (int(w * self.scale), int(h * self.scale)),
                          interpolation=cv2.INTER_AREA)

    def find_all(self, frame: np.ndarray) -> list[MatchResult]:
        """
        Scan frame for all known hero icons.

        Returns one MatchResult per hero whose best match exceeds threshold.
        If a hero appears multiple times (e.g. both team panels), all
        instances above threshold are returned.
        """
        results: list[MatchResult] = []
        scaled_frame = self._scale_frame(frame)
        gray_frame = cv2.cvtColor(scaled_frame, cv2.COLOR_BGR2GRAY)
        inv_scale = 1.0 / self.scale  # to map coords back to original

        for hero_name, variants in self._cache.items():
            for tmpl, (tw, th) in variants:
                gray_tmpl = cv2.cvtColor(tmpl, cv2.COLOR_BGR2GRAY)
                if gray_tmpl.shape[0] > gray_frame.shape[0] or gray_tmpl.shape[1] > gray_frame.shape[1]:
                    continue
                res = cv2.matchTemplate(gray_frame, gray_tmpl, cv2.TM_CCOEFF_NORMED)
                locs = np.where(res >= self.threshold)
                for y, x in zip(*locs):
                    conf = float(res[y, x])
                    # Scale coords back to original frame space
                    results.append(MatchResult(hero_name, conf,
                                               int(x * inv_scale), int(y * inv_scale),
                                               int(tw * inv_scale), int(th * inv_scale)))

        # Deduplicate overlapping hits with a simple greedy NMS
        return _nms(results, iou_threshold=0.3)

    def find_best(self, frame: np.ndarray, hero_name: str) -> Optional[MatchResult]:
        """Find the single best match for a specific hero in the frame."""
        if hero_name not in self._cache:
            logger.warning("Unknown hero template: %s", hero_name)
            return None
        scaled_frame = self._scale_frame(frame)
        gray_frame = cv2.cvtColor(scaled_frame, cv2.COLOR_BGR2GRAY)
        inv_scale = 1.0 / self.scale
        best: Optional[MatchResult] = None
        for tmpl, (tw, th) in self._cache[hero_name]:
            gray_tmpl = cv2.cvtColor(tmpl, cv2.COLOR_BGR2GRAY)
            res = cv2.matchTemplate(gray_frame, gray_tmpl, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(res)
            if max_val >= self.threshold:
                if best is None or max_val > best.confidence:
                    x, y = max_loc
                    best = MatchResult(hero_name, float(max_val),
                                       int(x * inv_scale), int(y * inv_scale),
                                       int(tw * inv_scale), int(th * inv_scale))
        return best

    @property
    def known_heroes(self) -> list[str]:
        return list(self._cache.keys())


@dataclass
class BuybackDetector:
    """
    Detects which enemy players have buyback available on the scoreboard.

    The scoreboard has 5 enemy rows. Each row contains a buyback icon cell.
    We match the 'buyback available' template against each cell region.

    Parameters
    ----------
    template_path:
        Path to buyback_icon.png (the 'available' state icon).
    threshold:
        Minimum match confidence.
    """

    template_path: Path = field(
        default_factory=lambda: Path(settings.template_dir) / "buyback_icon.png"
    )
    threshold: float = field(default_factory=lambda: settings.buyback_match_threshold)

    _template: Optional[np.ndarray] = field(default=None, init=False, repr=False)

    def __post_init__(self) -> None:
        self._load()

    def _load(self) -> None:
        if not self.template_path.exists():
            logger.warning("Buyback template not found: %s", self.template_path)
            return
        self._template = cv2.imread(str(self.template_path), cv2.IMREAD_COLOR)
        if self._template is None:
            logger.error("Failed to load buyback template")

    def detect_row(self, row_frame: np.ndarray) -> bool:
        """
        Return True if the buyback icon is present (available) in this row crop.

        row_frame should be the buyback-column cell for one player.
        """
        if self._template is None:
            return False
        gray_row = cv2.cvtColor(row_frame, cv2.COLOR_BGR2GRAY)
        gray_tmpl = cv2.cvtColor(self._template, cv2.COLOR_BGR2GRAY)
        if gray_row.shape[0] < gray_tmpl.shape[0] or gray_row.shape[1] < gray_tmpl.shape[1]:
            return False
        res = cv2.matchTemplate(gray_row, gray_tmpl, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(res)
        return float(max_val) >= self.threshold

    def detect_all_enemies(
        self, scoreboard_frame: np.ndarray, row_regions: list[dict]
    ) -> list[bool]:
        """
        Check buyback for all 5 enemy players.

        Parameters
        ----------
        scoreboard_frame:
            Full scoreboard crop (relative coords).
        row_regions:
            List of 5 dicts with keys left/top/width/height, each being the
            buyback cell for one enemy player within scoreboard_frame.

        Returns
        -------
        List of 5 booleans — True = buyback available.
        """
        results = []
        for region in row_regions:
            x, y = region["left"], region["top"]
            w, h = region["width"], region["height"]
            cell = scoreboard_frame[y : y + h, x : x + w]
            results.append(self.detect_row(cell))
        return results


# ── helpers ────────────────────────────────────────────────────────────────────

def _nms(matches: list[MatchResult], iou_threshold: float = 0.3) -> list[MatchResult]:
    """Greedy non-maximum suppression to remove overlapping detections."""
    if not matches:
        return []
    matches = sorted(matches, key=lambda m: m.confidence, reverse=True)
    kept: list[MatchResult] = []
    for candidate in matches:
        dominated = False
        for kept_m in kept:
            if _iou(candidate, kept_m) > iou_threshold:
                dominated = True
                break
        if not dominated:
            kept.append(candidate)
    return kept


def _iou(a: MatchResult, b: MatchResult) -> float:
    """Intersection over Union for two MatchResults."""
    ax1, ay1 = a.x, a.y
    ax2, ay2 = a.x + a.w, a.y + a.h
    bx1, by1 = b.x, b.y
    bx2, by2 = b.x + b.w, b.y + b.h

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    union = (a.w * a.h) + (b.w * b.h) - inter
    return inter / union
