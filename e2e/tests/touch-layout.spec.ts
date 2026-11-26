import { LEVELS } from '../levels';
import { expect, playMove, seedProgress, test, waitForSession } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Touch areas. Apple asks that a control take touches over at least 44 by 44 points. Some of the game's
 * buttons are drawn smaller than that (the play screen's round ones are 46 by 42, its SD/HD switch 40.6
 * by 38), so each of those carries an unseen pad (`.touch-44` in index.css) that takes the touches.
 *
 * Here every button of the play screen's two bars, of its cards and its first-play guide, of the map's
 * corner, of the About screen (its top, its tabs and Reset progress) and of the scenes of the levels that
 * put buttons of their own on the page is asked, point by point, what a finger would hit: the whole 44 by
 * 44 square about the button's middle has to belong to that button, and to no neighbour. And the pad has to
 * stay small: no more than a few points beyond the drawing, so that it takes no touch meant for the scene,
 * and nothing of any button's own drawing may go to a neighbour's pad.
 *
 * A screen is measured only once the buttons that the check names are in view and at rest: the map and the
 * About screen fade in, a card springs in, and a bar fades back.
 *
 * Runs at every size of the config (the file's name ends in layout.spec.ts, so the largest iPhone is
 * among them; the app build runs the About screen's check, for its four tabs), and once more at an iPad's
 * two sizes and at an upright phone's.
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

type Want = string | RegExp;
const isNamed = (t: Touch, want: Want) => (typeof want === 'string' ? t.name === want : want.test(t.name));

/**
 * Every button in view that can be touched, with what a finger would hit around it. It waits, up to 20
 * seconds, until every button of `names` is in view and the screen is at rest, and measures then. If one
 * of them never comes, it returns what there is, and `expectTouchable` says which one is missing.
 */
async function touchAreas(page: Page, names: Want[]): Promise<Touch[]> {
  const end = Date.now() + 20_000;
  for (;;) {
    await settled(page);
    const all = await measure(page);
    // At rest still, after the measuring? A screen that began to move meanwhile is measured again.
    if (names.every((want) => all.some((t) => isNamed(t, want))) || Date.now() > end) return all;
    await page.waitForTimeout(200);
  }
}

/** The screen as it is at this moment. */
function measure(page: Page): Promise<Touch[]> {
  return page.evaluate(() => {
    const name = (b: Element) => (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ');
    const inView = (b: HTMLButtonElement) => {
      const r = b.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return false;
      for (let p: Element | null = b; p; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.visibility === 'hidden' || c.display === 'none' || Number(c.opacity) < 0.05) return false;
      }
      // A shared button that is switched off takes no touch at all (`disabled:pointer-events-none`), so it is left out.
      // A level's own switched-off button (level 12's Weigh) still lies under the finger, and is measured.
      return getComputedStyle(b).pointerEvents !== 'none';
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

/** The pad may reach this far beyond a button's drawing, and no further: (44 - 38) / 2 is the most the shared buttons need. */
const MOST_BEYOND = 4;
/** For a button that is drawn large enough and carries no pad: only the browser's rounding of its edge, under a point. */
const NO_PAD = 1;

/**
 * Each named button takes touches over the whole 44 by 44 square about its middle, and its pad stays small:
 * `mostBeyond` points beyond the drawing at most.
 */
async function expectTouchable(page: Page, names: Want[], where: string, mostBeyond = MOST_BEYOND): Promise<Touch[]> {
  const all = await touchAreas(page, names);
  const faults: string[] = [];
  for (const want of names) {
    const found = all.filter((t) => isNamed(t, want));
    if (!found.length) faults.push(`no button ${want} in view to measure (found: ${all.map((t) => t.name).join(', ')})`);
    for (const t of found) {
      const drawn = `drawn ${t.width.toFixed(1)} by ${t.height.toFixed(1)}`;
      if (t.hits < t.points) faults.push(`"${t.name}" (${drawn}): ${t.points - t.hits} of ${t.points} points of its 44 by 44 square go to ${t.takers.join(', ')}`);
      if (t.beyond > mostBeyond) faults.push(`"${t.name}" (${drawn}) takes touches ${t.beyond} points beyond its drawing`);
    }
  }
  // And every button in view, named above or not, keeps its own drawing.
  for (const t of all) if (t.edgesLost.length) faults.push(`"${t.name}": a touch on the edge of its drawing goes to ${t.edgesLost.join(', ')}`);
  expect(faults, where).toEqual([]);
  return all;
}

/** The play screen's bars: the top one, and the tray and the Hint button at the bottom. */
const BARS = ['Back to levels', /^(SD|HD) graphics$/, 'Sound', 'Rules', 'Undo', 'Redo', 'Restart', 'Hint'];

/** Opens a level with `?debug` and waits until its scene is drawn and its rules card is up. */
async function openLevel(page: Page, id: string) {
  await page.goto(`?all&debug&quality=low#/level/${id}`);
  await waitForSession(page, id);
  await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 60_000 });
  return page.getByRole('button', { name: "Let's go!" });
}

async function playScreenButtons(page: Page) {
  const level = LEVELS[0];
  const go = await openLevel(page, level.id);
  await expectTouchable(page, ["Let's go!"], 'the rules card');
  await go.tap();
  await expect(go).toBeHidden();
  // A first play: the guide's Skip button is up, over the scene.
  await expectTouchable(page, ['Skip the guide'], 'the first-play guide');

  // Two moves and one Undo: now Undo, Redo and Restart are all live.
  await playMove(page, level.moves[0], 1);
  await playMove(page, level.moves[1], 2);
  await page.getByRole('button', { name: 'Undo' }).tap();
  await page.waitForFunction(() => {
    const s = window.__riddle!.getState();
    return s.moves.length === 1 && !s.busy;
  });
  const all = await expectTouchable(page, BARS, 'the play screen, mid-level');
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
  await expectTouchable(page, ['Undo', 'Restart'], 'the "Oh no!" card');
}

/** The map's corner, then the About screen: its Back button, every tab, and Reset progress, which is live once a star is saved. */
async function mapAndAbout(page: Page) {
  await seedProgress(page, { [LEVELS[0].id]: 3 });
  await page.goto('?all#/');
  await expectTouchable(page, ['About and settings', 'Sound'], 'the map');
  await page.goto('?all#/about');
  const tabs = page.getByRole('tab');
  await expect(tabs.first()).toBeVisible();
  // Two tabs on the website, four in the app. Each is chosen in turn: the chosen one is drawn in gold, and lower by two points.
  const names = await tabs.allTextContents();
  expect(names.length, 'tabs on the About screen').toBeGreaterThanOrEqual(2);
  for (const chosen of names) {
    await page.getByRole('tab', { name: chosen, exact: true }).tap();
    await expect(page.getByRole('tab', { name: chosen, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expectTouchable(page, ['Back to levels', ...names], `the About screen, on its ${chosen} page`);
  }
  // Reset progress lies in the page that scrolls: brought to the middle of it first.
  await page.getByRole('tab', { name: 'Settings', exact: true }).tap();
  const reset = page.getByRole('button', { name: 'Reset progress' });
  await expect(reset).toBeEnabled();
  await reset.evaluate((b) => b.scrollIntoView({ block: 'center' }));
  await expectTouchable(page, ['Reset progress'], "the About screen's Reset progress", NO_PAD);
}

/** A tap on the scene where a point of the 3D world is drawn, by the camera that `?debug` shows. */
async function tapWorld(page: Page, world: readonly [number, number, number]) {
  const at = await page.evaluate((w) => {
    const { camera } = window.__camera!;
    camera.updateMatrixWorld();
    const v = camera.position.clone().set(w[0], w[1], w[2]).project(camera);
    const r = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }, world);
  await page.touchscreen.tap(at.x, at.y);
}

/** Opens a level and taps through its rules card. */
async function begin(page: Page, id: string) {
  const go = await openLevel(page, id);
  await go.tap();
  await expect(go).toBeHidden();
}

/** Where level 3's small jug stands. From levels/03-two-jugs/src/layout.ts (HOME). */
const SMALL_JUG = [4.15, 0.9, 0.7] as const;
/** Where coin i lies on level 12's table. From traySlot() in levels/12-twelve-coins/src/Scene.tsx. */
const coinSlot = (i: number) => [((i % 6) - 2.5) * 0.8, 0.95, 1.15 + Math.floor(i / 6) * 0.72] as const;

/**
 * The levels that draw buttons of their own. Levels 3 and 12 draw theirs lower than 44 points, and pad them
 * (their Scene.tsx); the others' are drawn 45 points high or more.
 */
async function levelButtons(page: Page) {
  // Level 3: a tap on a jug brings three buttons over it. The two that cannot be used now are greyed, and still take the tap.
  await begin(page, 'two-jugs');
  await tapWorld(page, SMALL_JUG);
  await expectTouchable(page, ['Fill at pump', /^Pour into/, 'Empty in river'], "level 3, the small jug's buttons");

  // Level 12: a panel of buttons, one above the other. "Clues" is drawn 32 points high, so its pad reaches 6 beyond it (7 here: a point for rounding).
  await begin(page, 'twelve-coins');
  const panel = [/Weigh/, /Name the fake/, /^Clues/];
  await expectTouchable(page, panel, 'level 12, at the start', 7);
  // A coin on a pan brings Clear.
  await tapWorld(page, coinSlot(0));
  await expectTouchable(page, ['Clear', ...panel], 'level 12, with a coin on a pan', 7);
  // Name the fake: Back alone, then Heavier and Lighter once a coin is picked.
  await page.getByRole('button', { name: /Name the fake/ }).tap();
  await expectTouchable(page, ['Back'], 'level 12, naming the fake', 7);
  await tapWorld(page, coinSlot(7));
  await expectTouchable(page, [/Heavier/, /Lighter/, 'Back'], 'level 12, saying heavier or lighter', 7);
}

/** The other levels with a button of their own in the scene, and how that button's name starts. */
const OWN_BUTTON: [id: string, name: RegExp][] = [
  ['wolf-two-sheep', /^Row /],
  ['wolf-goat-cabbage', /^Row /],
  ['bridge-and-torch', /^Pick /],
  ['explorers-guardians', /^Sail /],
  ['jealous-couples', /^Fly /],
  ['bridge-five', /^Tap /],
  ['family-crossing', /^Cast off/],
];

const isApp = (project: string) => project.startsWith('app-');

test('play screen: every button of the bars and the cards takes touches over 44 by 44 points', async ({ page }, info) => {
  test.skip(isApp(info.project.name), 'the play screen is the same in the app build');
  await playScreenButtons(page);
});

test('map and About: the corner buttons and the About screen take touches over 44 by 44 points', async ({ page }) => {
  await mapAndAbout(page);
});

test("levels 3 and 12: the scene's own buttons take touches over 44 by 44 points", async ({ page }, info) => {
  test.skip(isApp(info.project.name), 'the levels are the same in the app build');
  await levelButtons(page);
});

test("the other levels' own buttons take touches over 44 by 44 points", async ({ page }, info) => {
  test.skip(isApp(info.project.name), 'the levels are the same in the app build');
  for (const [id, name] of OWN_BUTTON) {
    await begin(page, id);
    await expectTouchable(page, [name], `level ${id}`, NO_PAD);
  }
});

for (const [what, width, height] of [
  ['an iPad held sideways', 1024, 768],
  ['an iPad held upright', 768, 1024],
  ['a phone held upright', 393, 852],
] as const) {
  test.describe(`on ${what} (${width} by ${height})`, () => {
    test.use({ viewport: { width, height } });
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== 'iphone-landscape', 'the size is set here, so one project is enough');
    });
    test('play screen: every button of the bars and the cards takes touches over 44 by 44 points', async ({ page }) => {
      await playScreenButtons(page);
    });
    test('map and About: the corner buttons and the About screen take touches over 44 by 44 points', async ({ page }) => {
      await mapAndAbout(page);
    });
    test("levels 3 and 12: the scene's own buttons take touches over 44 by 44 points", async ({ page }) => {
      await levelButtons(page);
    });
  });
}
