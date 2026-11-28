import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORED_KEYS, anyStoredMissing, reconcileStored, setBackup, writeStored } from './backup';
import { loadProgress, recordStars, saveProgress } from './progress';

/** A stand-in for the page's localStorage (vitest runs in node, which has none). */
class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

/** A stand-in for Capacitor's Preferences store. */
function preferences(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (k: string) => (data.has(k) ? data.get(k)! : null),
    set: async (k: string, v: string) => void data.set(k, v),
  };
}

const [PROGRESS, SETTINGS] = STORED_KEYS;
let local: MemoryStorage;

beforeEach(() => {
  local = new MemoryStorage();
  (globalThis as { localStorage?: unknown }).localStorage = local;
});
afterEach(() => {
  setBackup(null);
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('the second copy of progress and settings', () => {
  it('keeps exactly the two entries the game stores', () => {
    expect(STORED_KEYS).toEqual(['riddle-games:progress:v1', 'riddle-games:settings:v1']);
  });

  it('with no backup set (the website), a save is a plain localStorage write', () => {
    saveProgress({ stars: { a: 2 } });
    expect(local.getItem(PROGRESS)).toBe('{"stars":{"a":2}}');
    expect(loadProgress()).toEqual({ stars: { a: 2 } });
  });

  it('with a backup set, every save writes both copies with the same text', () => {
    const prefs = preferences();
    setBackup({ set: (k, v) => void prefs.set(k, v) });
    let p = recordStars({ stars: {} }, 'a', 3);
    p = recordStars(p, 'b', 1);
    writeStored(SETTINGS, '{"quality":"low","sound":false}');
    expect(prefs.data.get(PROGRESS)).toBe(local.getItem(PROGRESS));
    expect(JSON.parse(prefs.data.get(PROGRESS)!)).toEqual({ stars: { a: 3, b: 1 } });
    expect(prefs.data.get(SETTINGS)).toBe('{"quality":"low","sound":false}');
  });

  it('reset progress (an empty save) clears the stars in both copies', () => {
    const prefs = preferences();
    setBackup({ set: (k, v) => void prefs.set(k, v) });
    recordStars({ stars: {} }, 'a', 3);
    saveProgress({ stars: {} });
    expect(JSON.parse(local.getItem(PROGRESS)!)).toEqual({ stars: {} });
    expect(JSON.parse(prefs.data.get(PROGRESS)!)).toEqual({ stars: {} });
  });

  it('a backup that throws never stops the save', () => {
    setBackup({ set: () => { throw new Error('bridge gone'); } });
    expect(() => saveProgress({ stars: { a: 1 } })).not.toThrow();
    expect(local.getItem(PROGRESS)).toBe('{"stars":{"a":1}}');
  });

  it('after the web storage is wiped, the start puts both entries back from the copy', async () => {
    const prefs = preferences({ [PROGRESS]: '{"stars":{"a":3}}', [SETTINGS]: '{"quality":"high","sound":false}' });
    expect(anyStoredMissing(local)).toBe(true);
    const back = await reconcileStored({ local, get: prefs.get, set: prefs.set });
    expect(back).toEqual([PROGRESS, SETTINGS]);
    expect(loadProgress()).toEqual({ stars: { a: 3 } });
    expect(local.getItem(SETTINGS)).toBe('{"quality":"high","sound":false}');
    expect(anyStoredMissing(local)).toBe(false);
  });

  it('after a reset and a wipe, the stars stay gone', async () => {
    const prefs = preferences({ [PROGRESS]: '{"stars":{}}' });
    await reconcileStored({ local, get: prefs.get, set: prefs.set });
    expect(loadProgress()).toEqual({ stars: {} });
  });

  it('localStorage wins where it has the entry, and the copy is brought into line', async () => {
    local.setItem(PROGRESS, '{"stars":{"a":3,"b":2}}');
    const prefs = preferences({ [PROGRESS]: '{"stars":{"a":3}}' });
    const back = await reconcileStored({ local, get: prefs.get, set: prefs.set });
    expect(back).toEqual([]);
    expect(local.getItem(PROGRESS)).toBe('{"stars":{"a":3,"b":2}}');
    expect(prefs.data.get(PROGRESS)).toBe('{"stars":{"a":3,"b":2}}');
    // Nothing in either: nothing is written.
    expect(local.getItem(SETTINGS)).toBeNull();
    expect(prefs.data.has(SETTINGS)).toBe(false);
  });

  it('an install from before the copy fills the copy from localStorage', async () => {
    local.setItem(PROGRESS, '{"stars":{"a":1}}');
    local.setItem(SETTINGS, '{"quality":"low","sound":true}');
    const prefs = preferences();
    await reconcileStored({ local, get: prefs.get, set: prefs.set });
    expect(Object.fromEntries(prefs.data)).toEqual({ [PROGRESS]: '{"stars":{"a":1}}', [SETTINGS]: '{"quality":"low","sound":true}' });
  });

  it('one entry that fails to read does not stop the other, and nothing rejects', async () => {
    const prefs = preferences({ [SETTINGS]: '{"sound":false}' });
    const get = async (k: string) => {
      if (k === PROGRESS) throw new Error('no');
      return prefs.get(k);
    };
    await expect(reconcileStored({ local, get, set: prefs.set })).resolves.toEqual([SETTINGS]);
    expect(local.getItem(SETTINGS)).toBe('{"sound":false}');
  });
});
