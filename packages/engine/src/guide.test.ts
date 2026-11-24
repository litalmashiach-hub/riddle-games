import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guideStepFor, hasSeenGuide, loadProgress, markGuideSeen, recordStars, saveProgress, type FirstPlayGuide } from './index';

const KEY = 'riddle-games:progress:v1';

/** A small in-memory localStorage: the tests run in Node, which has none. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe('first-play guide steps', () => {
  const guide: FirstPlayGuide = {
    steps: [
      { at: [0, 0, 0], radius: 1, say: 'Tap the wolf', pick: 'wolf' },
      { at: [1, 0, 0], radius: 1, say: 'Now tap the boat' },
    ],
  };

  it('starts on the first step and stays there until the right pick', () => {
    expect(guideStepFor(guide, null)).toBe(0);
    expect(guideStepFor(guide, 'sheepA')).toBe(0);
  });

  it('moves on when the right thing is picked, and back when it is put down', () => {
    expect(guideStepFor(guide, 'wolf')).toBe(1);
    expect(guideStepFor(guide, null)).toBe(0);
  });

  it('never runs past the last step', () => {
    expect(guideStepFor({ steps: [{ at: [0, 0, 0], radius: 1, say: 'x', pick: 'a' }] }, 'a')).toBe(0);
  });
});

describe('guide seen, kept with the stars', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('is not seen on a fresh device', () => {
    expect(hasSeenGuide(loadProgress(), 'wolf-two-sheep')).toBe(false);
  });

  it('is saved in the progress entry, once, and survives a reload', () => {
    const p = markGuideSeen(loadProgress(), 'wolf-two-sheep');
    expect(hasSeenGuide(p, 'wolf-two-sheep')).toBe(true);
    expect(markGuideSeen(p, 'wolf-two-sheep')).toBe(p);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ stars: {}, guidesSeen: ['wolf-two-sheep'] });
    expect(hasSeenGuide(loadProgress(), 'wolf-two-sheep')).toBe(true);
  });

  it('is kept when stars are saved later', () => {
    let p = markGuideSeen(loadProgress(), 'wolf-two-sheep');
    p = recordStars(p, 'wolf-two-sheep', 3);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ stars: { 'wolf-two-sheep': 3 }, guidesSeen: ['wolf-two-sheep'] });
    expect(hasSeenGuide(loadProgress(), 'wolf-two-sheep')).toBe(true);
  });

  it('comes back when progress is reset to no stars', () => {
    markGuideSeen(loadProgress(), 'wolf-two-sheep');
    saveProgress({ stars: {} });
    expect(hasSeenGuide(loadProgress(), 'wolf-two-sheep')).toBe(false);
  });

  it('reads an older entry, with stars only, as not seen', () => {
    localStorage.setItem(KEY, JSON.stringify({ stars: { 'wolf-two-sheep': 2 } }));
    expect(hasSeenGuide(loadProgress(), 'wolf-two-sheep')).toBe(false);
  });
});
