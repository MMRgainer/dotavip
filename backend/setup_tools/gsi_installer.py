"""
Auto-install the Game State Integration config into the user's Dota 2 folder.
Detects Steam + all library folders, locates 'dota 2 beta', writes the cfg.
No manual steps for the user.
"""
from __future__ import annotations

import glob
import os
import re
from pathlib import Path
from typing import Optional

GSI_FILENAME = "gamestate_integration_dotavip.cfg"

GSI_CONTENT = """\
"DotaVIP Game State Integration"
{
    "uri"           "http://localhost:8765/gsi"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.1"
    "heartbeat"     "30.0"
    "data"
    {
        "provider"      "1"
        "map"           "1"
        "player"        "1"
        "hero"          "1"
        "abilities"     "1"
        "items"         "1"
        "draft"         "1"
        "events"        "1"
    }
    "auth"
    {
        "token"         "dotavip"
    }
}
"""


def _steam_roots() -> list[str]:
    roots = []
    try:
        import winreg
        for hive, key, val in [
            (winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam", "SteamPath"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath"),
        ]:
            try:
                with winreg.OpenKey(hive, key) as k:
                    v, _ = winreg.QueryValueEx(k, val)
                    if v:
                        roots.append(os.path.normpath(v))
            except OSError:
                pass
    except Exception:
        pass
    roots += [r"C:\Program Files (x86)\Steam", r"C:\Program Files\Steam"]
    # de-dup
    seen, out = set(), []
    for r in roots:
        rl = r.lower()
        if rl not in seen and os.path.isdir(r):
            seen.add(rl); out.append(r)
    return out


def _library_paths(steam_root: str) -> list[str]:
    """All Steam library folders (games can live on other drives)."""
    libs = [steam_root]
    for vdf in [os.path.join(steam_root, "steamapps", "libraryfolders.vdf"),
                os.path.join(steam_root, "config", "libraryfolders.vdf")]:
        try:
            text = Path(vdf).read_text(encoding="utf-8", errors="ignore")
            for m in re.finditer(r'"path"\s*"([^"]+)"', text):
                libs.append(m.group(1).replace("\\\\", "\\"))
        except Exception:
            pass
    return libs


def find_dota_cfg_dir() -> Optional[Path]:
    """Locate <dota 2 beta>/game/dota/cfg (creating gamestate_integration if needed)."""
    for root in _steam_roots():
        for lib in _library_paths(root):
            cand = Path(lib) / "steamapps" / "common" / "dota 2 beta" / "game" / "dota" / "cfg"
            if cand.is_dir():
                return cand
    return None


def gsi_status() -> dict:
    cfg_dir = find_dota_cfg_dir()
    if not cfg_dir:
        return {"dota_found": False, "installed": False, "path": None}
    target = cfg_dir / "gamestate_integration" / GSI_FILENAME
    return {"dota_found": True, "installed": target.exists(), "path": str(target)}


def install_gsi() -> dict:
    cfg_dir = find_dota_cfg_dir()
    if not cfg_dir:
        return {"ok": False, "error": "Dota 2 not found"}
    gsi_dir = cfg_dir / "gamestate_integration"
    gsi_dir.mkdir(parents=True, exist_ok=True)
    target = gsi_dir / GSI_FILENAME
    try:
        target.write_text(GSI_CONTENT, encoding="utf-8")
        return {"ok": True, "path": str(target)}
    except Exception as e:
        return {"ok": False, "error": str(e)}
