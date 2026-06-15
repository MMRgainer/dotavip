"""
Kill feed OCR — Dota 2.

The game UI may be in any language (Ukrainian, Russian, English).
We detect kill feed bands (white text on dark semi-transparent bg),
run Tesseract with ukr+rus+eng, and look for "Рошан"/"Roshan".
"""

from __future__ import annotations

import logging
import re
import cv2
import numpy as np
import pytesseract

from config.settings import settings

logger = logging.getLogger(__name__)
pytesseract.pytesseract.tesseract_cmd = settings.tesseract_path

# Multi-language: Ukrainian + Russian + English (covers all Dota 2 locales)
_TESS_LANG = "ukr+rus+eng"
# PSM 7 = single text line, no orientation detection
_TESS_CFG  = r"--psm 7"

# Roshan kill patterns — covers all CIS locales + English + common OCR artifacts
_ROSHAN_PATTERNS = [
    re.compile(r"рошан",  re.IGNORECASE),          # Ukrainian/Russian Cyrillic
    re.compile(r"roshan", re.IGNORECASE),          # English
    re.compile(r"ro[s5][h#]an", re.IGNORECASE),   # OCR artifacts (5→s, #→h)
    re.compile(r"рош[а4]н", re.IGNORECASE),       # 4→а OCR artifact
]


class KillFeedReader:
    # Minimum white pixels per row
    WHITE_PIX_THRESHOLD  = 8
    # Kill feed entry height at 1440p
    BAND_MIN_H           = 16
    BAND_MAX_H           = 48
    # Kill feed text must span ≥25% of frame width (filters chat bubbles, pings)
    MIN_WIDTH_FRACTION   = 0.25
    # HSV thresholds for white/near-white pixel detection
    WHITE_V_MIN          = 200
    WHITE_S_MAX          = 70

    def read_text(self, frame: np.ndarray) -> str:
        bands = self._extract_bands(frame)
        if not bands:
            return ""
        return "\n".join(filter(None, (self._ocr_band(b) for b in bands)))

    def detect_roshan_kill(self, frame: np.ndarray) -> bool:
        text = self.read_text(frame)
        if not text:
            return False
        for pat in _ROSHAN_PATTERNS:
            if pat.search(text):
                logger.info("Roshan kill detected: %r", text)
                return True
        return False

    # ── internals ──────────────────────────────────────────────────────────────

    def _white_mask(self, frame: np.ndarray) -> np.ndarray:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        return cv2.inRange(hsv,
                           np.array([0,   0,   self.WHITE_V_MIN]),
                           np.array([180, self.WHITE_S_MAX, 255]))

    def _extract_bands(self, frame: np.ndarray) -> list[np.ndarray]:
        mask = self._white_mask(frame)
        h, w = mask.shape
        row_counts = np.sum(mask > 0, axis=1)
        active     = row_counts >= self.WHITE_PIX_THRESHOLD
        min_span   = int(w * self.MIN_WIDTH_FRACTION)
        bands: list[np.ndarray] = []
        in_band = False
        start   = 0

        for y in range(h):
            if active[y] and not in_band:
                in_band, start = True, y
            elif not active[y] and in_band:
                in_band = False
                if self.BAND_MIN_H <= (y - start) <= self.BAND_MAX_H:
                    cols = np.sum(np.any(mask[start:y] > 0, axis=0))
                    if cols >= min_span:
                        bands.append(frame[max(0, start-2):min(h, y+2)])

        if in_band and self.BAND_MIN_H <= (h - start) <= self.BAND_MAX_H:
            cols = np.sum(np.any(mask[start:h] > 0, axis=0))
            if cols >= min_span:
                bands.append(frame[start:h])

        return bands

    def _ocr_band(self, band: np.ndarray) -> str:
        h, w = band.shape[:2]
        # Upscale 3× — Tesseract accuracy on small HUD text
        up   = cv2.resize(band, (w * 3, h * 3), interpolation=cv2.INTER_LANCZOS4)
        gray = cv2.cvtColor(up, cv2.COLOR_BGR2GRAY)
        # Threshold at 180 → white text becomes black on white bg
        _, binary   = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)
        inverted    = cv2.bitwise_not(binary)
        try:
            text = pytesseract.image_to_string(inverted, lang=_TESS_LANG, config=_TESS_CFG)
            return text.strip()
        except Exception as e:
            logger.debug("OCR error: %s", e)
            return ""

    def save_debug(self, frame: np.ndarray, path_prefix: str = "kf_debug") -> None:
        cv2.imwrite(f"{path_prefix}_raw.png", frame)
        cv2.imwrite(f"{path_prefix}_mask.png", self._white_mask(frame))
        for i, band in enumerate(self._extract_bands(frame)):
            cv2.imwrite(f"{path_prefix}_band_{i}.png", band)
