import { LEVELS } from '../../levels';
import { expect, expectClean, passRulesCard, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { READ_SCENE, Taps, waitCameraStill, waitIdle } from '../harness';
import { PLAYERS } from '../players';

/**
 * Hint's marks take no touch from what they mark. In these levels the mark is drawn over or round the
 * very thing to tap: a halo round a figure in a crowd (6, 7), a band round a name label or a plaque
 * (8, 9, 11), a ring drawn over a lantern's glow (14), and the plain ring on the ground (2).
 * Hint is pressed by a real touch, and with its mark up the hinted move is then made by touches on the
 * scene, the way the real-tap run makes every move. No move is made through the debug hook.
 */
const MARKED = ['wolf-goat-cabbage', 'explorers-guardians', 'jealous-couples', 'three-jugs', 'bridge-five', 'family-crossing', 'firefly-lanterns'];

for (const level of LEVELS.filter((l) => MARKED.includes(l.id))) {
  const nn = String(level.number).padStart(2, '0');
  test(`level ${nn} ${level.id}: with Hint's mark up, the hinted move is made by taps`, async ({ page, faults }) => {
    const player = PLAYERS[level.id];
    expect(player, `a real-tap player for ${level.id}`).toBeTruthy();
    const taps = new Taps(page, level, page.viewportSize()!);

    await page.addInitScript(READ_SCENE);
    await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    await passRulesCard(page, level.title);
    await page.waitForFunction(() => window.__taps.ready());
    await waitCameraStill(page);
    await waitIdle(page);
    await player.setup?.(taps);

    await page.getByRole('button', { name: 'Hint' }).filter({ visible: true }).tap();
    await expect(page.getByTestId('hint-spoken')).not.toBeEmpty();
    const hint = await page.evaluate(() => window.__riddle!.getState().hint);
    expect(hint, 'Hint named a move').toBeTruthy();
    // The mark comes up with the words. Let it be drawn before the first touch.
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));

    taps.step = 1;
    const before = await taps.snapshot();
    expect(before.moves.length).toBe(0);
    await player.move(taps, hint, before.state, 0);
    await page.waitForFunction(() => window.__riddle!.getState().moves.length >= 1, null, { timeout: 12_000 });
    const after = await page.evaluate(
      ([prev, want]) => {
        const s = window.__riddle!.getState();
        const r = s.level.rules;
        return { count: s.moves.length, played: s.moves[s.moves.length - 1], same: r.key(s.history[s.history.length - 1]) === r.key(r.apply(prev, want)) };
      },
      [before.state, hint] as const,
    );
    expect(after.count, `one move was made. Last touch: ${taps.lastTouch()}`).toBe(1);
    expect(after.same, `the hinted move ${JSON.stringify(hint)} was the one played, not ${JSON.stringify(after.played)}`).toBe(true);
    await waitIdle(page);
    expectClean(faults);
  });
}
