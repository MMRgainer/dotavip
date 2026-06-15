"""
Read the player's real scoreboard keybind from Dota's config so we listen for
the correct key (it isn't always Tab). Works for any user / install.

Dota stores binds in:
  <Steam>/userdata/<id>/570/remote/cfg/dotakeys_personal.lst
We read the most-recently-modified one (the active account) and parse the
"ScoreboardToggle" action's Key.
"""
from __future__ import annotations

import glob
import os
import re
from pathlib import Path
from typing import Optional


def _steam_paths() -> list[str]:
    paths = []
    # Registry (most reliable on Windows)
    try:
        import winreg
        for hive, key in [(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam"),
                          (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam")]:
            try:
                with winreg.OpenKey(hive, key) as k:
                    val, _ = winreg.QueryValueEx(k, "SteamPath" if hive == winreg.HKEY_CURRENT_USER else "InstallPath")
                    if val:
                        paths.append(val.replace("/", "\\"))
            except OSError:
                pass
    except Exception:
        pass
    # Common fallbacks
    paths += [
        r"C:\Program Files (x86)\Steam",
        r"C:\Program Files\Steam",
    ]
    return paths


def _keybind_files() -> list[str]:
    files = []
    for sp in _steam_paths():
        pattern = os.path.join(sp, "userdata", "*", "570", "remote", "cfg", "dotakeys_personal.lst")
        files += glob.glob(pattern)
    return files


# Dota key token -> python `keyboard` library key name
_KEY_MAP = {
    "TAB": "tab", "SPACE": "space", "ENTER": "enter", "`": "`",
    "BACKSPACE": "backspace", "CAPSLOCK": "caps lock",
}

def _map_key(dota_key: str) -> Optional[str]:
    k = dota_key.strip()
    if not k:
        return None
    if k in _KEY_MAP:
        return _KEY_MAP[k]
    if re.fullmatch(r"F\d{1,2}", k):
        return k.lower()
    if len(k) == 1:
        return k.lower()
    # Things like "KP_INS", "MOUSE..." we can't hook simply
    return None


def find_scoreboard_key(default: str = "tab") -> str:
    """Return the `keyboard`-lib key name for the scoreboard bind, or default."""
    files = _keybind_files()
    if not files:
        return default
    files.sort(key=os.path.getmtime, reverse=True)   # active account first
    for path in files:
        try:
            text = Path(path).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        # Find "ScoreboardToggle" { "Key" "X" }
        m = re.search(r'"ScoreboardToggle"\s*\{[^}]*?"Key"\s*"([^"]+)"', text, re.DOTALL)
        if m:
            mapped = _map_key(m.group(1))
            if mapped:
                return mapped
    return default
