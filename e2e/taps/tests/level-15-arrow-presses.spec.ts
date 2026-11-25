import type { Page } from '@playwright/test';
import { cellPos } from '../../../levels/15-slippery-pond/src/layout';
import { STEP, type Move, type State } from '../../../levels/15-slippery-pond/src/rules';
import { LEVELS } from '../../levels';
import { expect, expectClean, passRulesCard, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { READ_SCENE, Taps, waitCameraStill, waitIdle, type Vec3 } from '../harness';

/**
 * Level 15's arrows take every press, however it is made. The app play on an iPhone 17 Pro Max saw one
 * press on the right arrow move nothing (step 5). A press now counts when the finger lifts: it no longer
 * waits for the browser's click, which iOS does not send after a press held a little long, and the place
 * that takes it stands still at full size while the arrow drawn on it pops in and bobs.
 *
 * Here each press is a finger put down on the arrow and lifted with no click after it: the case a click
 * handler misses. Every move of the solution must follow, once, with no page error.
 */
const level = LEVELS.find((l) => l.id === 'slippery-pond')!;
const FAKE_POINTER = 41;

/** Finger down, held, finger up, as pointer events alone: no click follows. */
async function pressWithoutClick(page: Page, at: { x: number; y: number }, holdMs: number) {
  const send = (type: string) =>
    page.evaluate(
      ([t, x, y, id]) => {
        const el = document.elementFromPoint(x, y)!;
        const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, buttons: t === 'pointerdown' ? 1 : 0 };
        el.dispatchEvent(new PointerEvent(t, init));
      },
      [type, at.x, at.y, FAKE_POINTER] as const,
    );
  await send('pointerdown');
  await page.waitForTimeout(holdMs);
  await send('pointerup');
}

for (const holdMs of [60, 900]) {
  test(`level 15: every arrow press counts on the lift, held ${holdMs} ms, with no click`, async ({ page, faults }) => {
    const size = page.viewportSize()!;
    const taps = new Taps(page, level, size);
    await page.addInitScript(READ_SCENE);
    // The pointer below is made up, so the browser knows no such pointer: the camera's pointer capture of
    // it would throw. Only for that one id, capture is a no-op here; real touches are untouched.
    await page.addInitScript((id) => {
      for (const name of ['setPointerCapture', 'releasePointerCapture'] as const) {
        const real = Element.prototype[name];
        Element.prototype[name] = function (this: Element, pointerId: number) {
          if (pointerId !== id) real.call(this, pointerId);
        };
      }
    }, FAKE_POINTER);
    await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    await passRulesCard(page, level.title);
    await page.waitForFunction(() => window.__taps.ready());
    await waitCameraStill(page);
    await waitIdle(page);

    for (const [i, move] of (level.moves as Move[]).entries()) {
      const state = (await taps.snapshot()).state as State;
      const [dx, dy] = STEP[move.dir];
      const here = cellPos(state.x, state.y);
      const place: Vec3 = [here[0] + dx * 0.76, 0.06, here[2] + dy * 0.76];
      // The arrow's pad, found by its place beside the otter.
      await expect.poll(async () => !!(await taps.targetNear(place, { within: 0.2 })), { timeout: 10_000 }).toBe(true);
      const pt = await taps.screenOf(place);
      await pressWithoutClick(page, pt, holdMs);
      await page.waitForFunction((n) => window.__riddle!.getState().moves.length >= n, i + 1, { timeout: 15_000, polling: 100 });
      const s = await page.evaluate(() => {
        const st = window.__riddle!.getState();
        return { count: st.moves.length, last: st.moves[st.moves.length - 1] };
      });
      expect(s, `move ${i + 1} (${move.dir})`).toEqual({ count: i + 1, last: move });
      await waitIdle(page);
    }
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 30_000 });
    expect((await taps.snapshot()).moves.length, 'one move for each press, none twice').toBe(level.moves.length);
    expectClean(faults);
  });
}
