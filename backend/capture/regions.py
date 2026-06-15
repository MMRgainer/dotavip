"""
Screen region definitions for Dota 2 UI elements.

All coordinates are relative to the TOP-LEFT of the Dota 2 monitor and
expressed as ``{"left": x, "top": y, "width": w, "height": h}`` dicts
compatible with mss and OpenCV.

Calibrated against the default Dota 2 HUD at 16:9 aspect ratio.
Ultrawide / non-standard ratios need their own profile.

Regions covered
---------------
kill_feed   — top-right area where kill/event messages appear
scoreboard  — full scoreboard overlay (Tab key), including buyback column
draft       — hero selection grid during picking phase
minimap     — minimap in bottom-left corner (bonus, useful for later phases)
"""

from __future__ import annotations

from typing import TypedDict


class Region(TypedDict):
    left: int
    top: int
    width: int
    height: int


# ── Resolution profiles ────────────────────────────────────────────────────────

class _ResolutionProfile:
    """Container for all game-zone regions at a specific resolution."""

    def __init__(
        self,
        resolution: str,
        kill_feed: Region,
        scoreboard: Region,
        draft: Region,
        topbar: Region,
        minimap: Region,
    ) -> None:
        self.resolution = resolution
        self.kill_feed = kill_feed
        self.scoreboard = scoreboard
        self.draft = draft
        self.topbar = topbar
        self.minimap = minimap

    def all(self) -> dict[str, Region]:
        return {
            "kill_feed": self.kill_feed,
            "scoreboard": self.scoreboard,
            "draft": self.draft,
            "topbar": self.topbar,
            "minimap": self.minimap,
        }


# ── 1920×1080 ──────────────────────────────────────────────────────────────────
# Kill feed:  top-right, ~6 lines of text, starting just below health bars
# Scoreboard: full width center panel when Tab is held
# Draft:      hero grid spans roughly 60% of the screen center
_1080P = _ResolutionProfile(
    resolution="1920x1080",
    kill_feed=Region( left=1390, top=10,  width=520,  height=300),
    scoreboard=Region(left=120,  top=95,  width=1680, height=890),
    draft=Region(     left=260,  top=115, width=1400, height=750),
    topbar=Region(    left=250,  top=3,   width=1440, height=42),
    minimap=Region(   left=0,    top=830, width=260,  height=250),
)

# ── 2560×1440  (YOUR ACTIVE CONFIG) ───────────────────────────────────────────
# Scaled proportionally from 1080p (factor ≈ 1.333) then fine-tuned for
# Dota 2's 1440p HUD, which keeps the same relative layout.
_1440P = _ResolutionProfile(
    resolution="2560x1440",
    kill_feed=Region( left=1820, top=5,   width=730,  height=280),
    scoreboard=Region(left=160,  top=126, width=2240, height=1188),
    draft=Region(     left=346,  top=153, width=1868, height=1000),
    topbar=Region(    left=330,  top=0,   width=1920, height=70),
    minimap=Region(   left=0,    top=1107,width=346,  height=333),
)

# ── 3840×2160 (4K) ────────────────────────────────────────────────────────────
# 2× scale from 1080p.
_4K = _ResolutionProfile(
    resolution="3840x2160",
    kill_feed=Region( left=2780, top=20,  width=1040, height=600),
    scoreboard=Region(left=240,  top=190, width=3360, height=1780),
    draft=Region(     left=520,  top=230, width=2800, height=1500),
    topbar=Region(    left=660,  top=8,   width=2880, height=84),
    minimap=Region(   left=0,    top=1660,width=520,  height=500),
)

# ── Registry ───────────────────────────────────────────────────────────────────

_PROFILES: dict[str, _ResolutionProfile] = {
    "1920x1080": _1080P,
    "2560x1440": _1440P,
    "3840x2160": _4K,
}

# Default — matches the user's setup (2560×1440, Dota on monitor 2)
DEFAULT_RESOLUTION = "2560x1440"


def get_profile(resolution: str | None = None) -> _ResolutionProfile:
    """
    Return the region profile for the given resolution string.

    Parameters
    ----------
    resolution:
        One of ``"1920x1080"``, ``"2560x1440"``, ``"3840x2160"``.
        Pass ``None`` to use DEFAULT_RESOLUTION.

    Raises
    ------
    ValueError
        If the resolution string is not in the registry.
    """
    key = resolution or DEFAULT_RESOLUTION
    if key not in _PROFILES:
        raise ValueError(
            f"Unknown resolution '{key}'. "
            f"Available: {list(_PROFILES.keys())}"
        )
    return _PROFILES[key]


def get_region(zone: str, resolution: str | None = None) -> Region:
    """
    Convenience accessor for a single named zone.

    Parameters
    ----------
    zone:
        One of ``"kill_feed"``, ``"scoreboard"``, ``"draft"``, ``"minimap"``.
    resolution:
        See get_profile().
    """
    profile = get_profile(resolution)
    try:
        return profile.all()[zone]
    except KeyError:
        raise ValueError(
            f"Unknown zone '{zone}'. Available: {list(profile.all().keys())}"
        )
