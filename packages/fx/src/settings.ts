import { create } from 'zustand';

export type Quality = 'high' | 'low';

interface Settings {
  quality: Quality;
  sound: boolean;
  setQuality(q: Quality): void;
  toggleSound(): void;
}

const guessQuality = (): Quality => {
  if (typeof window === 'undefined') return 'high';
  const q = new URLSearchParams(window.location.search).get('quality');
  if (q === 'low' || q === 'high') return q;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const touch = 'ontouchstart' in window;
  return small && touch ? 'low' : 'high';
};

/** Player settings shared by the shell and every level. */
export const useSettings = create<Settings>((set) => ({
  quality: guessQuality(),
  sound: true,
  setQuality: (quality) => set({ quality }),
  toggleSound: () => set((s) => ({ sound: !s.sound })),
}));
