import type { Page } from '@playwright/test';
import { KNOWN_FAULTS } from '../../known-faults';
import { LEVELS, type LevelCase } from '../../levels';
import { expect, expectClean, passRulesCard, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { ALLOW_FAKE_POINTER, FAKE_POINTER, READ_SCENE, Taps, pressWithoutClick, waitCameraStill, waitIdle, type Point, type Vec3 } from '../harness';
import { PLAYERS } from '../players';

/**
 * The shared Clickable (packages/fx) takes every press on the scene, however it is made, and each once.
 *
 * A tap there counted on the browser's click. iOS sends no click for a press held a little long (and an
 * overloaded device stretches every tap), so such a press did nothing. A tap now counts when the finger
 * lifts on what it pressed, having moved no more than a tap may; the click that may follow is held off.
 * Level 15's arrows have done the same since #74 (level-15-arrow-presses.spec.ts).
 *
 * 1. Levels whose scene taps all go through Clickable are won by presses lifted with no click after them.
 * 2. On level 2, one tap on the goat puts it in the boat, once, whether it comes as a touch, a press with
 *    no click or a mouse click; and a drag that begins on the goat (out and back, or ending off it) puts
 *    nothing in the boat, nor do two fingers held still.
 * 3. A key on a button of the page right after a scene press with no click gets through: only the scene's
 *    own click is held off.
 */

async function open(page: Page, level: LevelCase) {
  await page.addInitScript(READ_SCENE);
  await page.addInitScript(ALLOW_FAKE_POINTER, FAKE_POINTER);
  await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
  await page.goto(`?debug&quality=low#/level/${level.id}`);
  await waitForSession(page, level.id);
  await passRulesCard(page, level.title);
  await page.waitForFunction(() => window.__taps.ready());
  await waitCameraStill(page);
  await waitIdle(page);
}

// Levels whose every scene tap is a Clickable's, with a short solution, and no known tap fault.
const WON_BY_PRESSES: { id: string; holds: number[] }[] = [
  { id: 'wolf-goat-cabbage', holds: [60, 900] },
  { id: 'two-jugs', holds: [900] },
  { id: 'firefly-jars', holds: [900] },
  { id: 'pancake-stack', holds: [900] },
];

for (const { id, holds } of WON_BY_PRESSES) {
  const level = LEVELS.find((l) => l.id === id)!;
  for (const holdMs of holds) {
    test(`level ${level.number} ${id}: won by presses held ${holdMs} ms, with no click`, async ({ page, faults }) => {
      const pageFault = KNOWN_FAULTS[id];
      if (pageFault?.when === 'start') faults.knownPattern = pageFault.pageError;
      const taps = new Taps(page, level, page.viewportSize()!);
      taps.pressHoldMs = holdMs;
      await open(page, level);
      const player = PLAYERS[id];
      await player.setup?.(taps);
      for (const [i, move] of level.moves.entries()) {
        taps.step = i + 1;
        const before = await taps.snapshot();
        await player.move(taps, move, before.state, i);
        await page.waitForFunction((n) => window.__riddle!.getState().moves.length >= n, i + 1, { timeout: 12_000 });
        const after = await page.evaluate(
          ([prev, want]) => {
            const s = window.__riddle!.getState();
            const r = s.level.rules;
            return { count: s.moves.length, same: r.key(s.history[s.history.length - 1]) === r.key(r.apply(prev, want)) };
          },
          [before.state, move] as const,
        );
        expect(after, `move ${i + 1}: ${JSON.stringify(move)}, made once`).toEqual({ count: i + 1, same: true });
        await waitIdle(page);
      }
      await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 60_000 });
      expect((await taps.snapshot()).moves.length, 'one move for each, none twice').toBe(level.moves.length);
      expectClean(faults);
    });
  }
}

test.describe('level 2: one tap on the goat, once; a drag, never', () => {
  const level = LEVELS.find((l) => l.id === 'wolf-goat-cabbage')!;
  // Where the goat stands on the left bank (levels/02-wolf-goat-cabbage/src/Scene.tsx, SLOTS, mirrored).
  const GOAT: Vec3 = [-3.8, 0, 1.4];
  const row = (page: Page) => page.getByRole('button', { name: /Row across/ });

  /** The level opened, and the clear middle of the goat on the screen. */
  async function goat(page: Page) {
    await open(page, level);
    const taps = new Taps(page, level, page.viewportSize()!);
    const t = await taps.targetNear(GOAT, { handler: 'onClick', within: 1.2 });
    expect(t, 'the goat listens for taps').toBeTruthy();
    await expect(row(page)).toContainText('alone');
    return { taps, at: await taps.clearMiddleOf(t!) };
  }

  /** The Row button reads `want`, and still does a moment later: no second act came after the first. */
  async function staysWith(page: Page, want: RegExp) {
    await expect(row(page)).toContainText(want);
    await page.waitForTimeout(1500);
    await expect(row(page)).toContainText(want);
    expect((await page.evaluate(() => window.__riddle!.getState().moves.length)), 'no move was made').toBe(0);
  }

  const camera = (page: Page) => page.evaluate(() => JSON.stringify(window.__taps.camera()?.map((n) => Math.round(n * 1e3))));

  test('a touch tap', async ({ page, faults }) => {
    const { at } = await goat(page);
    await page.touchscreen.tap(at.x, at.y);
    await staysWith(page, /with goat/);
    expectClean(faults);
  });

  for (const holdMs of [60, 900]) {
    test(`a press held ${holdMs} ms with no click`, async ({ page, faults }) => {
      const { at } = await goat(page);
      await pressWithoutClick(page, at, holdMs);
      await staysWith(page, /with goat/);
      expectClean(faults);
    });
  }

  test('a mouse click', async ({ page, faults }) => {
    const { at } = await goat(page);
    await page.mouse.click(at.x, at.y);
    await staysWith(page, /with goat/);
    expectClean(faults);
  });

  /** Real touches by finger number, so that one finger can lift while another stays. */
  async function fingers(page: Page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', down: [id: number, at: Point][] = []) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: down.map(([id, p]) => ({ x: Math.round(p.x), y: Math.round(p.y), id })) });
    return { send, done: () => cdp.detach() };
  }

  // A finger that goes out and comes back to where it went down turned the camera on the way: no tap. The
  // way out is short, so the goat is under the finger again at the lift (after a wide turn it would have
  // swung away, and the lift would miss it whatever the tap code did). Only the memory of how far the finger
  // wandered makes this a drag: with that memory taken out of pressOnLift.ts, each of these fails.
  for (const out of [16, 24, 40]) {
    test(`a drag that begins on the goat, goes ${out} px out and comes back to it`, async ({ page, faults }) => {
      const { at } = await goat(page);
      const hit = (p: Point) => page.evaluate(({ x, y }) => window.__taps.firstHit(x, y)?.uuid ?? null, p);
      const pressed = await hit(at);
      expect(pressed, 'the finger goes down on the goat').toBeTruthy();
      const before = await camera(page);
      let turned = false;
      const finger = await fingers(page);
      await finger.send('touchStart', [[1, at]]);
      await page.waitForTimeout(80);
      for (const k of [0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
        await finger.send('touchMove', [[1, { x: at.x + out * k, y: at.y }]]);
        await page.waitForTimeout(40);
        if (k === 1) turned = (await camera(page)) !== before;
      }
      expect(turned, 'the drag turned the camera on the way').toBe(true);
      // The finger rests where it went down until the camera has swung back with it: what it then lifts on
      // is the goat it pressed.
      await expect.poll(() => hit(at), { message: 'the goat is under the finger when it lifts', timeout: 10_000 }).toBe(pressed);
      await finger.send('touchEnd');
      await finger.done();
      await staysWith(page, /alone/);
      expectClean(faults);
    });
  }

  // Two fingers are a camera gesture, however still they are held.
  for (const [name, second, firstUp] of [
    ['the goat finger lifts first', 'sky', 'goat'],
    ['the other finger lifts first', 'sky', 'other'],
    ['both on the goat', 'goat', 'goat'],
  ] as const) {
    test(`two fingers held still, ${name}: nothing`, async ({ page, faults }) => {
      const { at } = await goat(page);
      const other: Point = second === 'sky' ? { x: at.x, y: 15 } : { x: at.x + 3, y: at.y + 3 };
      const finger = await fingers(page);
      await finger.send('touchStart', [[1, at]]);
      await page.waitForTimeout(60);
      await finger.send('touchStart', [[1, at], [2, other]]);
      await page.waitForTimeout(120);
      // One finger lifts (the touch list without it), then the other.
      await finger.send('touchMove', firstUp === 'goat' ? [[2, other]] : [[1, at]]);
      await page.waitForTimeout(120);
      await finger.send('touchEnd');
      await finger.done();
      await staysWith(page, /alone/);
      expectClean(faults);
    });
  }

  test('a single finger after two still taps as before', async ({ page, faults }) => {
    const { at } = await goat(page);
    const sky: Point = { x: at.x, y: 15 };
    const finger = await fingers(page);
    await finger.send('touchStart', [[1, at]]);
    await finger.send('touchStart', [[1, at], [2, sky]]);
    await page.waitForTimeout(120);
    await finger.send('touchEnd');
    await finger.done();
    await expect(row(page)).toContainText('alone');
    await page.touchscreen.tap(at.x, at.y);
    await staysWith(page, /with goat/);
    expectClean(faults);
  });

  // The click that is held off is the scene's own. A click with no press of its own, on a button of the page
  // (Enter or Space on it, a screen reader's activation), is the player's next act and must get through, also
  // in the moment after a scene press that brought no click.
  test('Enter on the Row button right after a drag that began on the goat rows the boat', async ({ page, faults }) => {
    const { at } = await goat(page);
    await row(page).focus();
    // Out and back, and lifted on the goat: a drag, which the goat takes as its own, with no click after it.
    await pressWithoutClick(page, at, 60, [{ x: at.x + 10, y: at.y }, { x: at.x + 20, y: at.y }, { x: at.x + 10, y: at.y }, at]);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__riddle!.getState().moves.length === 1, undefined, { timeout: 5_000 });
    expect(await page.evaluate(() => window.__riddle!.getState().moves.length), 'one crossing, alone').toBe(1);
    expectClean(faults);
  });

  test('Space on the Rules button right after a long press on the goat opens the rules', async ({ page, faults }) => {
    const { at } = await goat(page);
    const rules = page.getByRole('button', { name: 'Rules', exact: true });
    await rules.focus();
    await pressWithoutClick(page, at, 900);
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
    // The press itself still counted, once.
    await page.getByRole('button', { name: "Let's go!" }).tap();
    await staysWith(page, /with goat/);
    expectClean(faults);
  });

  test('a touch drag from the goat to open ground', async ({ page, faults }) => {
    const { taps, at } = await goat(page);
    const size = page.viewportSize()!;
    // Up and away from the figures, toward the sky.
    const to: Point = { x: at.x, y: Math.max(20, at.y - size.height * 0.35) };
    await taps.dragAt(at, to, 'from the goat to the sky');
    await waitCameraStill(page);
    await staysWith(page, /alone/);
    expectClean(faults);
  });
});
