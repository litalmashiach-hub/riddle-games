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
 * Level 3 is here for its hinted button, which pulses: the real-tap harness taps it at its steady middle.
 *
 * Before the move, each mark is touched where nothing that listens lies under it, and every touch's ray
 * is put to the marks the game's own way (`marksAt`): a mark that answered it would take the touch.
 * Take the "takes no taps" rule (`raycast={noHit}`) off the marks and this fails.
 */
const MARKED = ['wolf-goat-cabbage', 'two-jugs', 'explorers-guardians', 'jealous-couples', 'three-jugs', 'bridge-five', 'family-crossing', 'firefly-lanterns'];

/**
 * Levels whose mark lies mostly over things that listen at the start: level 7's halos over a crowd of
 * birds, level 14's ring on a lily pad. The ring swells and the pads bob, so a free point on the mark
 * comes and goes: in these levels one is not demanded, and any found are kept well clear of what listens
 * and touched like the others. Then a ray is put through the mark the game's own way, with no touch,
 * where it lies over what listens: the mark must not answer it. That keeps the guard in these two levels.
 */
const COVERED = ['jealous-couples', 'firefly-lanterns'];

/**
 * Every touch on the screen, as the game's picking sees it: how many of Hint's marks its ray passes
 * through, and how many of those answer the ray. Read at the moment the finger goes down.
 */
const WATCH_MARKS = () => {
  const w = window as any;
  w.__markTouches = [];
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (w.__taps?.ready()) w.__markTouches.push({ x: e.clientX, y: e.clientY, ...w.__taps.marksAt(e.clientX, e.clientY) });
    },
    true,
  );
};

for (const level of LEVELS.filter((l) => MARKED.includes(l.id))) {
  const nn = String(level.number).padStart(2, '0');
  test(`level ${nn} ${level.id}: with Hint's mark up, the hinted move is made by taps`, async ({ page, faults }) => {
    const player = PLAYERS[level.id];
    expect(player, `a real-tap player for ${level.id}`).toBeTruthy();
    const taps = new Taps(page, level, page.viewportSize()!);

    await page.addInitScript(READ_SCENE);
    await page.addInitScript(WATCH_MARKS);
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

    // First a touch on each mark itself, where nothing that listens lies under it: no mark may take it,
    // and it must make no move. Then the hinted move, by touches on what the mark points at.
    // Where the marks lie mostly over things that listen (see COVERED), a free point is not demanded, and
    // any found must lie 8 pixels clear of what listens, so that a bobbing thing can't come under the finger.
    // The touches are real touches (touchscreen.tap), not clicks made by script in the page.
    const covered = COVERED.includes(level.id);
    const onMarks = await page.evaluate((clear) => window.__taps.markPoints(2, clear), covered ? 8 : 0);
    test.info().annotations.push({ type: 'touches on the mark', description: String(onMarks.length) });
    if (!covered) expect(onMarks.length, "a point of the screen where Hint's mark lies over nothing that listens").toBeGreaterThan(0);
    for (const at of onMarks) {
      const where = `(${Math.round(at.x)}, ${Math.round(at.y)})`;
      const seenBefore = await page.evaluate(() => (window as any).__markTouches.length);
      await page.touchscreen.tap(at.x, at.y);
      const markTouch = await page.evaluate((n) => (window as any).__markTouches[n], seenBefore);
      expect(markTouch?.crossed, `the touch at ${where} went through a mark`).toBeGreaterThan(0);
      expect(markTouch.taken, `a mark took the touch on itself at ${where}`).toBe(0);
    }
    if (covered) {
      // No free point to touch, most of the time. Put a ray through a point of each mark the game's way,
      // with no touch, wherever it lies: the mark must not answer it. This is what fails in these levels
      // when the "takes no taps" rule is taken off, since the touches of the move may not cross the mark.
      const anyOnMarks = await page.evaluate(() => window.__taps.markPoints(2, 0, false));
      expect(anyOnMarks.length, "a point well inside Hint's mark").toBeGreaterThan(0);
      for (const at of anyOnMarks) {
        const where = `(${Math.round(at.x)}, ${Math.round(at.y)})`;
        const ray = await page.evaluate(([x, y]) => window.__taps.marksAt(x, y), [at.x, at.y] as const);
        expect(ray.crossed, `the ray at ${where} went through a mark`).toBeGreaterThan(0);
        expect(ray.taken, `a mark answered the ray at ${where}`).toBe(0);
      }
    }
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__riddle!.getState().moves.length), 'a touch on the mark made no move').toBe(0);
    expect(await page.evaluate(() => window.__riddle!.getState().hint), 'the hint still stands').toEqual(hint);

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
    // Nor did the mark take any touch of the move. The game's picking asks only the objects that listen,
    // and their parts, so today a mark that answered a ray would change no move: this reads the mark's
    // own answer, which is what would take the touch on the day a mark is drawn inside something that listens.
    const touches: { x: number; y: number; taken: number }[] = await page.evaluate(() => (window as any).__markTouches);
    for (const t of touches) expect(t.taken, `a mark took the touch at (${Math.round(t.x)}, ${Math.round(t.y)})`).toBe(0);
    await waitIdle(page);
    expectClean(faults);
  });
}
