import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/** A level folder that the tests could not load, and why. It becomes one failing test that names it. */
export interface BrokenLevel {
  dir: string;
  error: string;
}

async function load(dir: string): Promise<LevelCase> {
  const src = join(LEVELS_DIR, dir, 'src');
  if (!existsSync(join(src, 'index.ts'))) throw new Error(`levels/${dir}/src/index.ts is missing`);
  const index = readFileSync(join(src, 'index.ts'), 'utf8');
  const id = index.match(/\bid:\s*'([\w-]+)'/)?.[1];
  const number = Number(index.match(/\bnumber:\s*(\d+)/)?.[1]);
  const title = index.match(/\btitle:\s*(['"])(.+?)\1/)?.[2];
  if (!id || !number || !title) throw new Error(`levels/${dir}/src/index.ts: could not read id, number and title`);
  if (!existsSync(join(src, 'rules.ts'))) {
    throw new Error(
      `levels/${dir}/src/rules.ts is missing. The play-through tests solve each level from its own rules.ts, which must export "rules" and import no React or Three.js (docs/adding-a-level.md). A level that reuses another level's scene still keeps its own puzzle there.`,
    );
  }
  let mod: { rules?: RiddleRules<unknown, unknown> };
  try {
    mod = (await import(pathToFileURL(join(src, 'rules.ts')).href)) as typeof mod;
  } catch (e) {
    throw new Error(`levels/${dir}/src/rules.ts could not be loaded: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!mod.rules) throw new Error(`levels/${dir}/src/rules.ts does not export "rules"`);
  const solution = solve(mod.rules);
  if (!solution) throw new Error(`levels/${dir}: the solver found no way to win`);
  return { number, id, title, dir, moves: solution.moves };
}

/**
 * Every folder under levels/ is found by itself, so a new level is played by these tests
 * without a change here. Its rules.ts must export `rules`, as docs/adding-a-level.md asks.
 * A folder that cannot be loaded does not stop the others: it is listed in BROKEN_LEVELS,
 * and levels.spec.ts fails one test for it, by name.
 */
async function discover(): Promise<{ levels: LevelCase[]; broken: BrokenLevel[] }> {
  const levels: LevelCase[] = [];
  const broken: BrokenLevel[] = [];
  for (const dir of readdirSync(LEVELS_DIR).sort()) {
    if (!/^\d\d-/.test(dir)) continue;
    try {
      levels.push(await load(dir));
    } catch (e) {
      broken.push({ dir, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { levels: levels.sort((a, b) => a.number - b.number), broken };
}

const found = await discover();
export const LEVELS: LevelCase[] = found.levels;
export const BROKEN_LEVELS: BrokenLevel[] = found.broken;
