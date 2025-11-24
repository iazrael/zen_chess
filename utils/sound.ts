// Simple sound synthesis using Web Audio API to avoid external dependencies
const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
let audioCtx: AudioContext | null = null;
let globalVolume = 0.5; // Default 50%

const getCtx = () => {
    if (!audioCtx && AudioContext) {
        audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

export const setGlobalVolume = (volume: number) => {
    globalVolume = Math.max(0, Math.min(1, volume));
};

export const playMoveSound = () => {
    if (globalVolume === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Low frequency sine/triangle for a "thud" like wood
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

    // Short envelope
    gain.gain.setValueAtTime(0.2 * globalVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01 * globalVolume, t + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(t + 0.15);
};

export const playCaptureSound = () => {
    if (globalVolume === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Higher pitch, sharper attack for capture
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);

    // Filter to take edge off square wave
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    gain.gain.setValueAtTime(0.15 * globalVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01 * globalVolume, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(t + 0.2);
};

export const playSelectSound = () => {
    if (globalVolume === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Very short, high pitched "tick" or "tap"
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);

    gain.gain.setValueAtTime(0.05 * globalVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001 * globalVolume, t + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(t + 0.06);
};

export const playWinSound = () => {
    if (globalVolume === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    
    // Ascending major arpeggio
    const notes = [
        523.25, // C5
        659.25, // E5
        783.99, // G5
        1046.50 // C6
    ];

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        const start = t + i * 0.15;
        const duration = 1.0;
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15 * globalVolume, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001 * globalVolume, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
    });
};

export const playInvalidMoveSound = () => {
    if (globalVolume === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Dissonant low frequency
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.2);

    gain.gain.setValueAtTime(0.1 * globalVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01 * globalVolume, t + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(t + 0.25);
};

// Longer victory sound with celebratory melody
export const playVictorySound = () => {
    if (globalVolume === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    
    // Extended triumphant melody
    const melody = [
        { freq: 523.25, start: 0, duration: 0.3 },    // C5
        { freq: 659.25, start: 0.3, duration: 0.3 },  // E5
        { freq: 783.99, start: 0.6, duration: 0.3 },  // G5
        { freq: 1046.50, start: 0.9, duration: 0.5 }, // C6
        { freq: 1046.50, start: 1.5, duration: 0.3 }, // C6 (repeat)
        { freq: 783.99, start: 1.8, duration: 0.3 },  // G5
        { freq: 1046.50, start: 2.1, duration: 0.8 }, // C6 (finale)
    ];

    melody.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        
        const startTime = t + note.start;
        const endTime = startTime + note.duration;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2 * globalVolume, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001 * globalVolume, endTime);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(endTime);
    });
};

// Defeat sound with somber tone
export const playDefeatSound = () => {
    if (globalVolume === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    
    // Descending somber notes
    const melody = [
        { freq: 392.00, start: 0, duration: 0.6 },    // G4
        { freq: 349.23, start: 0.6, duration: 0.6 },  // F4
        { freq: 293.66, start: 1.2, duration: 0.6 },  // D4
        { freq: 261.63, start: 1.8, duration: 1.2 },  // C4 (longer final note)
    ];

    melody.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        
        const startTime = t + note.start;
        const endTime = startTime + note.duration;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15 * globalVolume, startTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001 * globalVolume, endTime);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(endTime);
    });
};

// 将军音效 - 刺激的警告声
export const playCheckSound = () => {
    if (globalVolume === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    
    // 急促的双重警告音
    [0, 0.15].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // 高频尖锐的方波，制造紧张感
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t + delay);  // A5
        osc.frequency.exponentialRampToValueAtTime(440, t + delay + 0.1);  // A4
        
        // 快速的音量包络
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.25 * globalVolume, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01 * globalVolume, t + delay + 0.15);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(t + delay);
        osc.stop(t + delay + 0.2);
    });
};