import { LEVELS } from '../../levels';
import { expect, expectClean, passRulesCard, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { READ_SCENE, Taps, waitCameraStill, waitIdle, type Point, type Vec3 } from '../harness';
import { padPos } from '../../../levels/14-firefly-lanterns/src/layout';
import { LAYOUT as MIRRORS } from '../../../levels/17-moonbeam-mirrors/src/rules';
import { cellPos } from '../../../levels/15-slippery-pond/src/layout';
import { DIRS, POND, SIZE, type PondPuzzle } from '../../../levels/15-slippery-pond/src/rules';
import { pond as FROSTY } from '../../../levels/24-frosty-maze/src/rules';

/** Where level 17's crystal of a mirror stands. From e2e/taps/players/17-moonbeam-mirrors.ts. */
const crystalAt = (mirror: number): Vec3 => {
  const m = MIRRORS.mirrors[mirror];
  return [(m.c - 2) * 1.3, 0, (m.r - 2) * 1.3];
};

/**
 * Quick taps: a player who taps every 0.4 s makes the next tap while the last move still animates. Such a
 * tap is held and taken when the move is over (packages/fx/src/heldTaps.tsx), so every move they meant is
 * made, in order. Before, the tap was dropped without a sign and the one after it was misread: in level 4
 * the tower ended where it began. Real touches on the scene, timed by the clock, with no wait for the scene.
 *
 * The targets tapped here stand still (pillars, lily pads, crystals), so their screen points are read once.
 *
 * Timed by the wall clock: run this file with one worker (E2E_WORKERS=1). With two browsers drawing in
 * software side by side, a single touch can take longer than a move, and the Undo and Restart checks below
 * then find no touch during a move to hold.
 */

const GAP_MS = 400;
/**
 * A slow test machine can stretch a touch past a whole move, so that the case this file is about (a touch
 * while a move animates) does not come up at all. Such a try proves nothing either way: the level is
 * restarted and tapped again, at most this many times. A try that came up and went wrong fails at once.
 */
const TRIES = 3;

/** Back to the level's start, through the game's own Restart button, with the touch count at 0. */
async function restart(page: import('@playwright/test').Page) {
  await page.evaluate(() => (document.querySelector('button[aria-label="Restart"]') as HTMLButtonElement).click());
  await page.waitForFunction(() => window.__riddle!.getState().moves.length === 0);
  await waitIdle(page);
  await page.evaluate(() => ((window as any).__busyTouches = 0));
}

interface Case {
  id: string;
  /** How many moves of the solution are tapped quickly; the rest are tapped at a calm pace. */
  quick: number;
  /** The world points tapped, in order, for one move. */
  touches(move: any): Vec3[];
  /**
   * One tap a move, and moves of about 1 s: on a slow test machine a touch takes about as long, so whether
   * any of them lands during a move is up to the machine. Not asked of this case.
   */
  overlapUnsure?: boolean;
}

const PEG_X = [-2.7, 0, 2.7];
/** From levels/10-four-pillar-tower/src/Scene.tsx (PX). */
const PX = [-3.75, -1.25, 1.25, 3.75];
const CASES: Case[] = [
  // Lift and drop: two taps a move, 1.2 s of animation a move.
  { id: 'tower-of-hanoi', quick: 6, touches: (m) => [[PEG_X[m.from], 0, 0], [PEG_X[m.to], 0, 0]] },
  // The same with four pillars and 1.0 s moves, found by a first-time player as well.
  { id: 'four-pillar-tower', quick: 6, touches: (m) => [[PX[m.from], 0, 0], [PX[m.to], 0, 0]] },
  // One tap a move, on a button that the scene disables while busy (the shared Clickable).
  { id: 'firefly-lanterns', quick: 99, touches: (m) => [padPos(m.cell)], overlapUnsure: true },
];

async function open(page: import('@playwright/test').Page, id: string) {
  const level = LEVELS.find((l) => l.id === id)!;
  await page.addInitScript(READ_SCENE);
  await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
  await page.goto(`?debug&quality=low#/level/${level.id}`);
  await waitForSession(page, level.id);
  await passRulesCard(page, level.title);
  await page.waitForFunction(() => window.__taps.ready());
  await waitCameraStill(page);
  await waitIdle(page);
  // Counts the touches that land while a move still animates: the ones this file is about.
  await page.evaluate(() => {
    const w = window as any;
    w.__busyTouches = 0;
    document.addEventListener('pointerdown', () => w.__riddle.getState().busy && w.__busyTouches++, true);
  });
  return level;
}

/** The screen point of each listening thing at these world points, read now. */
async function pointsOf(taps: Taps, worlds: Vec3[]): Promise<Point[]> {
  const out: Point[] = [];
  for (const w of worlds) {
    const t = await taps.targetNear(w, { handler: 'onClick', within: 0.5 });
    expect(t, `something listens at ${JSON.stringify(w)}`).toBeTruthy();
    out.push(taps.middleOf(t!));
  }
  return out;
}

/** Taps at these points on a fixed beat, never waiting for the scene. */
async function tapOnBeat(page: import('@playwright/test').Page, points: Point[]) {
  const start = Date.now();
  for (const [i, p] of points.entries()) {
    const wait = start + i * GAP_MS - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await page.touchscreen.tap(p.x, p.y);
  }
}

/** The session's moves lead where the solution's first `n` lead. */
async function expectSolutionPrefix(page: import('@playwright/test').Page, moves: unknown[], n: number) {
  await page.waitForFunction((k) => window.__riddle!.getState().moves.length >= k, n, { timeout: 60_000 });
  await waitIdle(page);
  const same = await page.evaluate(
    ([want, k]) => {
      const s = window.__riddle!.getState();
      const r = s.level.rules;
      let st = r.initialState;
      for (const m of (want as unknown[]).slice(0, k as number)) st = r.apply(st, m);
      return { count: s.moves.length, same: r.key(s.history[s.history.length - 1]) === r.key(st) };
    },
    [moves, n] as const,
  );
  expect(same.count, 'exactly one move for each move tapped').toBe(n);
  expect(same.same, 'the moves made are the ones tapped').toBe(true);
}

for (const c of CASES) {
  test(`${c.id}: taps 0.4 s apart all count`, async ({ page, faults }) => {
    const level = await open(page, c.id);
    const taps = new Taps(page, level, page.viewportSize()!);
    const moves = level.moves as any[];
    const quick = Math.min(c.quick, moves.length);
    const worlds = moves.slice(0, quick).flatMap((m) => c.touches(m));
    for (let tri = 1; ; tri++) {
      await tapOnBeat(page, await pointsOf(taps, worlds));
      await expectSolutionPrefix(page, moves, quick);
      // A slow machine stretches the beat, so check that some touches really came while a move animated.
      const overlap = await page.evaluate(() => (window as any).__busyTouches);
      if (c.overlapUnsure || overlap > 0) break;
      if (tri === TRIES) expect(overlap, `touches made while a move animated, in ${TRIES} tries`).toBeGreaterThan(0);
      await restart(page);
    }
    // The rest at a calm pace, so the level is won.
    for (let i = quick; i < moves.length; i++) {
      for (const p of await pointsOf(taps, c.touches(moves[i]))) {
        await page.touchscreen.tap(p.x, p.y);
        await page.waitForTimeout(GAP_MS);
      }
      await expectSolutionPrefix(page, moves, i + 1);
    }
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
    expectClean(faults);
  });
}

/**
 * Level 17: one tap turns a crystal, and the beam takes 1.9 s to settle. The first tap makes a move; the
 * second, made while that move animates, is held. The game's own button is then pressed at once, from the
 * page, right after that second touch (a finger is too slow here to be sure to come before the move ends):
 * nothing that was held may act afterwards.
 */
for (const button of ['Undo', 'Restart']) {
  test(`moonbeam-mirrors: a tap held during a move is let go at ${button}`, async ({ page, faults }) => {
    const level = await open(page, 'moonbeam-mirrors');
    const taps = new Taps(page, level, page.viewportSize()!);
    const [first, second] = level.moves as any[];
    const points = await pointsOf(taps, [crystalAt(first.mirror), crystalAt(second.mirror)]);
    for (let tri = 1; ; tri++) {
      await page.evaluate((label) => {
        const w = window as any;
        w.__pressed = null;
        // The first touch that comes down while a move animates: once it is lifted (and the scene has held it), press.
        const down = () => {
          if (!w.__riddle.getState().busy) return;
          document.removeEventListener('pointerdown', down, true);
          const up = () => {
            document.removeEventListener('pointerup', up, true);
            setTimeout(() => {
              w.__busyAtPress = w.__riddle.getState().busy;
              (document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click();
              w.__pressed = w.__riddle.getState().moves.length;
            }, 0);
          };
          document.addEventListener('pointerup', up, true);
        };
        document.addEventListener('pointerdown', down, true);
      }, button);
      // The second touch goes down as soon as the first move is seen to start (1.9 s of animation follow).
      await tapOnBeat(page, points.slice(0, 1));
      await page.waitForFunction(() => window.__riddle!.getState().busy, undefined, { timeout: 20_000 });
      await tapOnBeat(page, points.slice(1));
      await page.waitForFunction(() => (window as any).__pressed !== null, undefined, { timeout: 20_000 });
      // The first move was over before the button was pressed: a slow machine, and the case did not come up.
      const busyAtPress = await page.evaluate(() => (window as any).__busyAtPress);
      if (busyAtPress || tri === TRIES) {
        expect(busyAtPress, `the first move still animated when ${button} was pressed, in ${TRIES} tries`).toBe(true);
        break;
      }
      await page.waitForTimeout(3000);
      await restart(page);
    }
    expect(await page.evaluate(() => (window as any).__pressed), `no move left once ${button} was pressed`).toBe(0);
    // Long enough for a held tap to have acted, had it been kept.
    await page.waitForTimeout(3000);
    await waitIdle(page);
    expect((await taps.snapshot()).moves.length, `nothing played after ${button}`).toBe(0);
    expectClean(faults);
  });
}

/**
 * Levels 15 and 24 (the slippery pond scene): a tap on the ice slides the otter towards it, in line with
 * where the otter is when the tap is taken. A tap held during a slide is measured from where that slide
 * stopped, and the slide it asks for is made right then, not put behind taps that came after it: once it
 * was, the next held tap was measured from where the otter stood before, and slid it a way nobody tapped.
 *
 * The first tap starts a slide; two more come while it runs (or just after): the first of them is in line
 * with where the slide stops, and slides on; the second is in line with that stop but not with the next,
 * so it is refused ("Tap in line with the otter"). Exactly two moves, ending where the second one ends.
 */
const PONDS: { id: string; pond: PondPuzzle }[] = [
  { id: 'slippery-pond', pond: POND },
  { id: 'frosty-maze', pond: FROSTY },
];

/** A first slide, a second from where it stops, and a cell in line with the first stop only. From the rules. */
function pondCase(pond: PondPuzzle) {
  const plain = (s: { x: number; y: number }) => pond.cellAt(s.x, s.y) === '.';
  const playing = (s: { x: number; y: number }) => pond.rules.status(s).kind === 'playing';
  const s0 = pond.start;
  let best: { p1: { x: number; y: number }; p2: { x: number; y: number }; off: { x: number; y: number }; steps: number } | null = null;
  for (const d1 of DIRS) {
    const a = pond.slide(s0, d1);
    if (a.steps < 2 || !plain(a.to) || !playing(a.to)) continue;
    for (const d2 of DIRS) {
      const b = pond.slide(a.to, d2);
      if (b.steps === 0 || !plain(b.to) || !playing(b.to)) continue;
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const c = { x, y };
          const inLineWithP1 = (x === a.to.x) !== (y === a.to.y);
          if (!inLineWithP1 || x === b.to.x || y === b.to.y || !plain(c)) continue;
          if (!best || a.steps > best.steps) best = { p1: a.to, p2: b.to, off: c, steps: a.steps };
        }
    }
  }
  if (!best) throw new Error('no such case on this pond');
  return best;
}

for (const { id, pond } of PONDS) {
  test(`${id}: a tap held during a slide is measured from where the otter stopped`, async ({ page, faults }) => {
    const level = await open(page, id);
    const taps = new Taps(page, level, page.viewportSize()!);
    const { p1, p2, off } = pondCase(pond);
    const [first, second, third] = [await taps.screenOf(cellPos(p1.x, p1.y)), await taps.screenOf(cellPos(p2.x, p2.y)), await taps.screenOf(cellPos(off.x, off.y))];
    await page.touchscreen.tap(first.x, first.y);
    await page.waitForFunction(() => window.__riddle!.getState().busy, undefined, { timeout: 20_000 });
    await page.touchscreen.tap(second.x, second.y);
    await page.touchscreen.tap(third.x, third.y);
    expect(await page.evaluate(() => (window as any).__busyTouches), 'a touch made while the first slide ran').toBeGreaterThan(0);
    // Long enough for both slides, and for a third, had one been made.
    await page.waitForFunction(() => window.__riddle!.getState().moves.length >= 2, undefined, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    await waitIdle(page);
    const at = await page.evaluate(() => {
      const s = window.__riddle!.getState();
      return { moves: s.moves.length, at: s.history[s.history.length - 1] };
    });
    expect(at.moves, `two slides, to (${p1.x},${p1.y}) then (${p2.x},${p2.y}); the tap on (${off.x},${off.y}) is not in line`).toBe(2);
    expect(at.at, 'the otter is where the second tap sent it').toEqual(p2);
    expectClean(faults);
  });
}
