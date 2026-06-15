#!/usr/bin/env python3
import sys, time
sys.path.insert(0, '.')
from capture.screen import ScreenCapture
from cv.topbar_detector import TopBarDetector

sc = ScreenCapture(monitor_index=1)
sc.open()
frame = sc.capture_monitor()
sc.close()

det = TopBarDetector()
t0 = time.perf_counter()
result = det.detect(frame)
names = [h for h in result if h]
elapsed = time.perf_counter() - t0

print(f'\n=== LIVE DETECTION ===\n')
print(f'Time: {elapsed:.3f}s')
print(f'Total detected: {len(names)}/10')
print(f'Heroes: {names}\n')

print('Slot breakdown:')
for i, h in enumerate(result):
    side = 'RAD' if i < 5 else 'DIR'
    status = h if h else '(empty)'
    print(f'  {i+1:2d} {side}: {status}')
