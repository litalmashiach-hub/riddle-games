import { LEVELS } from '../levels';
import { expect, playMove, test, waitForSession } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Touch areas. Apple asks that a control take touches over at least 44 by 44 points. Some of the game's
 * buttons are drawn smaller than that (the play screen's round ones are 46 by 42, its SD/HD switch 40.6
 * by 38), so each of those carries an unseen pad (`.touch-44` in index.css) that takes the touches.
 *
 * Here every button of the play screen's two bars, of its cards and its first-play guide, of the map's
 * corner and of the About screen's top is asked, point by point, what a finger would hit: the whole 44 by 44 square about the button's
 * middle has to belong to that button, and to no neighbour. And the pad has to stay small: no more than a
 * few points beyond the drawing, so that it takes no touch meant for the scene, and nothing of any button's
 * own drawing may go to a neighbour's pad.
 *
 * Runs at every size of the config (the file's name ends in layout.spec.ts, so the largest iPhone is
 * among them), and once more at an iPad's size.
 */

interface Touch {
  name: string;
  /** The drawn box. */
  width: number;
  height: number;
  /** How many of the sampled points of the 44 by 44 square reach the button, and who takes the others. */
  points: number;
  hits: number;
  takers: string[];
  /** How far beyond the drawn box a touch still reaches the button: the most over the four sides. */
  beyond: number;
  /** Who takes a touch just inside the middle of each side of the drawn box, where that is not the button itself. */
  edgesLost: string[];
}

/** Waits until nothing on the screen moves or fades any more: a card springs in, and a bar fades back. */
async function settled(page: Page) {
  const places = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#root button')]
        .map((b) => {
          const r = b.getBoundingClientRect();
          let opacity = 1;
          for (let p: Element | null = b; p; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity);
          return [r.left, r.top, r.width, r.height, opacity].map((n) => n.toFixed(2)).join(' ');
        })
        .join('|'),
    );
  let last = await places();
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(400);
        const now = await places();
        const still = now === last;
        last = now;
        return still;
      },
      { message: 'the screen comes to rest', timeout: 20_000 },
    )
    .toBe(true);
}

/** Every button now in view that can be touched, with what a finger would hit around it, once the screen is at rest. */
async function touchAreas(page: Page): Promise<Touch[]> {
  await settled(page);
  return page.evaluate(() => {
    const name = (b: Element) => (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ');
    const inView = (b: HTMLButtonElement) => {
      const r = b.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return false;
      for (let p: Element | null = b; p; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.visibility === 'hidden' || c.display === 'none' || Number(c.opacity) < 0.05) return false;
      }
      return !b.disabled && getComputedStyle(b).pointerEvents !== 'none';
    };
    const out: Touch[] = [];
    for (const b of document.querySelectorAll<HTMLButtonElement>('#root button')) {
      if (!inView(b)) continue;
      const r = b.getBoundingClientRect();
      const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
      const reaches = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('button') === b;
      // The square, a quarter point inside its edge, every half point.
      let points = 0;
      let hits = 0;
      const takers = new Set<string>();
      for (let y = cy - 21.75; y <= cy + 21.75; y += 0.5) {
        for (let x = cx - 21.75; x <= cx + 21.75; x += 0.5) {
          points++;
          if (reaches(x, y)) hits++;
          else {
            const e = document.elementFromPoint(x, y);
            const other = e?.closest('button');
            takers.add(!e ? 'nothing (off the screen)' : other ? `button "${name(other)}"` : `<${e.tagName.toLowerCase()}>`);
          }
        }
      }
      // Outwards from each side, along the two lines through the middle.
      let beyond = 0;
      for (const [dx, dy, edge] of [[-1, 0, r.left], [1, 0, r.right], [0, -1, r.top], [0, 1, r.bottom]] as const) {
        for (let d = 0.25; d <= 20; d += 0.25) {
          const [x, y] = [dx ? edge + dx * d : cx, dy ? edge + dy * d : cy];
          if (!reaches(x, y)) break;
          beyond = Math.max(beyond, d);
        }
      }
      // Just inside the middle of each side of the drawing: a neighbour's pad must not have taken it.
      const edgesLost: string[] = [];
      for (const [x, y] of [[r.left + 1, cy], [r.right - 1, cy], [cx, r.top + 1], [cx, r.bottom - 1]]) {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight || reaches(x, y)) continue;
        const other = document.elementFromPoint(x, y)?.closest('button');
        edgesLost.push(other ? `button "${name(other)}"` : 'something that is no button');
      }
      out.push({ name: name(b), width: r.width, height: r.height, points, hits, takers: [...takers], beyond, edgesLost });
    }
    return out;
  });
}

/** The pad may reach this far beyond a button's drawing, and no further: (44 - 38) / 2 is the most it needs today. */
const MOST_BEYOND = 4;

/** Each named button takes touches over the whole 44 by 44 square about its middle, and its pad stays small. */
function expectTouchable(all: Touch[], names: (string | RegExp)[], where: string) {
  const faults: string[] = [];
  for (const want of names) {
    const found = all.filter((t) => (typeof want === 'string' ? t.name === want : want.test(t.name)));
    if (!found.length) faults.push(`no button ${want} in view to measure (found: ${all.map((t) => t.name).join(', ')})`);
    for (const t of found) {
      const drawn = `drawn ${t.width.toFixed(1)} by ${t.height.toFixed(1)}`;
      if (t.hits < t.points) faults.push(`"${t.name}" (${drawn}): ${t.points - t.hits} of ${t.points} points of its 44 by 44 square go to ${t.takers.join(', ')}`);
      if (t.beyond > MOST_BEYOND) faults.push(`"${t.name}" (${drawn}) takes touches ${t.beyond} points beyond its drawing`);
    }
  }
  // And every button in view, named above or not, keeps its own drawing.
  for (const t of all) if (t.edgesLost.length) faults.push(`"${t.name}": a touch on the edge of its drawing goes to ${t.edgesLost.join(', ')}`);
  expect(faults, where).toEqual([]);
}

/** The play screen's bars: the top one, and the tray and the Hint button at the bottom. */
const BARS = ['Back to levels', /^(SD|HD) graphics$/, 'Sound', 'Rules', 'Undo', 'Redo', 'Restart', 'Hint'];

async function playScreenButtons(page: Page) {
  const level = LEVELS[0];
  await page.goto(`?all&debug&quality=low#/level/${level.id}`);
  await waitForSession(page, level.id);
  await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 60_000 });
  const go = page.getByRole('button', { name: "Let's go!" });
  await page.waitForTimeout(800);
  expectTouchable(await touchAreas(page), ["Let's go!"], 'the rules card');
  await go.tap();
  await expect(go).toBeHidden();
  // A first play: the guide's Skip button is up, over the scene.
  await expect(page.getByRole('button', { name: 'Skip the guide' })).toBeVisible();
  await page.waitForTimeout(600);
  expectTouchable(await touchAreas(page), ['Skip the guide'], 'the first-play guide');

  // Two moves and one Undo: now Undo, Redo and Restart are all live.
  await playMove(page, level.moves[0], 1);
  await playMove(page, level.moves[1], 2);
  await page.getByRole('button', { name: 'Undo' }).tap();
  await page.waitForFunction(() => {
    const s = window.__riddle!.getState();
    return s.moves.length === 1 && !s.busy;
  });
  await page.waitForTimeout(600);
  const all = await touchAreas(page);
  expectTouchable(all, BARS, 'the play screen, mid-level');
  // The short layout (a phone held sideways) shows a second Hint button and hides the first: one is in view.
  expect(all.filter((t) => t.name === 'Hint'), 'Hint buttons in view').toHaveLength(1);

  // The "Oh no!" card: back to the start by a tap on Restart, then a losing first move, by the level's own rules.
  await page.getByRole('button', { name: 'Restart' }).tap();
  await page.waitForFunction(() => {
    const s = window.__riddle!.getState();
    return s.moves.length === 0 && !s.busy;
  });
  await page.evaluate(() => {
    const s = window.__riddle!.getState();
    const { rules } = s.level;
    const now = s.history[s.history.length - 1];
    const losing = rules.legalMoves(now).find((m: unknown) => rules.status(rules.apply(now, m)).kind === 'lost');
    if (losing === undefined) throw new Error('level 1 has no losing first move');
    s.play(losing);
  });
  await expect(page.getByRole('heading', { name: 'Oh no!' })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(800);
  expectTouchable(await touchAreas(page), ['Undo', 'Restart'], 'the "Oh no!" card');
}

test('play screen: every button of the bars and the cards takes touches over 44 by 44 points', async ({ page }) => {
  await playScreenButtons(page);
});

test('map and About: the corner buttons and the About screen take touches over 44 by 44 points', async ({ page }) => {
  await page.goto('?all#/');
  await expect(page.getByRole('button', { name: 'About and settings' }).first()).toBeVisible();
  await page.waitForTimeout(600);
  expectTouchable(await touchAreas(page), ['About and settings', 'Sound'], 'the map');
  await page.goto('?all#/about');
  const back = page.getByRole('button', { name: 'Back to levels' });
  await expect(back).toBeVisible();
  await page.waitForTimeout(600);
  expectTouchable(await touchAreas(page), ['Back to levels'], 'the About screen');
});

test.describe('on an iPad held sideways (1024 by 768)', () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test('play screen: every button of the bars and the cards takes touches over 44 by 44 points', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone-landscape', 'the size is set here, so one project is enough');
    await playScreenButtons(page);
  });
});
