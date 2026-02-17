// Shared AudioContext for better performance and reliability
let sharedAudioContext: AudioContext | null = null;

/**
 * Get or create shared AudioContext and ensure it's resumed
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const win = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = win.AudioContext ?? win.webkitAudioContext;
    if (!AC) return null;

    if (!sharedAudioContext) {
      sharedAudioContext = new AC();
    }

    // Always try to resume if suspended
    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume();
    }

    return sharedAudioContext;
  } catch (error) {
    console.error('Error getting AudioContext:', error);
    return null;
  }
}

/**
 * Play a simple beep sound for testing
 */
export function playBeep(): void {
  if (typeof window === 'undefined') return;
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.3;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    console.error('Error playing beep:', error);
  }
}

/**
 * Generate a loud air horn sound using Web Audio API with bass
 */
export function playAirHorn(): void {
  console.log('playAirHorn called');
  if (typeof window === 'undefined') {
    console.log('Window is undefined, cannot play air horn');
    return;
  }

  try {
    const audioContext = getAudioContext();
    if (!audioContext) {
      console.log('AudioContext not available');
      return;
    }

    console.log('AudioContext ready, playing air horn');

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
 * Ensure voices are loaded before speaking
 */
function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    // Wait for voices to load
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
    // Fallback timeout
    setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 1000);
  });
}

/**
 * Use Web Speech API to announce text
 * Returns a Promise that resolves when speech finishes (or times out)
 */
export function speak(text: string, opts?: { pitch?: number; rate?: number; volume?: number; voiceName?: string; male?: boolean }): Promise<void> {
  console.log('speak called with text:', text);

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.log('Speech synthesis not available');
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    // Safety timeout - if speech doesn't complete in 5 seconds, resolve anyway
    setTimeout(() => {
      if (!resolved) {
        console.log('Speech timeout - forcing resolve after 5 seconds');
        done();
      }
    }, 5000);

    // Resume speech synthesis if needed
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Wait for voices to be loaded, then speak
    ensureVoicesLoaded().then((voices) => {
      try {
        console.log('Voices loaded:', voices.length);

        if (!voices || voices.length === 0) {
          console.log('No voices available after waiting, skipping speech');
          done();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = opts?.rate ?? 0.85;
        utterance.pitch = opts?.pitch ?? 0.9;
        utterance.volume = opts?.volume ?? 1.0;

        if (voices && voices.length) {
          let chosen: SpeechSynthesisVoice | undefined;
          if (opts?.voiceName) {
            chosen = voices.find((v) => v.name.toLowerCase().includes(opts.voiceName!.toLowerCase()));
          }
          // Log all available voices for debugging
          console.log('ALL AVAILABLE VOICES:');
          voices.forEach((v, i) => console.log(`  ${i}: "${v.name}" (${v.lang}) local=${v.localService}`));

          if (!chosen && opts?.male) {
            const enUS = voices.filter((v) => v.lang === 'en-US' || v.lang === 'en_US');

            // 1st: Google voices (most natural sounding in Chrome)
            chosen = enUS.find((v) => /google us english/i.test(v.name));
            // 2nd: Premium/Enhanced voices (best quality on macOS Safari)
            if (!chosen) chosen = voices.find((v) => /enhanced|premium/i.test(v.name) && /en/i.test(v.lang));
            // 3rd: Known good macOS voices
            if (!chosen) chosen = enUS.find((v) => /\b(evan|alex|aaron)\b/i.test(v.name));
            // 4th: Any en-US voice
            if (!chosen) chosen = enUS[0];
          }
          if (!chosen) {
            const enUS = voices.filter((v) => v.lang === 'en-US' || v.lang === 'en_US');
            chosen = enUS[0] || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) || voices[0];
          }

          if (chosen) {
            console.log('Selected voice:', chosen.name);
            utterance.voice = chosen;
            utterance.lang = chosen.lang || 'en-US';
          } else {
            utterance.lang = 'en-US';
          }
        }

        utterance.onend = () => {
          console.log('Speech onend event fired');
          done();
        };
        utterance.onerror = (event) => {
          console.error('Speech error event:', event);
          done();
        };

        console.log('About to call speechSynthesis.speak');
        window.speechSynthesis.speak(utterance);
        console.log('speechSynthesis.speak called');
      } catch (error) {
        console.error('Error speaking:', error);
        done();
      }
    }).catch((error) => {
      console.error('Error loading voices:', error);
      done();
    });
  });
}

// ElevenLabs integration removed per user request; Web Speech API used exclusively.

/**
 * Announce position with speech ONLY (no bell)
 * Bell is played separately at the end of the 10-second countdown
 * Returns a Promise that resolves when the announcement finishes
 */
export function announcRound(roundNumber: number, positionName: string): Promise<void> {
  console.log('=== ANNOUNCING POSITION ===');
  console.log('Round:', roundNumber, 'Position:', positionName);

  // Phonetic adjustments for TTS pronunciation
  const spokenName = positionName
    .replace(/\bDe\b/g, 'Day')
    .replace(/Riva/gi, 'Heeva')
    .replace(/Lasso/gi, 'Lahhsso');

  const text = `Round ${roundNumber}. ${spokenName}`;
  console.log('TEXT TO SPEAK:', text);

  // Bold announcer voice
  return speak(text, { voiceName: 'Google UK English Male', rate: 1.15, pitch: 1.0, volume: 1.0 });
}

/**
 * Play a loud whistle sound for round end
 */
export function playWhistle(): void {
  console.log('playWhistle called');
  if (typeof window === 'undefined') {
    console.log('Window is undefined, cannot play whistle');
    return;
  }

  try {
    const audioContext = getAudioContext();
    if (!audioContext) {
      console.log('AudioContext not available');
      return;
    }

    console.log('AudioContext ready, playing whistle');

    const now = audioContext.currentTime;
    const duration = 0.8;

    // Create master gain with envelope
    const master = audioContext.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.8, now + 0.05);
    master.gain.linearRampToValueAtTime(0.6, now + duration - 0.1);
    master.gain.linearRampToValueAtTime(0, now + duration);
    master.connect(audioContext.destination);

    // Create sweeping whistle frequencies
    const osc1 = audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.linearRampToValueAtTime(1200, now + duration * 0.5);
    osc1.frequency.linearRampToValueAtTime(900, now + duration);

    const osc2 = audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1600, now);
    osc2.frequency.linearRampToValueAtTime(2400, now + duration * 0.5);
    osc2.frequency.linearRampToValueAtTime(1800, now + duration);

    // Add some harmonics
    const osc3 = audioContext.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(2400, now);
    osc3.frequency.linearRampToValueAtTime(3600, now + duration * 0.5);
    osc3.frequency.linearRampToValueAtTime(2700, now + duration);

    // Gain for each oscillator
    const gain1 = audioContext.createGain();
    gain1.gain.value = 0.5;
    const gain2 = audioContext.createGain();
    gain2.gain.value = 0.3;
    const gain3 = audioContext.createGain();
    gain3.gain.value = 0.2;

    osc1.connect(gain1);
    gain1.connect(master);
    osc2.connect(gain2);
    gain2.connect(master);
    osc3.connect(gain3);
    gain3.connect(master);

    osc1.start(now);
    osc1.stop(now + duration);
    osc2.start(now);
    osc2.stop(now + duration);
    osc3.start(now);
    osc3.stop(now + duration);
  } catch (error) {
    console.error('Error playing whistle:', error);
  }
}

/**
 * Announce end of round with three quick bells (ding ding ding)
 */
export function announceRoundEnd(): void {
  console.log('announceRoundEnd called - playing 3 quick bells');
  // Play three bells in rapid succession
  playAirHorn();
  setTimeout(() => {
    playAirHorn();
  }, 150);
  setTimeout(() => {
    playAirHorn();
  }, 300);
}
