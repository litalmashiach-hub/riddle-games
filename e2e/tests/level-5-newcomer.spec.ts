import type { Page } from '@playwright/test';
import { LEVELS } from '../levels';
import { setSystemBodySize, SYSTEM_BODY, textFaults } from '../textFit';
import { EXPLORERS, MINUTES, NAMES, type Explorer, type Move } from '../../levels/05-bridge-and-torch/src/rules';
import { expect, expectClean, playMove, seedProgress, test, waitForSession } from './fixtures';

/**
 * Level 5 (Bridge and Torch) as a newcomer meets it (reports of the newcomer play-test):
 *  - a tap on an explorer's name label picks that explorer, on both banks, as a tap on the body does. From the
 *    phone's camera Bram stands behind Juno and the tent, so the label is what a player can aim at;
 *  - the refusal note and the hint cover no label;
 *  - the rules card points at the torch, not the crossings, and the loss card says how long the walk took,
 *    and both fit, at the standard text size and at the largest, at each iPhone size.
 * Every tap here is a touch on the screen, not a click made by script.
 */

const level = LEVELS.find((l) => l.id === 'bridge-and-torch')!;
const spoken = (e: Explorer) => `${NAMES[e]}, ${MINUTES[e]} ${MINUTES[e] === 1 ? 'minute' : 'minutes'}`;
const label = (page: Page, e: Explorer) => page.getByRole('button', { name: spoken(e), exact: true });

async function open(page: Page) {
  await seedProgress(page, Object.fromEntries(LEVELS.slice(0, 4).map((l) => [l.id, 3])));
  await page.goto(`?debug&quality=low#/level/${level.id}`);
  await waitForSession(page, level.id);
  await page.getByRole('button', { name: "Let's go!" }).tap();
  await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 120_000 });
  for (const e of EXPLORERS) await expect(label(page, e)).toBeVisible();
}

/** Each drawn label (the pill inside the button) on the screen now, once none has moved for a moment. */
async function settledPills(page: Page): Promise<Record<Explorer, { x: number; y: number; width: number; height: number }>> {
  let last = '';
  for (let i = 0; i < 60; i++) {
    const now = await page.evaluate((names) => {
      const out: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const [e, name] of Object.entries(names)) {
        const pill = document.querySelector(`button[aria-label="${name}"] > div`);
        if (!pill) continue;
        const r = pill.getBoundingClientRect();
        out[e] = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      }
      return out;
    }, Object.fromEntries(EXPLORERS.map((e) => [e, spoken(e)])));
    const key = JSON.stringify(now);
    if (key === last && Object.keys(now).length === EXPLORERS.length) return now as Record<Explorer, { x: number; y: number; width: number; height: number }>;
    last = key;
    await page.waitForTimeout(250);
  }
  throw new Error('the name labels did not come to rest');
}

const picked = (page: Page) =>
  Promise.all(EXPLORERS.map(async (e) => ((await label(page, e).getAttribute('aria-pressed')) === 'true' ? e : null))).then((l) => l.filter(Boolean));

/** Taps the middle of `e`'s drawn label, then expects `want` picked, exactly. */
async function tapLabel(page: Page, e: Explorer, want: Explorer[], where: string) {
  const pill = (await settledPills(page))[e];
  await page.touchscreen.tap(pill.x + pill.width / 2, pill.y + pill.height / 2);
  await expect.poll(() => picked(page), { message: `${where}: a tap on ${NAMES[e]}'s label leaves [${want.join(', ')}] picked` }).toEqual(want);
  // Past the scene's guard against a double tap (450 ms), so the next tap on the same label counts.
  await page.waitForTimeout(500);
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('level 5: the name labels', () => {
  test('a tap on each label picks that explorer on the start bank, and a second tap puts them back', async ({ page, faults }) => {
    await open(page);
    for (const e of EXPLORERS) {
      await tapLabel(page, e, [e], 'start bank');
      await tapLabel(page, e, [], 'start bank');
    }
    // Two at once, and the bridge's limit still holds: a third label tap is refused.
    await tapLabel(page, 'bram', ['bram'], 'start bank');
    await tapLabel(page, 'juno', ['juno', 'bram'], 'start bank');
    await tapLabel(page, 'mo', ['juno', 'bram'], 'start bank');
    await expect(page.getByText('Only two fit on the bridge')).toBeVisible();
    // The labels picked Bram and Juno; the Cross button sends them.
    await page.getByRole('button', { name: /^Cross, 5 minutes/ }).tap();
    await page.waitForFunction(() => window.__riddle!.getState().moves.length === 1 && !window.__riddle!.getState().busy, null, { timeout: 30_000 });
    expectClean(faults);
  });

  test('a tap on each label picks that explorer on the far bank', async ({ page, faults }) => {
    await open(page);
    // Pip and Juno over: both wait on the far bank with the torch.
    await playMove(page, { walkers: ['pip', 'juno'] } satisfies Move, 1);
    for (const e of ['pip', 'juno'] as const) {
      await tapLabel(page, e, [e], 'far bank');
      await tapLabel(page, e, [], 'far bank');
    }
    // Pip back, then Bram and Grandpa Mo over: Juno now stands in front of Bram, as the newcomer saw it.
    await playMove(page, { walkers: ['pip'] } satisfies Move, 2);
    await playMove(page, { walkers: ['bram', 'mo'] } satisfies Move, 3);
    for (const e of ['juno', 'bram', 'mo'] as const) {
      await tapLabel(page, e, [e], 'far bank');
      await tapLabel(page, e, [], 'far bank');
    }
    expectClean(faults);
  });

  test('the refusal note and the hint cover no label', async ({ page, faults }) => {
    await open(page);
    await playMove(page, { walkers: ['pip', 'juno'] } satisfies Move, 1);
    // Bram's label, on the bank without the torch: refused, with a note above him.
    const before = await settledPills(page);
    // On a busy machine the note (up for 1.4 s) can come and go between two of the test's reads, so the page
    // measures it itself, on each frame from before the tap.
    await page.evaluate(() => {
      const w = window as unknown as { __noteBox?: { x: number; y: number; width: number; height: number } };
      const look = () => {
        const el = document.querySelector('[data-refusal="The torch is on the other side"]');
        if (el && getComputedStyle(el).visibility !== 'hidden') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            w.__noteBox = { x: r.x, y: r.y, width: r.width, height: r.height };
            return;
          }
        }
        requestAnimationFrame(look);
      };
      look();
    });
    const pill = before.bram;
    await page.touchscreen.tap(pill.x + pill.width / 2, pill.y + pill.height / 2);
    const box = (await (await page.waitForFunction(() => (window as unknown as { __noteBox?: unknown }).__noteBox, null, { timeout: 15_000 })).jsonValue()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    expect(await picked(page)).toEqual([]);
    for (const e of EXPLORERS) expect(overlaps(box, before[e]), `the refusal note covers ${NAMES[e]}'s label`).toBe(false);

    // The hint toast too can come and go between two reads on a busy machine: the page measures it, as above.
    const now = await settledPills(page);
    await page.evaluate(() => {
      const w = window as unknown as { __hintBox?: { x: number; y: number; width: number; height: number } };
      const look = () => {
        const el = document.querySelector('[data-testid="hint-toast"]');
        if (el && getComputedStyle(el).visibility !== 'hidden') {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            w.__hintBox = { x: r.x, y: r.y, width: r.width, height: r.height };
            return;
          }
        }
        requestAnimationFrame(look);
      };
      look();
    });
    await page.keyboard.press('h');
    const hb = (await (await page.waitForFunction(() => (window as unknown as { __hintBox?: unknown }).__hintBox, null, { timeout: 15_000 })).jsonValue()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    for (const e of EXPLORERS) expect(overlaps(hb, now[e]), `the hint covers ${NAMES[e]}'s label`).toBe(false);
    expectClean(faults);
  });
});

for (const size of [
  { name: 'the standard text size', body: SYSTEM_BODY.standard },
  { name: 'the largest text size', body: SYSTEM_BODY.ax5 },
]) {
  test(`level 5 at ${size.name}: the rules card points at the torch, the loss card gives the time, and both fit`, async ({ page, faults }) => {
    await setSystemBodySize(page, size.body);
    await seedProgress(page, Object.fromEntries(LEVELS.slice(0, 4).map((l) => [l.id, 3])));
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    const rules = page.getByRole('dialog', { name: `Rules: level ${level.number}, ${level.title}` });
    await expect(rules).toBeVisible();
    await expect(rules.getByText('Who carries the torch back matters most.')).toBeVisible();
    await expect(rules.getByText('Get everyone over before the torch burns out for three stars.')).toBeAttached();
    await expect(rules.getByText(/Solve it in/)).toHaveCount(0);
    await page.waitForTimeout(600);
    expect(await textFaults(page), 'rules card').toEqual([]);
    await expect(page.getByRole('button', { name: "Let's go!" })).toBeInViewport({ ratio: 1 });

    await waitForSession(page, level.id);
    await page.getByRole('button', { name: "Let's go!" }).tap();
    await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 120_000 });
    // The newcomer's plan: Pip walks everyone over. It takes 19 minutes.
    const plan: Move[] = [{ walkers: ['pip', 'mo'] }, { walkers: ['pip'] }, { walkers: ['pip', 'bram'] }, { walkers: ['pip'] }, { walkers: ['pip', 'juno'] }];
    for (const [i, m] of plan.entries()) await playMove(page, m, i + 1);
    const lost = page.getByRole('dialog', { name: 'Oh no!' });
    await expect(lost).toBeVisible({ timeout: 30_000 });
    await expect(lost.getByText('That took 19 minutes, but the torch only lasts 17. Try sending the two slowest together.')).toBeVisible();
    await page.waitForTimeout(600);
    // The explorers' speech bubbles in the dark are the scene's, not the card's (at 667 by 375 Bram's can reach past
    // the right edge, behind the card, as it did before this change): only the card's words are judged here.
    const bubbles = ['Eek!', 'Who blew it out?!', 'My glasses! Oh wait…', 'Is it bedtime?', 'Pfft… uh-oh!'];
    expect((await textFaults(page)).filter((f) => !bubbles.includes(f.text)), 'loss card').toEqual([]);
    for (const name of ['Undo', 'Restart']) await expect(lost.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
    expectClean(faults);
  });
}
