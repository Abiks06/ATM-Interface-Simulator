let ctx = null;

// Short synthesized beeps; no audio files needed.
export function beep(freq = 1800, duration = 0.06, volume = 0.05) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio is optional.
  }
}

export const sounds = {
  key: () => beep(1800, 0.05),
  error: () => {
    beep(420, 0.12);
    setTimeout(() => beep(320, 0.16), 140);
  },
  ok: () => beep(1320, 0.08),
};
