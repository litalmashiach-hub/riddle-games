import { anyStoredMissing, reconcileStored, setBackup, type StoredKey } from '@riddle/engine';
import { APP_SHELL } from './appShell';

/**
 * The app's second copy of the stars and settings, in Capacitor's Preferences store (UserDefaults on iOS).
 *
 * Why: in the app, localStorage is the web view's storage, which iOS may reclaim when the device runs low on
 * space. A player would then lose every star. Preferences is the app's own settings store, which iOS keeps
 * until the app is uninstalled. See docs/ios-app.md, "Keeping progress safe".
 *
 * - Every save writes both (packages/engine/src/backup.ts). Reset progress saves the empty progress, so it
 *   clears both too.
 * - At start, an entry missing from localStorage is put back from the copy before the first screen is drawn.
 *   The start waits for that only when an entry is missing: on a usual start it draws at once, and the copy is
 *   brought into line beside it.
 * - Only in the app build (`APP_SHELL`), and only where Capacitor runs natively. The website build drops all
 *   of this at build time: it loads no plugin, and its storage is exactly as before.
 */

/** Set up the copy. Resolves with the keys that were put back into localStorage. */
async function startBackup(): Promise<StoredKey[]> {
  const [{ Capacitor }, { Preferences }] = await Promise.all([import('@capacitor/core'), import('@capacitor/preferences')]);
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Preferences')) return [];
  // The game's own reads never wait on this: they stay on localStorage. A write that fails here is mended at
  // the next start, when localStorage still holds the entry.
  setBackup({ set: (key, value) => void Preferences.set({ key, value }).catch(() => {}) });
  return reconcileStored({
    local: localStorage,
    get: async (key) => (await Preferences.get({ key })).value,
    set: (key, value) => Preferences.set({ key, value }),
  });
}

/**
 * Call once, before the first screen is drawn. Returns null when the start needn't wait (the website, or an app
 * start with both entries in place), else a promise of the keys put back. Never rejects.
 */
export function restoreBackup(): Promise<StoredKey[]> | null {
  if (!APP_SHELL) return null;
  const done = startBackup().catch(() => [] as StoredKey[]);
  return anyStoredMissing() ? done : null;
}
