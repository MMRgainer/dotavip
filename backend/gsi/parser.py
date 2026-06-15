"""
Dota 2 GSI payload parser.

Dota 2 sends HTTP POST every ~100ms to our endpoint.
This module extracts what we need from the raw JSON.

Key fields we use
-----------------
allplayers[0..9]
    .name           Steam name (not hero name)
    .hero_name      "npc_dota_hero_crystal_maiden"
    .team_name      "radiant" | "dire"
    .team_slot      0-4 within the team
    .buyback_cost   gold needed
    .buyback_cooldown  seconds remaining (0 = available)
    .kills / .deaths / .assists

player
    .team_name      local player's team
    .team_slot      local player's slot on that team

map
    .game_state     "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS" etc.
    .game_time      seconds since game start (negative = strategy)
    .roshan_state   "alive" | "dead" | "undefined" (not always present)

hero
    .name           local player's hero name
    .alive
    .buyback_cooldown
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


def _strip_hero(raw: str) -> str:
    """'npc_dota_hero_crystal_maiden' → 'crystal_maiden'"""
    return raw.replace("npc_dota_hero_", "").lower()


@dataclass
class PlayerInfo:
    slot: int                   # 0-9 in allplayers dict
    team: str                   # "radiant" | "dire"
    hero_key: str               # "crystal_maiden"
    hero_name_raw: str          # "npc_dota_hero_crystal_maiden"
    buyback_cost: int = 0
    buyback_cooldown: float = 0.0   # 0 = available
    kills: int = 0
    deaths: int = 0
    assists: int = 0
    level: int = 1

    @property
    def buyback_available(self) -> bool:
        return self.buyback_cooldown <= 0


@dataclass
class DraftPick:
    hero_key: str
    team: str   # "radiant" | "dire"
    slot: int   # 0-4 within team


@dataclass
class GSIEvent:
    """An event from the GSI 'events' block (e.g. roshan_killed)."""
    event_type: str             # "roshan_killed" | "aegis_picked_up"
    game_time: int = 0          # game_time when it happened (used for dedupe)
    killed_by_team: str = ""    # roshan_killed: "radiant" | "dire" | "neutral"
    killer_player_id: int = -1  # roshan_killed
    player_id: int = -1         # aegis_picked_up: who grabbed it
    snatched: bool = False      # aegis_picked_up: snatched mid-fight


@dataclass
class GSIState:
    """Parsed snapshot of one GSI payload."""

    valid: bool = False                     # False if not in a real game

    local_team: str = ""                    # "radiant" | "dire"
    local_hero_key: str = ""

    players: list[PlayerInfo] = field(default_factory=list)   # all 10
    enemy_players: list[PlayerInfo] = field(default_factory=list)  # 5 enemies

    game_state: str = ""                    # raw DOTA_GAMERULES_STATE_*
    game_time: int = 0                      # seconds, keeps running during pauses
    clock_time: int = 0                     # on-screen clock (freezes on pause)
    match_id: str = ""                      # unique per map — changes = new game
    paused: bool = False
    win_team: str = ""                      # "radiant" | "dire" once POST_GAME
    game_over: bool = False                 # game_state == POST_GAME

    # Roshan from map object (not always present)
    roshan_state: Optional[str] = None     # "alive" | "dead" | None

    in_game: bool = False                   # True during actual gameplay

    # Draft picks — available after picking phase in real games
    draft_picks: list[DraftPick] = field(default_factory=list)

    # Events from GSI 'events' block (roshan_killed, aegis_picked_up)
    events: list[GSIEvent] = field(default_factory=list)


_PLAYING_STATES = {
    "DOTA_GAMERULES_STATE_GAME_IN_PROGRESS",
    "DOTA_GAMERULES_STATE_PRE_GAME",
}


def _parse_events(payload: dict) -> list[GSIEvent]:
    """Parse the GSI 'events' block. Requires '"events" "1"' in the GSI cfg.

    Dota sends events like:
        {"event_type": "roshan_killed", "game_time": 1234,
         "killed_by_team": 2, "killer_player_id": 3}
        {"event_type": "aegis_picked_up", "game_time": 1240,
         "player_id": 3, "snatched": false}
    """
    raw = payload.get("events", [])
    if not isinstance(raw, list):
        return []

    out: list[GSIEvent] = []
    for ev in raw:
        if not isinstance(ev, dict):
            continue
        etype = ev.get("event_type", "")
        if etype not in ("roshan_killed", "aegis_picked_up"):
            continue

        # killed_by_team comes as int team id (2=radiant, 3=dire) in some versions
        kbt_raw = ev.get("killed_by_team", "")
        if kbt_raw == 2:
            kbt = "radiant"
        elif kbt_raw == 3:
            kbt = "dire"
        else:
            kbt = str(kbt_raw)

        out.append(GSIEvent(
            event_type       = etype,
            game_time        = int(ev.get("game_time", 0)),
            killed_by_team   = kbt,
            killer_player_id = int(ev.get("killer_player_id", -1)),
            player_id        = int(ev.get("player_id", -1)),
            snatched         = bool(ev.get("snatched", False)),
        ))
    return out


def parse(payload: dict) -> GSIState:
    """Parse a raw GSI JSON payload into a GSIState."""
    state = GSIState()

    # ── map / game state ──────────────────────────────────────────────────────
    map_obj = payload.get("map", {})
    state.game_state = map_obj.get("game_state", "")
    state.game_time  = int(map_obj.get("game_time", 0))
    state.clock_time = int(map_obj.get("clock_time", 0))
    state.match_id   = str(map_obj.get("matchid", "") or "")
    state.paused     = bool(map_obj.get("paused", False))
    state.in_game    = state.game_state in _PLAYING_STATES
    state.game_over  = state.game_state == "DOTA_GAMERULES_STATE_POST_GAME"

    win_raw = str(map_obj.get("win_team", "")).lower()
    if win_raw in ("radiant", "dire"):
        state.win_team = win_raw
    elif win_raw == "2":
        state.win_team = "radiant"
    elif win_raw == "3":
        state.win_team = "dire"

    # ── events (roshan_killed, aegis_picked_up) ───────────────────────────────
    state.events = _parse_events(payload)

    roshan_raw = map_obj.get("roshan_state", "")
    if roshan_raw in ("alive", "dead"):
        state.roshan_state = roshan_raw

    # ── local player ──────────────────────────────────────────────────────────
    player_obj = payload.get("player", {})
    state.local_team = player_obj.get("team_name", "").lower()

    hero_obj = payload.get("hero", {})
    raw_name = hero_obj.get("name", "")
    if raw_name:
        state.local_hero_key = _strip_hero(raw_name)

    # ── all players ───────────────────────────────────────────────────────────
    allplayers = payload.get("allplayers", {})
    if not allplayers:
        # No allplayers → can't identify enemies reliably
        state.valid = bool(state.local_hero_key and state.in_game)
        return state

    for slot_str, pdata in allplayers.items():
        try:
            slot = int(slot_str)
        except ValueError:
            continue

        hero_name_raw = pdata.get("hero_name", "") or pdata.get("heroid", "")
        # Some GSI versions store hero name differently
        if not hero_name_raw:
            hero_name_raw = pdata.get("hero", {}).get("name", "") if isinstance(pdata.get("hero"), dict) else ""

        if not hero_name_raw:
            continue

        team = pdata.get("team_name", "").lower()
        if not team:
            # Infer from slot: 0-4 = radiant, 5-9 = dire
            team = "radiant" if slot < 5 else "dire"

        pi = PlayerInfo(
            slot           = slot,
            team           = team,
            hero_key       = _strip_hero(hero_name_raw),
            hero_name_raw  = hero_name_raw,
            buyback_cost     = int(pdata.get("buyback_cost", 0)),
            buyback_cooldown = float(pdata.get("buyback_cooldown", 0)),
            kills    = int(pdata.get("kills",   0)),
            deaths   = int(pdata.get("deaths",  0)),
            assists  = int(pdata.get("assists", 0)),
            level    = int(pdata.get("level",   1)),
        )
        state.players.append(pi)

    # ── separate enemies ──────────────────────────────────────────────────────
    if state.local_team:
        state.enemy_players = [
            p for p in state.players if p.team != state.local_team
        ]
    else:
        # Fallback: no team info — take second half by slot
        state.enemy_players = [p for p in state.players if p.slot >= 5]

    # Sort enemies by team_slot order (slot within their team)
    state.enemy_players.sort(key=lambda p: p.slot)

    # ── draft picks ───────────────────────────────────────────────────────────
    draft_obj = payload.get("draft", {})
    if draft_obj:
        for team_key, team_name in [("team2", "radiant"), ("team3", "dire")]:
            team_data = draft_obj.get(team_key, {})
            for slot in range(5):
                hero_class = team_data.get(f"pick{slot}_class", "")
                if hero_class and hero_class != "0":
                    state.draft_picks.append(DraftPick(
                        hero_key = _strip_hero(hero_class),
                        team     = team_name,
                        slot     = slot,
                    ))

    state.valid = True
    return state
