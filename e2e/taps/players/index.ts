import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { TapPlayer } from '../harness';

/**
 * The player for each level, by the level's id. Every file in this folder named NN-name.ts exports
 * `players`, a record from level id to player: its own level, and each level that plays in the same scene.
 * A level with no player fails the run's last test by name; a file that cannot be loaded is listed in
 * BROKEN_PLAYERS and fails it too.
 */
const HERE = dirname(fileURLToPath(import.meta.url));

export const PLAYERS: Record<string, TapPlayer> = {};
export const BROKEN_PLAYERS: { file: string; error: string }[] = [];

for (const file of readdirSync(HERE).sort()) {
  if (!/^\d\d-.*\.ts$/.test(file)) continue;
  try {
    const mod = (await import(pathToFileURL(join(HERE, file)).href)) as { players?: Record<string, TapPlayer> };
    if (!mod.players) throw new Error('it does not export "players"');
    Object.assign(PLAYERS, mod.players);
  } catch (e) {
    BROKEN_PLAYERS.push({ file, error: e instanceof Error ? e.message : String(e) });
  }
}
