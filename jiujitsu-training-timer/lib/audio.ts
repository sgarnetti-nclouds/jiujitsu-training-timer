/**
 * Generate a loud air horn sound using Web Audio API with bass
 */
export function playAirHorn(): void {
  if (typeof window === 'undefined') return;

  try {
    const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = win.AudioContext ?? win.webkitAudioContext;
    if (!AC) return;
    const audioContext = new AC();

    const now = audioContext.currentTime;

    // Master gain with long-ish decay for bell sustain
    const master = audioContext.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(1.0, now + 0.001);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);
    master.connect(audioContext.destination);

    // Short metallic strike noise for attack
    const noiseLen = Math.floor(audioContext.sampleRate * 0.04); // 40ms
    const noiseBuf = audioContext.createBuffer(1, noiseLen, audioContext.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLen / 6));
    const noiseSrc = audioContext.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const noiseHP = audioContext.createBiquadFilter();
    noiseHP.type = 'highpass';
    noiseHP.frequency.setValueAtTime(800, now);
    const noiseG = audioContext.createGain();
    noiseG.gain.setValueAtTime(0.8, now);
    noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noiseSrc.connect(noiseHP);
    noiseHP.connect(noiseG);
    noiseG.connect(master);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.2);

    // Bell partials (inharmonic-ish) with longer decay
    const partials = [660, 990, 1320, 1760];
    partials.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const g = audioContext.createGain();
      const attack = 0.001;
      const decay = 2.2 + i * 0.3; // slightly staggered decay times
      g.gain.setValueAtTime(0.0, now);
      g.gain.linearRampToValueAtTime(1.0 / (i + 1), now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      // small bandpass to add bell character per partial
      const bp = audioContext.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq * 1.0, now);
      bp.Q.setValueAtTime(6 + i, now);

      osc.connect(bp);
      bp.connect(g);
      g.connect(master);

      osc.start(now);
      osc.stop(now + decay + 0.05);
    });
  } catch (error) {
    console.error('Error playing air horn:', error);
  }
}

/**
 * Use Web Speech API to announce text
 */
export function speak(text: string, opts?: { pitch?: number; rate?: number; volume?: number; voiceName?: string; male?: boolean }, onEnd?: () => void): void {
  if (typeof window === 'undefined') return;

  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // Slightly slower and louder defaults
    utterance.rate = opts?.rate ?? 0.85;
    utterance.pitch = opts?.pitch ?? 0.9;
    utterance.volume = opts?.volume ?? 1.0;

    // Try to select a voice that best matches a deeper/male timbre when requested
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      // Voices not populated yet — wait for them and retry once
      const handler = () => {
        window.speechSynthesis.onvoiceschanged = null;
        speak(text, opts, onEnd);
      };
      window.speechSynthesis.onvoiceschanged = handler;
      return;
    }

    if (voices && voices.length) {
      let chosen: SpeechSynthesisVoice | undefined;
      if (opts?.voiceName) {
        chosen = voices.find((v) => v.name.toLowerCase().includes(opts.voiceName!.toLowerCase()));
      }
      if (!chosen && opts?.male) {
        // Stronger heuristic: prefer voices with common male names first
        chosen = voices.find((v) => /alex|daniel|tom|matthew|david|john|mark|ryan|paul|chris|michael/i.test(v.name));
      }
      // If still not found, avoid obviously female-named voices (common female names)
      if (!chosen) {
        const femalePattern = /samantha|victoria|katherine|kathy|kate|yaroslava|zira|zira/i;
        chosen = voices.find((v) => !femalePattern.test(v.name));
      }
      if (!chosen) {
        // Fallback: prefer locale-matching en-US or the first available
        chosen = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) || voices[0];
      }

      if (chosen) {
        utterance.voice = chosen;
        utterance.lang = chosen.lang || 'en-US';
      } else {
        utterance.lang = 'en-US';
      }
    }
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Error speaking:', error);
  }
}

// ElevenLabs integration removed per user request; Web Speech API used exclusively.

/**
 * Announce round information and play air horn
 */
export function announcRound(roundNumber: number, positionName: string): void {
  if (typeof window === 'undefined') return;
  const text = `Round ${roundNumber} with ${positionName}`;
  // Use speak helper and play bell on end; ensure male, deep voice
  try {
    speak(text, { male: true, pitch: 0.5, rate: 0.75, volume: 1.0 }, () => {
      playAirHorn();
    });
  } catch (error) {
    console.error('Error announcing round:', error);
    playAirHorn();
  }
}

/**
 * Announce end of round
 */
export function announceRoundEnd(): void {
  playAirHorn();
  setTimeout(() => {
    speak('Time', { voiceName: 'alex', male: true, pitch: 0.6, rate: 0.9, volume: 1.0 });
  }, 1000);
}
