import { create } from 'zustand';

export type Quality = 'high' | 'low';

interface Settings {
  quality: Quality;
  sound: boolean;
  setQuality(q: Quality): void;
  toggleSound(): void;
}

const KEY = 'riddle-games:settings:v1';

/** Remembered choices, so a player's HD/SD and sound picks survive closing the app. */
const saved = (): Partial<Pick<Settings, 'quality' | 'sound'>> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
};

const remember = (s: Pick<Settings, 'quality' | 'sound'>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ quality: s.quality, sound: s.sound }));
  } catch {
    /* ignore */
  }
};

const guessQuality = (): Quality => {
  if (typeof window === 'undefined') return 'high';
  const q = new URLSearchParams(window.location.search).get('quality');
  if (q === 'low' || q === 'high') return q;
  const s = saved().quality;
  if (s === 'low' || s === 'high') return s;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const touch = 'ontouchstart' in window;
  return small && touch ? 'low' : 'high';
};

/** Player settings shared by the shell and every level. */
export const useSettings = create<Settings>((set, get) => ({
  quality: guessQuality(),
  sound: typeof window === 'undefined' ? true : saved().sound !== false,
  setQuality: (quality) => {
    set({ quality });
    remember(get());
  },
  toggleSound: () => {
    set((s) => ({ sound: !s.sound }));
    remember(get());
  },
}));
