"""
FastAPI application — GSI ingestion + WebSocket real-time broadcast.

Data flow
---------
Dota 2  ──POST /gsi──►  parse_gsi()  ──►  _gsi_state (global)
                                                │
                                                ▼
browser ◄──WS push──  _broadcast()  ◄──  _build_state()

WebSocket protocol
------------------
Server → Client:
  {"type": "state", "data": {
      "roshan":    { state, min_s, max_s, elapsed_s },
      "cooldowns": [...],
      "buyback":   [bool × 5],        # enemy buyback available?
      "draft":     ["hero_key", ...], # up to 5 enemy hero keys
      "game_time": 300,               # seconds, 0 if not in game
      "in_game":   true
  }}

Client → Server:
  {"type": "roshan_kill"}
  {"type": "roshan_reset"}
  {"type": "cooldown_trigger", "hero": "...", "ability": "...",
   "level": 1, "player_slot": 0}
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

import cv2
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from gsi.parser import GSIState, parse as parse_gsi
from tracker.roshan import RoshanTimer
from tracker.cooldown import CooldownTracker

logger = logging.getLogger(__name__)

# ── globals ────────────────────────────────────────────────────────────────────

roshan_timer:    RoshanTimer
cooldown_tracker: CooldownTracker
connected_clients: set[WebSocket] = set()

# Latest parsed GSI snapshot (updated on every POST /gsi)
_gsi_state: GSIState = GSIState()
_last_gsi_ts: float = 0.0   # monotonic time of last GSI POST
_last_raw_payload: dict = {}  # for debugging

# Roshan / Aegis auto-detect (from GSI events block)
# We expose monotonic sequence counters; the frontend auto-starts a timer
# whenever a counter increases. Dedupe by event game_time.
_roshan_kill_seq: int = 0
_aegis_seq: int = 0
_last_roshan_gt: int | None = None
_last_aegis_gt: int | None = None
_last_aegis_player: int = -1
_roshan_kill_gt: int = 0    # game_time when Roshan was killed (anchor for timer)
_aegis_gt: int = 0          # game_time when Aegis was picked up

# Game lifecycle — detect a NEW map by matchid change. _match_seq increments on
# every new game; the frontend resets its per-game state when it sees it grow.
_current_match_id: str = ""
_match_seq: int = 0

# Click-to-close: while a dropdown menu is open in the overlay, a global mouse
# hook (non-blocking) notifies clients on any click so the menu can close when
# the player clicks in the game. Gated by _menu_open so we don't chatter while
# no menu is open.
_menu_open: bool = False

# Scoreboard auto-read (Tab) — enemy heroes + levels from OCR
_scoreboard_enemies: list[dict] = []   # [{slot, hero, level, ult_level}]
_event_loop = None
_last_tab_read: float = 0.0


# ── lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global roshan_timer, cooldown_tracker, _event_loop
    roshan_timer     = RoshanTimer()
    cooldown_tracker = CooldownTracker()
    _event_loop      = asyncio.get_event_loop()
    logger.info("Overlay backend started (GSI mode)")

    # Auto-install the GSI config so the user doesn't do it manually
    try:
        from setup_tools import gsi_installer
        st = gsi_installer.gsi_status()
        if st["dota_found"] and not st["installed"]:
            r = gsi_installer.install_gsi()
            logger.info("Auto-installed GSI config: %s", r)
    except Exception as e:
        logger.warning("GSI auto-install failed: %s", e)

    _start_tab_listener()
    _start_mouse_listener()

    # Heartbeat — push state every second even if no GSI (so UI stays alive)
    task = asyncio.create_task(_heartbeat_loop())
    yield
    task.cancel()
    logger.info("Overlay backend stopped")


# ── Tab scoreboard auto-read ────────────────────────────────────────────────

_tab_held: bool = False
_tab_capturing: bool = False

def _start_tab_listener() -> None:
    """Capture the scoreboard WHILE the Tab key is held (scoreboard guaranteed
    visible). Non-suppressing so Dota still receives Tab."""
    try:
        import keyboard
    except Exception:
        logger.warning("keyboard lib unavailable — Tab auto-read disabled")
        return

    # Read the player's real scoreboard key from Dota config (not always Tab)
    from tracker import dota_keys
    key = dota_keys.find_scoreboard_key(default="tab")
    # Accept aliases for the same physical key (keyboard layout may report a
    # different character for the same physical key, e.g. backtick → apostrophe)
    aliases = {key}
    if key == "`":
        aliases |= {"`", "'", "grave", "grave accent", "ё", "є"}

    def handler(evt):
        global _tab_held
        if evt.name not in aliases:
            return
        if evt.event_type == "down":
            _tab_held = True
            _maybe_start_capture()
        elif evt.event_type == "up":
            _tab_held = False

    try:
        keyboard.hook(handler, suppress=False)
        logger.info("Scoreboard hold-listener active on key '%s'", key)
    except Exception as e:
        logger.warning("keyboard hook failed: %s", e)


def _start_mouse_listener() -> None:
    """Global mouse hook (non-suppressing) so the overlay can close its dropdown
    when the player clicks anywhere in the game. Only forwards clicks while a
    menu is open (set via the 'menu_state' WS message)."""
    try:
        import mouse
    except Exception:
        logger.warning("mouse lib unavailable — click-to-close disabled")
        return

    def on_click() -> None:
        if not _menu_open or not connected_clients:
            return
        if _event_loop:
            asyncio.run_coroutine_threadsafe(_broadcast({"type": "click"}), _event_loop)

    try:
        mouse.on_button(on_click, types=("down",))   # any button press, no move spam
        logger.info("Mouse click-to-close listener active")
    except Exception as e:
        logger.warning("mouse hook failed: %s", e)


def _maybe_start_capture() -> None:
    global _tab_capturing
    if _tab_capturing:
        return
    _tab_capturing = True
    import threading
    threading.Thread(target=_capture_loop, daemon=True).start()


def _capture_loop() -> None:
    """Repeatedly read the scoreboard while Tab is held; accumulate; broadcast."""
    global _tab_capturing, _scoreboard_enemies
    import time as _t
    try:
        from capture.screen import ScreenCapture
        from tracker import calibration, scoreboard

        acc = {e["slot"]: dict(e) for e in _scoreboard_enemies}
        start = _t.monotonic()
        _t.sleep(0.18)   # let scoreboard render after key down

        while _tab_held and (_t.monotonic() - start) < 6.0:
            sc = ScreenCapture(monitor_index=1).open()
            try:
                frame = sc.capture_monitor()
            finally:
                sc.close()
            h, w = frame.shape[:2]
            calib = calibration.get_calibration(w, h)
            if not calib:
                break
            enemy = _enemy_team()
            rows = scoreboard.read_scoreboard(frame, calib, enemy)
            for r in rows:
                slot = r["slot"]
                cur = acc.get(slot, {"slot": slot, "hero": None, "level": None, "ult_level": 0})
                if r["hero"]:
                    cur["hero"] = r["hero"]
                if r["level"] is not None:
                    cur["level"] = r["level"]
                    cur["ult_level"] = r["ult_level"]
                acc[slot] = cur

            _scoreboard_enemies = [acc.get(i, {"slot": i, "hero": None, "level": None, "ult_level": 0}) for i in range(5)]
            found = sum(1 for v in acc.values() if v["hero"])
            logger.info("Tab hold read (enemy=%s): %d/5 heroes", enemy, found)
            if _event_loop:
                asyncio.run_coroutine_threadsafe(_broadcast(_build_state()), _event_loop)
            if found >= 5:
                break
            _t.sleep(0.25)
    except Exception as e:
        logger.warning("scoreboard read failed: %s", e)
    finally:
        _tab_capturing = False


# ── app ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Dota Overlay API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST ───────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    age = time.monotonic() - _last_gsi_ts if _last_gsi_ts else None
    return {
        "status": "ok",
        "gsi_connected": age is not None and age < 10,
        "gsi_age_s": round(age, 1) if age else None,
        "in_game": _gsi_state.in_game,
    }


@app.get("/heroes")
def list_heroes():
    return {"heroes": cooldown_tracker.list_heroes()}


@app.get("/heroes/{hero}/abilities")
def get_abilities(hero: str):
    from fastapi import HTTPException
    abilities = cooldown_tracker.get_abilities(hero)
    if not abilities:
        raise HTTPException(404, f"No ability data for hero '{hero}'")
    return {"hero": hero, "abilities": abilities}


@app.get("/state")
def get_state():
    return _build_state()


# ── first-run setup ─────────────────────────────────────────────────────────

@app.get("/setup/status")
def setup_status():
    from setup_tools import gsi_installer
    from tracker import calibration, dota_keys, scoreboard
    # Detect current monitor resolution for calibration check
    try:
        from capture.screen import ScreenCapture
        mon = ScreenCapture(monitor_index=1).get_monitor()
        w, h = mon["width"], mon["height"]
    except Exception:
        w, h = 0, 0
    calib = calibration.get_calibration(w, h) if w else None
    return {
        "gsi": gsi_installer.gsi_status(),
        "scoreboard_key": dota_keys.find_scoreboard_key(),
        "resolution": f"{w}x{h}",
        "calibrated": calib is not None,
        "tesseract": scoreboard._HAS_TESS,
        "in_game": _gsi_state.in_game,
        "gsi_connected": (time.monotonic() - _last_gsi_ts) < 10 if _last_gsi_ts else False,
    }


@app.post("/setup/install-gsi")
def setup_install_gsi():
    from setup_tools import gsi_installer
    return gsi_installer.install_gsi()


# ── scoreboard calibration ──────────────────────────────────────────────────

@app.get("/calibrate/capture")
async def calibrate_capture(delay: float = 5.0):
    """Wait `delay` seconds (so user can open the Tab scoreboard), then
    capture the screen and return it as a base64 PNG for the calibration UI."""
    from tracker import calibration
    await asyncio.sleep(delay)
    loop = asyncio.get_event_loop()
    try:
        b64, w, h = await loop.run_in_executor(None, calibration.grab_png_base64)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error("calibrate_capture failed:\n%s", tb)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    return {"image": b64, "width": w, "height": h}


@app.get("/scoreboard/read")
async def scoreboard_read(delay: float = 5.0):
    """Wait `delay`s (user opens Tab), capture, OCR enemy heroes + levels."""
    from tracker import calibration, scoreboard
    await asyncio.sleep(delay)
    loop = asyncio.get_event_loop()

    def _do():
        from capture.screen import ScreenCapture
        sc = ScreenCapture(monitor_index=1).open()
        try:
            frame = sc.capture_monitor()
        finally:
            sc.close()
        h, w = frame.shape[:2]
        calib = calibration.get_calibration(w, h)
        if not calib:
            return {"error": f"no calibration for {w}x{h}"}
        enemy = _enemy_team()
        return {"enemy_team": enemy, "rows": scoreboard.read_scoreboard(frame, calib, enemy)}

    return await loop.run_in_executor(None, _do)


def _enemy_team() -> str:
    """Enemy = opposite of local team. Default 'dire' if unknown."""
    lt = (_gsi_state.local_team or "").lower()
    return "radiant" if lt == "dire" else "dire"


@app.get("/calibrate")
def calibrate_get(width: int, height: int):
    from tracker import calibration
    return {"calibration": calibration.get_calibration(width, height)}


@app.post("/calibrate")
async def calibrate_post(request: Request):
    global _scoreboard_enemies
    from tracker import calibration, scoreboard
    body = await request.json()
    clicks = {
        "level_first":   body["level_first"],
        "radiant_first": body["radiant_first"],
        "radiant_last":  body["radiant_last"],
        "dire_first":    body["dire_first"],
        "dire_last":     body["dire_last"],
    }
    calib = calibration.build_from_clicks(
        width         = int(body["width"]),
        height        = int(body["height"]),
        **clicks,
    )
    calibration.save_calibration(calib)
    if body.get("image"):
        calibration.save_snapshot(body["image"], int(body["width"]), int(body["height"]), clicks)

    # Run OCR on the same screenshot used for calibration and return rows
    rows: list[dict] = []
    if body.get("image"):
        try:
            import base64 as _b64
            import numpy as _np
            img_bytes = _b64.b64decode(body["image"])
            arr = _np.frombuffer(img_bytes, dtype=_np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is not None:
                enemy = _enemy_team()
                rows = scoreboard.read_scoreboard(frame, calib, enemy)
                if rows:
                    _scoreboard_enemies = rows
                    asyncio.create_task(_broadcast(_build_state()))
        except Exception as e:
            logger.warning("OCR on calibration image failed: %s", e)

    return {"status": "ok", "calibration": calib, "rows": rows}

@app.get("/calibrate/snapshot")
def calibrate_snapshot():
    from tracker import calibration
    meta = calibration.load_snapshot_meta()
    if meta is None:
        return {"snapshot": None}
    return {"snapshot": meta}   # only width/height/clicks — no image bytes

from fastapi.responses import FileResponse
@app.get("/calibrate/preview.png")
def calibrate_preview_png():
    from tracker.calibration import _PREVIEW_PNG
    if not _PREVIEW_PNG.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No preview")
    return FileResponse(str(_PREVIEW_PNG), media_type="image/png")

@app.get("/debug")
def debug():
    """Show raw GSI payload keys — available in dev mode only."""
    import os
    if os.environ.get("DOTAVIP_DEBUG") != "1":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Debug endpoint disabled in production")
    return {
        "top_keys": list(_last_raw_payload.keys()),
        "has_allplayers": "allplayers" in _last_raw_payload,
        "has_draft": "draft" in _last_raw_payload,
        "player_team": _last_raw_payload.get("player", {}).get("team_name"),
        "hero_name": _last_raw_payload.get("hero", {}).get("name"),
        "allplayers_slots": list(_last_raw_payload.get("allplayers", {}).keys()),
        "map_game_state": _last_raw_payload.get("map", {}).get("game_state"),
        "draft_content": _last_raw_payload.get("draft", {}),
        "player_content": _last_raw_payload.get("player", {}),
    }


# ── GSI endpoint ───────────────────────────────────────────────────────────────

@app.post("/gsi")
async def gsi_endpoint(request: Request):
    """
    Receives periodic HTTP POST from Dota 2 Game State Integration.
    Parses the payload, updates global state, and broadcasts to WS clients.
    """
    global _gsi_state, _last_gsi_ts

    try:
        payload = await request.json()
    except Exception:
        return {"status": "bad_json"}

    # Optional auth token check
    auth = payload.get("auth", {})
    token = auth.get("token", "")
    if settings.gsi_token and token != settings.gsi_token:
        logger.warning("GSI: bad auth token")
        return {"status": "unauthorized"}

    global _last_raw_payload
    _last_raw_payload = payload
    # Save full payload for inspection (debug/ folder, not the backend root)
    try:
        import json as _json
        from pathlib import Path as _Path
        dbg = _Path(__file__).parent.parent / "debug"
        dbg.mkdir(exist_ok=True)
        with open(dbg / "last_gsi_payload.json", "w") as f:
            _json.dump(payload, f, indent=2)
    except Exception:
        pass
    prev_state = _gsi_state
    _gsi_state  = parse_gsi(payload)
    _last_gsi_ts = time.monotonic()

    # ── New map detection (matchid changed) ───────────────────────────────────
    global _current_match_id, _match_seq, _scoreboard_enemies
    if _gsi_state.match_id and _gsi_state.match_id != _current_match_id:
        _current_match_id = _gsi_state.match_id
        _match_seq += 1
        _scoreboard_enemies = []          # OCR results belong to the old game
        logger.info("New game detected: matchid=%s (seq=%d)",
                    _current_match_id, _match_seq)

    # Game over → also clear OCR cache so it can't leak into the next game
    if _gsi_state.game_over and not prev_state.game_over:
        _scoreboard_enemies = []
        logger.info("Game over (win_team=%s)", _gsi_state.win_team or "?")

    # ── Auto-detect Roshan / Aegis from GSI 'events' block ────────────────────
    global _roshan_kill_seq, _aegis_seq, _last_roshan_gt, _last_aegis_gt, _last_aegis_player
    global _roshan_kill_gt, _aegis_gt
    # Ignore events before the game actually starts (avoids false triggers on
    # load / reconnect where stale events or game_time=0 appear).
    _events_ok = _gsi_state.in_game and _gsi_state.game_time > 0
    for ev in (_gsi_state.events if _events_ok else []):
        if ev.event_type == "roshan_killed" and ev.game_time != _last_roshan_gt:
            _last_roshan_gt = ev.game_time
            _roshan_kill_gt = ev.game_time          # anchor to game time of the kill
            _roshan_kill_seq += 1
            roshan_timer.on_kill()
            logger.info("GSI event: Roshan killed (game_time=%s)", ev.game_time)
        elif ev.event_type == "aegis_picked_up" and ev.game_time != _last_aegis_gt:
            _last_aegis_gt = ev.game_time
            _aegis_gt = ev.game_time
            _aegis_seq += 1
            _last_aegis_player = ev.player_id
            logger.info("GSI event: Aegis picked up (player=%s)", ev.player_id)

    # Fallback: also detect Roshan death from map.roshan_state transition
    if (prev_state.roshan_state == "alive"
            and _gsi_state.roshan_state == "dead"):
        roshan_timer.on_kill()
        logger.info("GSI: Roshan killed (map state transition)")

    if _gsi_state.valid:
        await _broadcast(_build_state())

    return {"status": "ok"}


# ── WebSocket ──────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.add(ws)
    logger.info("Client connected (%d total)", len(connected_clients))
    # Send current state immediately on connect
    try:
        await ws.send_text(json.dumps(_build_state()))
    except Exception:
        pass
    try:
        while True:
            raw = await ws.receive_text()
            await _handle_ws_message(ws, raw)
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(ws)
        logger.info("Client disconnected (%d remaining)", len(connected_clients))


async def _handle_ws_message(ws: WebSocket, raw: str) -> None:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        return

    kind = msg.get("type")

    if kind == "roshan_kill":
        roshan_timer.on_kill()
        await _broadcast(_build_state())

    elif kind == "roshan_reset":
        roshan_timer.reset()
        await _broadcast(_build_state())

    elif kind == "menu_state":
        global _menu_open
        _menu_open = bool(msg.get("open", False))

    elif kind == "cooldown_trigger":
        result = cooldown_tracker.trigger(
            hero       = msg.get("hero", ""),
            ability    = msg.get("ability", ""),
            level      = int(msg.get("level", 1)),
            player_slot= int(msg.get("player_slot", 0)),
        )
        if result:
            await _broadcast(_build_state())


# ── state builder ──────────────────────────────────────────────────────────────

def _build_state() -> dict:
    g = _gsi_state

    # Enemy heroes — prefer allplayers, fall back to draft picks
    enemy_heroes: list[str] = [""] * 5
    if g.enemy_players:
        for i, p in enumerate(g.enemy_players[:5]):
            enemy_heroes[i] = p.hero_key
    elif g.draft_picks and g.local_team:
        enemy_picks = [p for p in g.draft_picks if p.team != g.local_team]
        for i, p in enumerate(enemy_picks[:5]):
            enemy_heroes[i] = p.hero_key

    # Buyback per enemy (only available when allplayers works — spectator)
    buyback: list[bool] = [p.buyback_available for p in g.enemy_players[:5]]
    while len(buyback) < 5:
        buyback.append(False)

    # GSI freshness: Dota stops sending GSI the moment you leave a match (back to
    # the main menu). Without this check the last in_game=True would stick and
    # the overlay would keep showing in the menu. Treat stale GSI as "not in a
    # game" so the overlay hides shortly after the match ends / you leave.
    gsi_fresh = bool(_last_gsi_ts) and (time.monotonic() - _last_gsi_ts) < 12
    in_game = g.in_game and gsi_fresh

    return {
        "type": "state",
        "data": {
            "cooldowns": cooldown_tracker.status(),
            "buyback":   buyback,
            "draft":     enemy_heroes,
            "game_time":  g.game_time,
            "clock_time": g.clock_time,
            "in_game":    in_game,
            "paused":     g.paused,
            "game_state": g.game_state,
            "game_over":  g.game_over,
            "win_team":   g.win_team,
            "match_id":   _current_match_id,
            "match_seq":  _match_seq,
            "local_hero": g.local_hero_key,
            "local_team": g.local_team,
            # Roshan/Aegis auto-detect sequence counters
            "roshan_kill_seq": _roshan_kill_seq,
            "aegis_seq":       _aegis_seq,
            "aegis_player":    _last_aegis_player,
            "roshan_kill_gt":  _roshan_kill_gt,
            "aegis_gt":        _aegis_gt,
            # Enemy heroes + levels from Tab scoreboard OCR
            "enemy_scoreboard": _scoreboard_enemies,
        },
    }


# ── heartbeat ──────────────────────────────────────────────────────────────────

async def _heartbeat_loop() -> None:
    """Push state every 2 seconds (minimal overhead, UI still responsive)."""
    while True:
        await asyncio.sleep(2)
        if connected_clients:
            try:
                await _broadcast(_build_state())
            except Exception:
                pass


async def _broadcast(payload: dict) -> None:
    global connected_clients
    if not connected_clients:
        return
    text = json.dumps(payload)
    dead: set[WebSocket] = set()
    for ws in list(connected_clients):
        try:
            await ws.send_text(text)
        except Exception:
            dead.add(ws)
    connected_clients -= dead
