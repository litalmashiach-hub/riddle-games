import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { RiddleRules } from '../../packages/engine/src/types';
import { LEVELS } from '../levels';
import { expect, expectCounter, passRulesCard, playMove, savedStars, test, waitForSession } from './fixtures';

/**
 * Undo while a loss plays out. A player who sees the mistake at once taps Undo during the loss scene,
 * before the "Oh no!" card. The tap has to work, and the level has to be exactly as it was before the
 * losing move: the same position and move count, the camera back on the whole scene, Redo ready to
 * bring the move back, no card, no saved stars, and nothing of the loss left to come afterwards.
 *
 * Every level that can be lost is tested. Its way to a loss is found from its own rules: the shortest
 * one where that is quick to find, else a fixed walk that never wins (levels lost by running out of moves).
 */

const LEVELS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'levels');

/** The moves to a loss: every move but the last keeps the level going. Null if the level cannot be lost. */
function lossPath<S, M>(rules: RiddleRules<S, M>): M[] | null {
  // Shortest way, as long as the search stays small.
  const seen = new Set([rules.key(rules.initialState)]);
  let layer: { state: S; path: M[] }[] = [{ state: rules.initialState, path: [] }];
  while (layer.length && seen.size < 20_000) {
    const next: typeof layer = [];
    for (const { state, path } of layer) {
      for (const m of rules.legalMoves(state)) {
        const after = rules.apply(state, m);
        const kind = rules.status(after).kind;
        if (kind === 'lost') return [...path, m];
        if (kind !== 'playing' || seen.has(rules.key(after))) continue;
        seen.add(rules.key(after));
        next.push({ state: after, path: [...path, m] });
      }
    }
    layer = next;
  }
  // A long way: a fixed walk that never wins, taking a losing move as soon as there is one.
  let state = rules.initialState;
  const path: M[] = [];
  let seed = 7;
  const pick = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
  for (let i = 0; i < 400; i++) {
    const moves = rules.legalMoves(state).map((m) => ({ m, after: rules.apply(state, m) }));
    const losing = moves.find((x) => rules.status(x.after).kind === 'lost');
    if (losing) return [...path, losing.m];
    const going = moves.filter((x) => rules.status(x.after).kind === 'playing');
    if (!going.length) return null;
    const { m, after } = going[pick(going.length)];
    path.push(m);
    state = after;
  }
  return null;
}

const CASES: { level: (typeof LEVELS)[number]; path: unknown[] }[] = [];
for (const level of LEVELS) {
  const { rules } = (await import(pathToFileURL(join(LEVELS_DIR, level.dir, 'src', 'rules.ts')).href)) as { rules: RiddleRules<unknown, unknown> };
  const path = lossPath(rules);
  if (path) CASES.push({ level, path });
}

test('the levels that can be lost are found', () => {
  // Most levels can be lost: by a wrong crossing, or by running out of moves. If this drops, the search broke.
  expect(CASES.length).toBeGreaterThanOrEqual(20);
});

/** Moves played one by one, with their animations. A longer way to the loss is set in one step. */
const PLAYED_MOVES = 4;

for (const { level, path } of CASES) {
  const nn = String(level.number).padStart(2, '0');
  test(`level ${nn} ${level.id}: Undo during the loss scene puts the level back`, async ({ page }) => {
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    await passRulesCard(page, level.title);
    // The camera's opening glide, and the scene's first frames.
    await page.waitForTimeout(3000);

    const before = path.slice(0, -1);
    if (before.length <= PLAYED_MOVES) {
      for (const [i, move] of before.entries()) await playMove(page, move, i + 1);
    } else {
      // Many moves (a level lost by running out of them): set the position at once, as an undo would show it.
      await page.evaluate((moves) => {
        const store = window.__riddle as any;
        const s = store.getState();
        const rules = s.level.rules;
        const history = [rules.initialState];
        for (const m of moves) history.push(rules.apply(history[history.length - 1], m));
        store.setState({ history, moves, future: [], status: rules.status(history[history.length - 1]), hint: null });
      }, before);
    }
    // Let the position settle, so the camera and the scene are at rest before the losing move.
    await page.waitForTimeout(2500);

    const read = () =>
      page.evaluate(() => {
        const s = window.__riddle!.getState();
        const cam = window.__camera!.camera.position;
        return {
          state: s.level.rules.key(s.history[s.history.length - 1]) as string,
          moves: s.moves.length as number,
          kind: s.status.kind as string,
          ended: s.ended as boolean,
          redo: s.future.length as number,
          camera: [cam.x, cam.y, cam.z] as number[],
        };
      });
    const start = await read();
    expect(start.kind).toBe('playing');
    const best = await page.evaluate(() => window.__riddle!.getState().level.bestMoves as number);

    // The bottom bar's Undo, where a thumb finds it. Measured now: the loss scene leaves the player little time.
    const undo = page.getByRole('button', { name: 'Undo', exact: true }).first();
    const box = (await undo.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // The level's own times, before the test stretches the wait for the card (below).
    const { move, end } = await page.evaluate(() => {
      const l = window.__riddle!.getState().level;
      return { move: l.moveDurationMs as number, end: (l.endDelayMs ?? 400) as number };
    });

    // The losing move. Watch for the end of the loss scene (the card), for the undo, and for what was under the finger.
    await page.evaluate((m) => {
      const store = window.__riddle as any;
      // Drawn in software, a frame here can take a second, and a tap is handled a frame or two late. So that the
      // tap still lands before the card, the card waits 20 s longer than in the game. The loss scene itself is not
      // changed: it plays on its own clock, and the tap comes as it begins.
      store.getState().level.endDelayMs = (store.getState().level.endDelayMs ?? 400) + 20_000;
      const seen: string[] = ((window as any).__undoLog = []);
      store.subscribe((now: any, was: any) => {
        if (now.ended && !was.ended) seen.push('card');
        if (now.moves.length < was.moves.length) seen.push('undo');
      });
      store.getState().play(m);
    }, path[path.length - 1]);
    await page.waitForFunction(
      ([px, py]) => {
        const s = window.__riddle!.getState();
        if (s.status.kind !== 'lost' || s.busy) return false;
        const under = document.elementFromPoint(px, py)?.closest('button');
        (window as any).__under = under ? `${under.getAttribute('aria-label')}${(under as HTMLButtonElement).disabled ? ' (disabled)' : ''}` : 'nothing';
        return true;
      },
      [x, y],
      { polling: 50 },
    );

    // The loss scene is playing. A tap on Undo, through the touch screen.
    await page.touchscreen.tap(x, y);
    expect(await page.evaluate(() => (window as any).__under), 'what was under the finger as the loss scene began').toBe('Undo');

    await expect.poll(() => page.evaluate(() => (window as any).__undoLog as string[])).toContain('undo');
    expect(await page.evaluate(() => (window as any).__undoLog), 'the undo came before the loss card').toEqual(['undo']);

    // Wait past the time the card would have come in the game, and the camera's way back.
    await page.waitForTimeout(move + end + 2500);

    const after = await read();
    expect(after.state, 'the position before the losing move').toBe(start.state);
    expect(after.moves).toBe(start.moves);
    expect(after.kind).toBe('playing');
    expect(after.ended, 'no loss card to come').toBe(false);
    expect(after.redo, 'Redo can bring the move back').toBe(1);
    for (const [i, v] of after.camera.entries()) expect(Math.abs(v - start.camera[i]), 'the camera is back on the whole scene').toBeLessThan(0.05);
    expect(await page.evaluate(() => (window as any).__undoLog)).toEqual(['undo']);
    await expect(page.getByRole('heading', { name: 'Oh no!' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
    await expectCounter(page, start.moves, best);
    expect(await savedStars(page)).toEqual({});
  });
}
