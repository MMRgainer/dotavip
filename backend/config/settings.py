"""
Central settings loaded from environment variables or .env file.
All values have sensible defaults so the app runs without any config.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── capture ───────────────────────────────────────────────────────────────
    dota_monitor_index: int = Field(2, description="1-based mss index of the Dota 2 monitor")
    dota_resolution: str = Field("2560x1440", description="Resolution string, e.g. '2560x1440'")
    capture_fps: float = Field(4.0, description="How many times per second to poll the screen")

    # ── tesseract ─────────────────────────────────────────────────────────────
    tesseract_path: str = Field(
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        description="Absolute path to tesseract.exe",
    )
    ocr_language: str = Field("eng", description="Tesseract language code")

    # ── template matching ─────────────────────────────────────────────────────
    template_dir: str = Field(
        r"assets\templates",
        description="Path relative to backend/ where hero PNG templates live",
    )
    hero_match_threshold: float = Field(0.50, description="cv2.matchTemplate confidence threshold")
    buyback_match_threshold: float = Field(0.75, description="Threshold for buyback icon match")

    # ── roshan timer ──────────────────────────────────────────────────────────
    roshan_min_respawn: int = Field(480, description="Minimum Roshan respawn seconds (8 min)")
    roshan_max_respawn: int = Field(660, description="Maximum Roshan respawn seconds (11 min)")

    # ── GSI ───────────────────────────────────────────────────────────────────
    gsi_token: str = Field("", description="Auth token in GSI config ('' = accept any, localhost-only)")

    # ── api server ────────────────────────────────────────────────────────────
    host: str = Field("127.0.0.1")
    port: int = Field(8765)
    log_level: str = Field("info")


# Module-level singleton — import this everywhere
settings = Settings()
