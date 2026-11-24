import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { BROKEN_LEVELS, LEVELS } from '../levels';
import { KNOWN_FAULTS } from '../known-faults';
import { expect, expectClean, expectCounter, mapButton, passRulesCard, playMove, savedStars, seedProgress, test, waitForSession } from './fixtures';

/** A level folder that the tests cannot load fails here by name, and the other levels are still played. */
for (const { dir, error } of BROKEN_LEVELS) {
  test(`level folder ${dir}: can be loaded by the tests`, () => {
    throw new Error(error);
  });
}

/**
 * Each level, played to a win with the shortest solution from the game's own solver.
 * The moves go in through the `?debug` hook; the cards and buttons around them are tapped for real.
 */
for (const level of LEVELS) {
  const nn = String(level.number).padStart(2, '0');
  test(`level ${nn} ${level.id}: plays to a three-star win`, async ({ page, faults }, testInfo) => {
    const known = KNOWN_FAULTS[level.id];
    if (known) faults.knownPattern = known.pageError;

    // A player reaches this level with every earlier one solved.
    const earlier = LEVELS.filter((l) => l.number < level.number);
    const next = LEVELS.find((l) => l.number === level.number + 1);
    await seedProgress(page, Object.fromEntries(earlier.map((l) => [l.id, 3])));

    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    const info = await page.evaluate(() => {
      const l = window.__riddle!.getState().level;
      return { number: l.number, title: l.title, bestMoves: l.bestMoves as number, moveNoun: l.moveNoun as string };
    });
    expect(info.number).toBe(level.number);
    expect(level.moves.length, 'the solver agrees with the level about its shortest solution').toBe(info.bestMoves);

    await passRulesCard(page, info.title, () => {
      if (known?.when === 'start') faults.knownOpen = true;
    });

    // The top bar while playing: no move yet, and the level's best. After the first move it counts one.
    await expectCounter(page, 0, info.bestMoves);
    for (const [i, move] of level.moves.entries()) {
      await playMove(page, move, i + 1);
      if (i === 0) {
        if (known?.when === 'start') faults.knownOpen = false;
        if (level.moves.length > 1) await expectCounter(page, 1, info.bestMoves);
      }
    }

    // The win card.
    const solved = page.getByRole('heading', { name: 'Solved!' });
    await expect(solved).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
    // The card counts the moves in the level's own words, and calls the shortest solution what it is.
    await expect(page.getByText(`${info.bestMoves} ${info.moveNoun}. Perfect, that is the shortest solution!`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next level' })).toHaveCount(next ? 1 : 0);
    expect(await page.evaluate(() => window.__riddle!.getState().status.kind)).toBe('won');
    expect((await savedStars(page))[level.id], 'stars saved on the device').toBe(3);

    // Let the stars finish popping in, then keep a picture of the win.
    await page.waitForTimeout(1500);
    const shots = join(testInfo.project.outputDir, 'wins', testInfo.project.name);
    mkdirSync(shots, { recursive: true });
    const shot = await page.screenshot({ path: join(shots, `${nn}-${level.id}.png`) });
    await testInfo.attach(`win ${nn} ${level.id}`, { body: shot, contentType: 'image/png' });

    // Back on the map, the stars count and the next level is open.
    if (known?.when === 'leave') faults.knownOpen = true;
    await page.getByRole('button', { name: 'All levels' }).tap();
    await expect(page.getByText(`${level.number * 3} / ${LEVELS.length * 3}`)).toBeVisible();
    if (next) {
      await mapButton(page, next.number, next.title).tap();
      await expect(page.getByRole('heading', { name: next.title, exact: true })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`#/level/${next.id}$`));
    }

    expectClean(faults);
    if (known) {
      // Everything above held. From here on, the one thing that may fail is the known fault itself.
      await page.waitForTimeout(1000);
      expectClean(faults);
      test.fail(true, known.reason);
      expect(faults.known, known.reason).toEqual([]);
    }
  });
}
