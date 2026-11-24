import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { solve } from '../packages/engine/src/solver';
import type { RiddleRules } from '../packages/engine/src/types';

/** One level as the tests see it: where it lives, and the shortest way to win it. */
export interface LevelCase {
  number: number;
  id: string;
  title: string;
  /** Folder name under levels/. */
  dir: string;
  /** A shortest winning sequence, from the game's own solver run on the level's own rules. */
  moves: unknown[];
}

const LEVELS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'levels');

/**
 * Every folder under levels/ is found by itself, so a new level is played by these tests
 * without a change here. Its rules.ts must export `rules`, as docs/adding-a-level.md asks.
 */
async function discover(): Promise<LevelCase[]> {
  const out: LevelCase[] = [];
  for (const dir of readdirSync(LEVELS_DIR).sort()) {
    if (!/^\d\d-/.test(dir)) continue;
    const index = readFileSync(join(LEVELS_DIR, dir, 'src', 'index.ts'), 'utf8');
    const id = index.match(/\bid:\s*'([\w-]+)'/)?.[1];
    const number = Number(index.match(/\bnumber:\s*(\d+)/)?.[1]);
    const title = index.match(/\btitle:\s*(['"])(.+?)\1/)?.[2];
    if (!id || !number || !title) throw new Error(`levels/${dir}/src/index.ts: could not read id, number and title`);
    const mod = (await import(pathToFileURL(join(LEVELS_DIR, dir, 'src', 'rules.ts')).href)) as { rules?: RiddleRules<unknown, unknown> };
    if (!mod.rules) throw new Error(`levels/${dir}/src/rules.ts does not export "rules"`);
    const solution = solve(mod.rules);
    if (!solution) throw new Error(`levels/${dir}: the solver found no way to win`);
    out.push({ number, id, title, dir, moves: solution.moves });
  }
  return out.sort((a, b) => a.number - b.number);
}

export const LEVELS: LevelCase[] = await discover();
