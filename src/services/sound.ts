const SOUND_ENABLED_KEY = 'vocab_sound_enabled';

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(SOUND_ENABLED_KEY);
    return val === null ? true : val === 'true';
  } catch (_) {
    return true; // Safe fallback if localStorage is blocked (Private browsing, sandboxed iframe)
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch (_) {}
}

let correctAudio: HTMLAudioElement | null = null;
let wrongAudio: HTMLAudioElement | null = null;
let rewardAudio: HTMLAudioElement | null = null;

function getAudio(url: string, current: HTMLAudioElement | null): HTMLAudioElement {
  if (current) return current;
  const audio = new Audio(url);
  audio.preload = 'auto';
  return audio;
}

export function playCorrectSound(): void {
  if (typeof window === 'undefined' || !isSoundEnabled()) return;
  try {
    correctAudio = getAudio('/sounds/correct.wav', correctAudio);
    correctAudio.currentTime = 0;
    correctAudio.volume = 0.7;
    correctAudio.play().catch(() => {});
  } catch (_) {}
}

export function playWrongSound(): void {
  if (typeof window === 'undefined' || !isSoundEnabled()) return;
  try {
    wrongAudio = getAudio('/sounds/wrong.wav', wrongAudio);
    wrongAudio.currentTime = 0;
    wrongAudio.volume = 0.6;
    wrongAudio.play().catch(() => {});
  } catch (_) {}
}

export function playRewardSound(): void {
  if (typeof window === 'undefined' || !isSoundEnabled()) return;
  try {
    rewardAudio = getAudio('/sounds/reward.mp3', rewardAudio);
    rewardAudio.currentTime = 0;
    rewardAudio.volume = 0.8;
    rewardAudio.play().catch(() => {});
  } catch (_) {}
}
