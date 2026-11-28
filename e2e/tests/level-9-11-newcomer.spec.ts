import type { Page } from '@playwright/test';
import { LEVELS } from '../levels';
import { setSystemBodySize, SYSTEM_BODY, textFaults } from '../textFit';
import { MINUTES, NAMES, TRAVELLERS, type Move as Move9, type Traveller } from '../../levels/09-bridge-five/src/rules';
import { PEOPLE, rules as rules11, type Move as Move11, type Person, type State as State11 } from '../../levels/11-family-crossing/src/rules';
import { expect, expectClean, playMove, seedProgress, test, waitForSession } from './fixtures';

/**
 * Levels 9 (Bridge of Five) and 11 (Family Crossing) as a newcomer meets them (report of the newcomer play-test of
 * levels 6 to 15), with level 5's fixes brought over:
 *  - a tap on a name label picks that label's own traveller, on both banks, as a tap on the body does. Before, the
 *    labels let taps through to the scene, which gave them to whoever stood under the label, or to nobody;
 *  - level 9's rules card points at the lantern, not the crossings, and its loss card says how long the walk took,
 *    and both fit, at the standard text size and at the largest, at each iPhone size.
 * Every tap here is a touch on the screen, not a click made by script.
 */

type Box = { x: number; y: number; width: number; height: number };

const level9 = LEVELS.find((l) => l.id === 'bridge-five')!;
const level11 = LEVELS.find((l) => l.id === 'family-crossing')!;

const spoken9 = (t: Traveller) => `${NAMES[t]}, ${MINUTES[t]} ${MINUTES[t] === 1 ? 'minute' : 'minutes'}`;
const SPOKEN11: Record<Person, string> = {
  father: 'Dad',
  mother: 'Mom',
  sonA: 'First son',
  sonB: 'Second son',
  daughterA: 'First daughter',
  daughterB: 'Second daughter',
  guard: 'Guard',
  thief: 'Thief',
};

/** One level's name labels, as the test reads them. */
interface Labels<K extends string> {
  ids: readonly K[];
  name(id: K): string;
}
const LABELS9: Labels<Traveller> = { ids: TRAVELLERS, name: spoken9 };
const LABELS11: Labels<Person> = { ids: PEOPLE, name: (p) => SPOKEN11[p] };

const labelButton = <K extends string>(page: Page, l: Labels<K>, id: K) => page.getByRole('button', { name: l.name(id), exact: true });

async function open<K extends string>(page: Page, id: string, number: number, l: Labels<K>) {
  await seedProgress(page, Object.fromEntries(LEVELS.slice(0, number - 1).map((x) => [x.id, 3])));
  await page.goto(`?debug&quality=low#/level/${id}`);
  await waitForSession(page, id);
  await page.getByRole('button', { name: "Let's go!" }).tap();
  await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 120_000 });
  for (const k of l.ids) await expect(labelButton(page, l, k)).toBeVisible();
}

/** Each drawn label of `ids` on the screen now, once none has moved for a moment. */
async function settledPills<K extends string>(page: Page, l: Labels<K>, ids: readonly K[]): Promise<Record<K, Box>> {
  let last = '';
  for (let i = 0; i < 60; i++) {
    const now = await page.evaluate((names) => {
      const out: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const [k, name] of Object.entries(names)) {
        const pill = document.querySelector(`button[aria-label="${name}"] > span:not([aria-hidden])`);
        if (!pill) continue;
        const r = pill.getBoundingClientRect();
        if (r.width === 0) continue;
        out[k] = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      }
      return out;
    }, Object.fromEntries(ids.map((k) => [k, l.name(k)])));
    const key = JSON.stringify(now);
    if (key === last && Object.keys(now).length === ids.length) return now as Record<K, Box>;
    last = key;
    await page.waitForTimeout(250);
  }
  throw new Error('the name labels did not come to rest');
}

const pickedNow = <K extends string>(page: Page, l: Labels<K>) =>
  Promise.all(l.ids.map(async (k) => ((await labelButton(page, l, k).getAttribute('aria-pressed')) === 'true' ? k : null))).then((x) =>
    (x.filter(Boolean) as K[]).sort(),
  );

/** Taps the middle of `id`'s drawn label, then expects `want` picked, exactly. */
async function tapLabel<K extends string>(page: Page, l: Labels<K>, id: K, want: K[], where: string) {
  // Every label at rest, not only this one: one still sliding (behind someone who walks back) could cross it.
  const pill = (await settledPills(page, l, l.ids))[id];
  await page.touchscreen.tap(pill.x + pill.width / 2, pill.y + pill.height / 2);
  await expect
    .poll(() => pickedNow(page, l), { message: `${where}: a tap on ${l.name(id)}'s label leaves [${want.join(', ')}] picked` })
    .toEqual([...want].sort());
  // Past level 9's guard against a double tap (450 ms), so the next tap on the same label counts.
  await page.waitForTimeout(500);
}

/** Taps each label of `ids` twice: the first tap picks that one alone, the second puts them back. */
async function eachLabel<K extends string>(page: Page, l: Labels<K>, ids: readonly K[], where: string) {
  for (const k of ids) {
    await tapLabel(page, l, k, [k], where);
    await tapLabel(page, l, k, [], where);
  }
}

test.describe('level 9: the time labels', () => {
  test('a tap on each label picks that traveller on the start bank, and a second tap puts them back', async ({ page, faults }) => {
    await open(page, level9.id, level9.number, LABELS9);
    await eachLabel(page, LABELS9, TRAVELLERS, 'start bank');
    // The newcomer's taps: "1 min" picked the 12-minute walker, "3 min" the 8-minute one.
    await tapLabel(page, LABELS9, 'zip', ['zip'], 'start bank');
    await tapLabel(page, LABELS9, 'mira', ['zip', 'mira'], 'start bank');
    // Two at once, and the bridge's limit still holds: a third label tap is refused.
    await tapLabel(page, LABELS9, 'tuk', ['zip', 'mira'], 'start bank');
    await expect(page.getByText('Only 2 fit on the bridge!')).toBeVisible();
    await page.getByRole('button', { name: /^Cross, 3 minutes/ }).tap();
    await page.waitForFunction(() => window.__riddle!.getState().moves.length === 1 && !window.__riddle!.getState().busy, null, { timeout: 30_000 });
    expectClean(faults);
  });

  test('a tap on each label picks that traveller on the far bank', async ({ page, faults }) => {
    await open(page, level9.id, level9.number, LABELS9);
    await playMove(page, { walkers: ['zip', 'mira'] } satisfies Move9, 1);
    await eachLabel(page, LABELS9, ['zip', 'mira'], 'far bank');
    await playMove(page, { walkers: ['zip'] } satisfies Move9, 2);
    await playMove(page, { walkers: ['elm', 'tuk'] } satisfies Move9, 3);
    await eachLabel(page, LABELS9, ['mira', 'elm', 'tuk'], 'far bank');
    expectClean(faults);
  });

  test('the Cross button says when a pair would take longer than the lantern has left', async ({ page, faults }) => {
    await open(page, level9.id, level9.number, LABELS9);
    // Zip walks each one over: 20 minutes gone, and Tuk (12 minutes) still waits.
    const plan: Move9[] = [{ walkers: ['zip', 'mira'] }, { walkers: ['zip'] }, { walkers: ['zip', 'bo'] }, { walkers: ['zip'] }, { walkers: ['zip', 'elm'] }, { walkers: ['zip'] }];
    for (const [i, m] of plan.entries()) await playMove(page, m, i + 1);
    await tapLabel(page, LABELS9, 'tuk', ['tuk'], 'start bank, 20 minutes gone');
    await tapLabel(page, LABELS9, 'zip', ['zip', 'tuk'], 'start bank, 20 minutes gone');
    const cross = page.getByRole('button', { name: 'Cross, 12 minutes, more than the lantern has left' });
    await expect(cross).toBeVisible();
    await expect(cross).toContainText('too long');
    await expect(cross).toBeInViewport({ ratio: 1 });
    expectClean(faults);
  });
});

/** The first moves of the shortest win that leave the raft on the far bank with the most people there. */
function crowdedFarBank(): { moves: Move11[]; there: Person[] } {
  const moves = level11.moves as Move11[];
  let s: State11 = rules11.initialState;
  let best = { moves: [] as Move11[], there: [] as Person[] };
  moves.forEach((m, i) => {
    s = rules11.apply(s, m);
    const there = PEOPLE.filter((p) => s[p] === 'R');
    if (i < moves.length - 1 && s.raft === 'R' && there.length > best.there.length) best = { moves: moves.slice(0, i + 1), there };
  });
  return best;
}

test.describe('level 11: the name labels', () => {
  test('a tap on each label picks that person on the start bank, and a second tap puts them back', async ({ page, faults }) => {
    await open(page, level11.id, level11.number, LABELS11);
    await eachLabel(page, LABELS11, PEOPLE, 'start bank');
    // The raft holds two: a third label tap is refused.
    await tapLabel(page, LABELS11, 'guard', ['guard'], 'start bank');
    await tapLabel(page, LABELS11, 'thief', ['guard', 'thief'], 'start bank');
    await tapLabel(page, LABELS11, 'father', ['guard', 'thief'], 'start bank');
    await expect(page.getByText('The raft only holds two.')).toBeVisible();
    await page.getByRole('button', { name: /^Cast off, / }).tap();
    await page.waitForFunction(() => window.__riddle!.getState().moves.length === 1 && !window.__riddle!.getState().busy, null, { timeout: 30_000 });
    expectClean(faults);
  });

  test('a tap on each label picks that person on the crowded far bank', async ({ page, faults }) => {
    const { moves, there } = crowdedFarBank();
    expect(there.length, 'people on the far bank with the raft').toBeGreaterThanOrEqual(4);
    await open(page, level11.id, level11.number, LABELS11);
    for (const [i, m] of moves.entries()) await playMove(page, m, i + 1);
    await eachLabel(page, LABELS11, there, 'far bank');
    expectClean(faults);
  });
});

for (const size of [
  { name: 'the standard text size', body: SYSTEM_BODY.standard },
  { name: 'the largest text size', body: SYSTEM_BODY.ax5 },
]) {
  test(`level 9 at ${size.name}: the rules card points at the lantern, the loss card gives the time, and both fit`, async ({ page, faults }) => {
    await setSystemBodySize(page, size.body);
    await seedProgress(page, Object.fromEntries(LEVELS.slice(0, 8).map((l) => [l.id, 3])));
    await page.goto(`?debug&quality=low#/level/${level9.id}`);
    const rules = page.getByRole('dialog', { name: `Rules: level ${level9.number}, ${level9.title}` });
    await expect(rules).toBeVisible();
    await expect(rules.getByText('Get everyone over before the lantern burns out for three stars.')).toBeAttached();
    await expect(rules.getByText(/Solve it in/)).toHaveCount(0);
    await page.waitForTimeout(600);
    expect(await textFaults(page), 'rules card').toEqual([]);
    await expect(page.getByRole('button', { name: "Let's go!" })).toBeInViewport({ ratio: 1 });

    await waitForSession(page, level9.id);
    await page.getByRole('button', { name: "Let's go!" }).tap();
    await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 120_000 });
    // The newcomer's plan: Zip walks everyone over. It takes 32 minutes.
    const plan: Move9[] = [
      { walkers: ['zip', 'mira'] },
      { walkers: ['zip'] },
      { walkers: ['zip', 'bo'] },
      { walkers: ['zip'] },
      { walkers: ['zip', 'elm'] },
      { walkers: ['zip'] },
      { walkers: ['zip', 'tuk'] },
    ];
    for (const [i, m] of plan.entries()) await playMove(page, m, i + 1);
    const lost = page.getByRole('dialog', { name: 'Oh no!' });
    await expect(lost).toBeVisible({ timeout: 30_000 });
    await expect(lost.getByText('That took 32 minutes, but the lantern only lasts 30. Try sending the two slowest together.')).toBeVisible();
    await page.waitForTimeout(600);
    // The walkers' shouts in the dark are the scene's, not the card's: only the card's words are judged here.
    const bubbles = ['Nope! *hides*', 'Where are my glasses?!', 'Oh my stars!', 'Eek! Lights out!', 'Hold my hand!'];
    expect((await textFaults(page)).filter((f) => !bubbles.includes(f.text)), 'loss card').toEqual([]);
    for (const name of ['Undo', 'Restart']) await expect(lost.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
    expectClean(faults);
  });
}
