/**
 * Short reminder chime via Web Audio (no asset file). Shared by the overlay
 * (spawn reminders) and the settings window (volume preview).
 */
let _ctx = null;

export function playChime(vol = 0.5) {
  if (vol <= 0) return;
  try {
    _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = now + i * 0.16;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25 * vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.24);
    });
  } catch { /* audio unavailable — stay silent */ }
}
