/**
 * A second copy of what the game keeps on the device, for the native app.
 *
 * The game keeps its stars and two settings in the web page's localStorage. Inside the iPhone and iPad app that
 * is the web view's storage, which iOS may reclaim when the device runs low on space (Capacitor's storage guide
 * says so). So the app also keeps every saved entry in its own settings store, and puts an entry back into
 * localStorage at start when it is missing there (apps/web/src/backup.ts).
 *
 * Here is only the hook: with no backup set, which is always the case on the website, every function below is
 * a plain localStorage call, exactly as before.
 */
export interface Backup {
  /** Keep this text under this key. Never throws: the copy is a safety net, not the store the game reads. */
  set(key: string, value: string): void;
}

/** Every entry the game keeps on the device. A backup copies exactly these, and no other. */
export const STORED_KEYS = ['riddle-games:progress:v1', 'riddle-games:settings:v1'] as const;
export type StoredKey = (typeof STORED_KEYS)[number];

let backup: Backup | null = null;

/** Set (or, with null, drop) the second copy. Only the app does this. */
export function setBackup(b: Backup | null): void {
  backup = b;
}

/** Writes an entry to localStorage, and to the second copy when there is one. */
export function writeStored(key: StoredKey, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: the second copy below still keeps it */
  }
  try {
    backup?.set(key, value);
  } catch {
    /* ignore */
  }
}

/** Reads an entry from localStorage. The game reads only this; the second copy is read back once, at start. */
export function readStored(key: StoredKey): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The two sides of a restore, so that it can be tested without a device. */
export interface RestoreSides {
  /** localStorage, or a stand-in. */
  local: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  /** Reads the second copy. Resolves null for a key it doesn't hold. */
  get(key: string): Promise<string | null>;
  /** Writes the second copy. */
  set(key: string, value: string): Promise<unknown>;
}

/**
 * Brings both copies into line, once, at start:
 * - an entry missing from localStorage but held in the second copy is put back into localStorage;
 * - an entry in localStorage that the second copy lacks or holds differently is copied to it (an install
 *   from before the second copy, or a write that the app was ended before it reached).
 * localStorage wins wherever it has the entry: it is the store the game wrote last. Resolves with the keys
 * that were put back. Never rejects.
 */
export async function reconcileStored(sides: RestoreSides): Promise<StoredKey[]> {
  const restored: StoredKey[] = [];
  for (const key of STORED_KEYS) {
    try {
      const kept = await sides.get(key);
      // Read after the wait, so that a save the game made meanwhile is the one compared and copied.
      let local: string | null = null;
      try {
        local = sides.local.getItem(key);
      } catch {
        /* blocked storage counts as missing */
      }
      if (local === null) {
        if (kept !== null) {
          sides.local.setItem(key, kept);
          restored.push(key);
        }
      } else if (kept !== local) {
        await sides.set(key, local);
      }
    } catch {
      /* one entry that can't be read or written doesn't stop the other */
    }
  }
  return restored;
}

/** True when an entry is missing from localStorage, so that the start must first ask the second copy. */
export function anyStoredMissing(local: { getItem(key: string): string | null } = localStorage): boolean {
  try {
    return STORED_KEYS.some((k) => local.getItem(k) === null);
  } catch {
    return true;
  }
}
