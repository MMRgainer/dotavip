"""Quick WebSocket state checker. Run: .venv\\Scripts\\python tools/ws_check.py"""
import asyncio, json, sys
sys.path.insert(0, '.')
import websockets

async def main():
    print("Connecting to ws://127.0.0.1:8765/ws ...")
    async with websockets.connect("ws://127.0.0.1:8765/ws") as ws:
        for i in range(5):
            raw  = await asyncio.wait_for(ws.recv(), timeout=3)
            msg  = json.loads(raw)
            data = msg.get("data", {})
            draft   = data.get("draft", [])
            roshan  = data.get("roshan", {}).get("state")
            buyback = data.get("buyback", [])
            cds     = data.get("cooldowns", [])
            print(f"[{i}] roshan={roshan}  draft={draft}  bb={buyback}  cds={len(cds)}")

asyncio.run(main())
