"""
Roshan respawn timer.

State machine
-------------
ALIVE   → kill detected  → DEAD (min/max window starts)
DEAD    → min elapsed    → MAYBE_ALIVE (could have respawned)
MAYBE_ALIVE → max elapsed → ALIVE (guaranteed respawn)
Any state → manual reset  → ALIVE
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional

from config.settings import settings


class RoshanState(str, Enum):
    ALIVE = "alive"
    DEAD = "dead"
    MAYBE_ALIVE = "maybe_alive"  # between min and max respawn window


@dataclass
class RoshanTimer:
    """
    Tracks Roshan's death and respawn window.

    Usage
    -----
    Call ``on_kill()`` when a kill is detected in the kill feed.
    Call ``status()`` at any time to get the current state dict.
    Call ``reset()`` to manually mark Roshan as alive (e.g. after aegis seen).
    """

    min_respawn: int = field(default_factory=lambda: settings.roshan_min_respawn)
    max_respawn: int = field(default_factory=lambda: settings.roshan_max_respawn)

    _state: RoshanState = field(default=RoshanState.ALIVE, init=False)
    _kill_time: Optional[float] = field(default=None, init=False)

    def on_kill(self, game_time: Optional[float] = None) -> None:
        """Record a Roshan kill. game_time is wall-clock seconds if None."""
        self._kill_time = game_time if game_time is not None else time.monotonic()
        self._state = RoshanState.DEAD

    def reset(self) -> None:
        """Manually mark Roshan as alive (e.g. aegis picked up on stream)."""
        self._state = RoshanState.ALIVE
        self._kill_time = None

    def tick(self, now: Optional[float] = None) -> None:
        """Advance state machine. Call periodically (e.g. every capture cycle)."""
        if self._state == RoshanState.ALIVE or self._kill_time is None:
            return
        elapsed = (now if now is not None else time.monotonic()) - self._kill_time
        if elapsed >= self.max_respawn:
            self._state = RoshanState.ALIVE
            self._kill_time = None
        elif elapsed >= self.min_respawn:
            self._state = RoshanState.MAYBE_ALIVE

    def status(self, now: Optional[float] = None) -> dict:
        """
        Return a JSON-serialisable status dict.

        Keys
        ----
        state           RoshanState value string
        elapsed_s       seconds since death (null if alive)
        min_remaining_s seconds until min respawn window (0 if already past)
        max_remaining_s seconds until guaranteed respawn (0 if already past)
        kill_time       monotonic timestamp of death (null if alive)
        """
        self.tick(now)
        t = now if now is not None else time.monotonic()

        if self._kill_time is None:
            return {
                "state": self._state.value,
                "elapsed_s": None,
                "min_remaining_s": None,
                "max_remaining_s": None,
                "kill_time": None,
            }

        elapsed = t - self._kill_time
        return {
            "state": self._state.value,
            "elapsed_s": round(elapsed, 1),
            "min_remaining_s": max(0.0, round(self.min_respawn - elapsed, 1)),
            "max_remaining_s": max(0.0, round(self.max_respawn - elapsed, 1)),
            "kill_time": self._kill_time,
        }
