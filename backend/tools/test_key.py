import keyboard, time
print("Press your scoreboard key a few times (8 sec)...", flush=True)
seen = {}
def h(e):
    if e.event_type == 'down':
        k = f"name={e.name!r} scan={e.scan_code}"
        seen[k] = seen.get(k, 0) + 1
keyboard.hook(h)
time.sleep(8)
print("Detected:", seen)
