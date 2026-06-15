import sys, time, cv2, numpy as np
sys.path.insert(0, '.')
from capture.screen import ScreenCapture
from cv.topbar_detector import TopBarDetector, _SLOTS_1440P, _SLOT_W, _SLOT_H

sc = ScreenCapture(monitor_index=1)
sc.open()
frame = sc.capture_monitor()
sc.close()

det = TopBarDetector()
print(f"Frame: {frame.shape[1]}x{frame.shape[0]}  Templates: {len(det._cache)}")
print(f"Slot size: {_SLOT_W}x{_SLOT_H}  Min confidence: {det.min_confidence}\n")

# Test each slot
h, w = frame.shape[:2]
for slot_idx, (cx, cy) in enumerate(_SLOTS_1440P):
    x1 = max(0, cx - _SLOT_W // 2)
    y1 = max(0, cy - _SLOT_H // 2)
    crop = frame[y1:y1+_SLOT_H, x1:x1+_SLOT_W]
    resized = cv2.resize(crop, (_SLOT_W, _SLOT_H))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    # Find top 3 matches by sliding window
    scores = []
    for hero, tmpls in det._cache.items():
        for tmpl in tmpls:
            if tmpl.shape[0] > gray.shape[0] or tmpl.shape[1] > gray.shape[1]:
                continue
            res = cv2.matchTemplate(gray, tmpl, cv2.TM_CCOEFF_NORMED)
            max_val = float(np.max(res))
            scores.append((max_val, hero))

    scores.sort(reverse=True)
    side = "RAD" if slot_idx < 5 else "DIR"
    top3 = "  ".join(f"{s:.3f}/{n}" for s, n in scores[:3])
    print(f"Slot {slot_idx+1:2d} ({side}) x={cx:4d}: {top3}")

print(f"\n=== Full detect() ===")
t0 = time.perf_counter()
result = det.detect(frame)
names = [h for h in result if h]
elapsed = time.perf_counter() - t0
print(f"Time: {elapsed:.3f}s")
print(f"Result: {result}")
print(f"Names:  {names}")
