import { cellPos } from '../../../levels/15-slippery-pond/src/layout';
import { STEP, type Move, type State } from '../../../levels/15-slippery-pond/src/rules';
import { decodePng } from '../../contrast';
import { LEVELS } from '../../levels';
import { expect, expectClean, passRulesCard, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { READ_SCENE, Taps, waitCameraStill, waitIdle, type Vec3 } from '../harness';

/**
 * Levels 15 and 24: the arrow for every move of the shortest route shows on the screen, and a real touch
 * where it shows makes that move.
 *
 * A newcomer's play at 852 by 393 found that, twice on level 15's shortest route (below the top rim and on
 * the snow drift), the up arrow lay on the ice behind the otter's body and could not be seen: only the
 * arrows a player did not need showed. The arrows are now drawn over everything else.
 *
 * "Shows" is read from the screen itself, not from the scene's geometry: the pixels around the arrow's place
 * are counted, and enough of them must have the arrow's glow colour (lime, or gold when hinted). The otter,
 * the ice, the snow and the water have none of it. Then one touch-screen tap on the middle of those pixels
 * must make exactly that move.
 */

/**
 * The arrow's glow, as the screen draws it: lime #bef264 (gold #ffd166 when hinted), so bright that it comes
 * out a pale yellow, about (234, 241, 201). The ice and the snow are bluish (more blue than green), the otter
 * and the water dark.
 */
const arrowColour = (r: number, g: number, b: number) => g >= 200 && r >= 180 && g - b >= 25 && r - b >= 20;
/** The share of the arrow's own screen area that must show its colour. Measured at 852 by 393: 35 to 43 in every hundred with the arrows on top; on main 2 to 16 where the otter hid an up arrow. */
const MIN_SHOWN = 0.25;

for (const id of ['slippery-pond', 'frosty-maze']) {
  const level = LEVELS.find((l) => l.id === id)!;
  test(`level ${level.number}: every arrow of the shortest route shows, and a tap where it shows makes the move`, async ({ page, faults }) => {
    const size = page.viewportSize()!;
    const taps = new Taps(page, level, size);
    await page.addInitScript(READ_SCENE);
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
      // Wait until the arrow's pad is there and the arrow has popped in to full size.
      await expect.poll(async () => !!(await taps.targetNear(place, { within: 0.2 })), { timeout: 10_000 }).toBe(true);
      await page.waitForTimeout(700);

      // The arrow's screen box: its shape is 0.44 wide and 0.46 long, and it bobs 0.04 each way.
      const corners = await Promise.all(
        [
          [-0.28, -0.28],
          [0.28, -0.28],
          [-0.28, 0.28],
          [0.28, 0.28],
        ].map(([ox, oz]) => taps.screenOf([place[0] + ox, place[1], place[2] + oz])),
      );
      const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x))));
      const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y))));
      const x1 = Math.min(size.width, Math.ceil(Math.max(...corners.map((c) => c.x))));
      const y1 = Math.min(size.height, Math.ceil(Math.max(...corners.map((c) => c.y))));
      const pic = decodePng(await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } }));
      let shown = 0;
      let sx = 0;
      let sy = 0;
      for (let y = 0; y < pic.height; y++)
        for (let x = 0; x < pic.width; x++) {
          const k = (y * pic.width + x) * 4;
          if (arrowColour(pic.data[k], pic.data[k + 1], pic.data[k + 2])) {
            shown++;
            sx += x;
            sy += y;
          }
        }
      const share = shown / (pic.width * pic.height);
      const where = `move ${i + 1} (${move.dir}) from column ${state.x}, row ${state.y}`;
      console.log(`${level.id} ${size.width}x${size.height} ${where}: ${(share * 100).toFixed(1)}% of the arrow's box shows its glow`);
      expect(share, `the ${move.dir} arrow shows on the screen at ${where}`).toBeGreaterThanOrEqual(MIN_SHOWN);

      // A real touch on the middle of what shows.
      await taps.tapAt({ x: x0 + sx / shown, y: y0 + sy / shown }, `the ${move.dir} arrow`);
      await page.waitForFunction((n) => window.__riddle!.getState().moves.length >= n, i + 1, { timeout: 15_000, polling: 100 });
      const s = await page.evaluate(() => {
        const st = window.__riddle!.getState();
        return { count: st.moves.length, last: st.moves[st.moves.length - 1] };
      });
      expect(s, where).toEqual({ count: i + 1, last: move });
      await waitIdle(page);
    }
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 30_000 });
    expectClean(faults);
  });
}
