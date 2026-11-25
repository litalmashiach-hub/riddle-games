import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KNOWN_FAULTS } from '../../known-faults';
import { LEVELS } from '../../levels';
import { expect, expectClean, passRulesCard, savedStars, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { READ_SCENE, TapFault, Taps, waitCameraStill, waitIdle } from '../harness';
import { KNOWN_TAP_FAULTS } from '../known-tap-faults';
import { BROKEN_PLAYERS, PLAYERS } from '../players';

/**
 * Every level, won by touches on its 3D scene and on the scene's own buttons, the way a finger would.
 * The shortest solution comes from the game's solver. The debug hook is only read: no move is made
 * through it, and nothing is undone, redone or restarted through it.
 */
for (const level of LEVELS) {
  const nn = String(level.number).padStart(2, '0');
  test(`level ${nn} ${level.id}: won by taps alone`, async ({ page, faults }, testInfo) => {
    const player = PLAYERS[level.id];
    expect(player, `a real-tap player for ${level.id} (e2e/taps/players/index.ts)`).toBeTruthy();
    const known = (KNOWN_TAP_FAULTS[level.id] ?? []).find((k) => k.sizes.includes(testInfo.project.name));
    // The play-through tests list a page error that some levels throw as play starts. It is theirs to
    // watch: here it is only set apart, so that this run speaks of taps alone.
    const pageFault = KNOWN_FAULTS[level.id];
    if (pageFault?.when === 'start') faults.knownPattern = pageFault.pageError;

    const size = page.viewportSize()!;
    const taps = new Taps(page, level, size);
    const started = Date.now();
    const result = {
      level: level.number,
      id: level.id,
      size: `${size.width}x${size.height}`,
      moves: level.moves.length,
      won: false,
      movesMade: 0,
      touches: 0,
      seconds: 0,
      fault: null as null | { kind: string; step: number; detail: string; move: unknown },
    };
    const keep = async () => {
      result.touches = taps.log.length;
      result.seconds = Math.round((Date.now() - started) / 1000);
      const dir = join(testInfo.project.outputDir, 'results', testInfo.project.name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${nn}-${level.id}.json`), JSON.stringify({ ...result, log: taps.log }, null, 1));
      await testInfo.attach('touches', { body: JSON.stringify(taps.log, null, 1), contentType: 'application/json' });
    };

    await page.addInitScript(READ_SCENE);
    await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    await passRulesCard(page, level.title, () => {
      if (pageFault?.when === 'start') faults.knownOpen = true;
    });
    await page.waitForFunction(() => window.__taps.ready());
    await waitCameraStill(page);
    await waitIdle(page);

    let fault: TapFault | null = null;
    try {
      await player.setup?.(taps);
      for (const [i, move] of level.moves.entries()) {
        taps.step = i + 1;
        const before = await taps.snapshot();
        expect(before.moves.length, 'moves made before this step').toBe(i);
        await player.move(taps, move, before.state, i);
        // The session must now hold exactly one more move, and it must lead where the aimed one leads.
        try {
          await page.waitForFunction((n) => window.__riddle!.getState().moves.length >= n, i + 1, { timeout: 12_000 });
        } catch {
          throw new TapFault('no-move', i + 1, `no move followed the touches for ${JSON.stringify(move)}. Last touch: ${taps.lastTouch()}`);
        }
        const after = await page.evaluate(
          ([prev, want]) => {
            const s = window.__riddle!.getState();
            const r = s.level.rules;
            return { count: s.moves.length, played: s.moves[s.moves.length - 1], same: r.key(s.history[s.history.length - 1]) === r.key(r.apply(prev, want)) };
          },
          [before.state, move] as const,
        );
        if (after.count !== i + 1 || !after.same) {
          throw new TapFault('wrong-move', i + 1, `aimed at ${JSON.stringify(move)}, the game played ${JSON.stringify(after.played)}. Last touch: ${taps.lastTouch()}`);
        }
        result.movesMade = i + 1;
        if (i === 0 && pageFault?.when === 'start') faults.knownOpen = false;
        await waitIdle(page);
      }
      try {
        await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 60_000 });
      } catch {
        throw new TapFault('no-win', level.moves.length, 'every move was made by touch, and the win card did not show');
      }
    } catch (e) {
      if (!(e instanceof TapFault)) {
        await keep();
        throw e;
      }
      fault = e;
      result.fault = { kind: e.kind, step: e.step, detail: e.detail, move: level.moves[e.step - 1] };
    }

    if (!fault) {
      await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
      const end = await taps.snapshot();
      expect(end.kind).toBe('won');
      expect(end.moves.length, 'won in the shortest number of moves').toBe(level.moves.length);
      expect(end.hintsUsed, 'no hint was taken').toBe(0);
      expect((await savedStars(page))[level.id], 'stars saved on the device').toBe(3);
      result.won = true;
    }
    await keep();
    expectClean(faults);

    if (fault) {
      const shot = await page.screenshot();
      await testInfo.attach(`fault at step ${fault.step}`, { body: shot, contentType: 'image/png' });
      const dir = join(testInfo.project.outputDir, 'results', testInfo.project.name);
      writeFileSync(join(dir, `${nn}-${level.id}-fault.png`), shot);
    }
    if (known) {
      if (fault && (!known.steps.includes(fault.step) || fault.kind !== known.kind)) {
        throw new Error(`A tap fault is listed for this level at step ${known.steps.join(' or ')} (${known.kind}), and another one came: ${fault.message}`);
      }
      test.fail(true, known.reason);
    }
    if (fault) throw fault;
  });
}

test('every level has a real-tap player', () => {
  expect(BROKEN_PLAYERS, 'player files that could not be loaded').toEqual([]);
  expect(LEVELS.filter((l) => !PLAYERS[l.id]).map((l) => `${l.number} ${l.id}`)).toEqual([]);
});
