// Sunset Bay — all sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, police sirens, gunshots, pickups and a slow sunset pad for the city.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let padOsc = [];
  let padGain = null;
  let padChord = 0;
  let padTimer = 0;
  let muted = false;
  let started = false;

  const CHORDS = [
    [174.61, 220.0, 261.63],
    [146.83, 220.0, 293.66],
    [130.81, 196.0, 261.63],
    [164.81, 220.0, 246.94],
  ];

  /** Call from a user gesture (click / keypress): browsers only allow audio after one. */
  function ensure() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 110;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();

      padGain = ctx.createGain();
      padGain.gain.value = 0.05;
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 900;
      padFilter.connect(padGain);
      padGain.connect(master);
      setChord(0);
      started = true;
    } catch {
      // No audio on this machine: the game plays silent and that is fine.
      ctx = null;
    }
  }

  function setChord(index) {
    if (!ctx) return;
    for (const osc of padOsc) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    padOsc = [];
    const notes = CHORDS[index % CHORDS.length];
    for (const freq of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(padGain);
      osc.start();
      padOsc.push(osc);
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* ignore */ }
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1800;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    ensure,
    /** Engine pitch and volume follow how fast the player's car is going (0..1). */
    engine(speed01, driving) {
      if (!ctx || !engineGain) return;
      const target = driving ? 0.05 + speed01 * 0.11 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(104 + speed01 * 260, ctx.currentTime, 0.08);
    },
    /** Called every frame; the siren wails only while the player is wanted. */
    update(dt, wanted) {
      if (!ctx) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        if (sirenOsc) sirenOsc.frequency.setTargetAtTime(sirenHigh ? 960 : 690, ctx.currentTime, 0.05);
      }
      if (sirenGain) sirenGain.gain.setTargetAtTime(wanted > 0 && !muted ? 0.045 : 0, ctx.currentTime, 0.2);
      padTimer -= dt;
      if (padTimer <= 0) {
        padTimer = 9;
        padChord = (padChord + 1) % CHORDS.length;
        setChord(padChord);
      }
    },
    shot() { noiseBurst(0.12, 0.32, 2400); blip(160, 0.08, 'square', 0.12); },
    enemyShot() { noiseBurst(0.1, 0.16, 1600); },
    hit() { blip(220, 0.12, 'sawtooth', 0.16); },
    crash() { noiseBurst(0.25, 0.35, 700); },
    pickup() { blip(660, 0.09, 'sine', 0.2); setTimeout(() => blip(990, 0.12, 'sine', 0.2), 70); },
    cash() {
      blip(880, 0.1, 'sine', 0.2);
      setTimeout(() => blip(1174, 0.14, 'sine', 0.2), 90);
      setTimeout(() => blip(1318, 0.2, 'sine', 0.2), 180);
    },
    jingle() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => blip(n, 0.22, 'triangle', 0.22), i * 110));
    },
    busted() { blip(196, 0.5, 'sawtooth', 0.2); blip(147, 0.7, 'sawtooth', 0.2); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
  };
}
