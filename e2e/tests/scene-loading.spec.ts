import { LEVELS } from '../levels';
import { expect, expectClean, passRulesCard, playMove, test, waitForSession, type PageFaults } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * A level is never a blank screen: while its scene is made a loading sign shows, and when the
 * scene can't be drawn a card says so, with a way to try again and a way back to the map.
 *
 * The browser is made slow, or broken, on purpose here. The game itself is the production build, unchanged.
 */

const one = LEVELS[0];
const curtain = (page: Page) => page.getByRole('status', { name: 'Loading level' });
const message = (page: Page) => page.getByRole('alertdialog', { name: "This level can't be shown" });

/**
 * What the browser and the 3D library log when a context is refused or lost. These are the fault
 * that the test plants, so they are taken out; anything else still fails the test.
 */
const PLANTED = /WebGL|context|reading 'alpha'|3D scene could not be drawn/i;
function dropPlanted(faults: PageFaults) {
  faults.consoleErrors = faults.consoleErrors.filter((t) => !PLANTED.test(t));
  faults.pageErrors = faults.pageErrors.filter((t) => !PLANTED.test(t));
}

test('the app shows its loading mark until the game has started', async ({ page }) => {
  // Hold the game's script back, as a slow device would.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/assets\/.*\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('', { waitUntil: 'commit' });
  const boot = page.getByRole('status', { name: 'Loading Riddle Games' });
  await expect(boot).toBeVisible();
  // It fades in after a moment (so that a fast start shows nothing), then stays.
  await expect(boot).toHaveCSS('opacity', '1');
  await expect(page.getByRole('heading', { name: 'Riddle Games' })).toHaveCount(0);

  release();
  await expect(page.getByRole('heading', { name: 'Riddle Games' })).toBeVisible();
  await expect(boot).toHaveCount(0);
});

/**
 * Slows the scene on purpose: the browser says "still compiling" for every shader until the test
 * lets go with `__compiled = true`. `waitMs` replaces the game's own wait for a first drawing.
 */
async function holdShaders(page: Page, waitMs?: number) {
  await page.addInitScript((ms) => {
    if (ms != null) (window as any).__sceneWaitMs = ms;
    const STATUS = 0x91b1; // COMPLETION_STATUS_KHR
    for (const GL of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const getExtension = GL.prototype.getExtension;
      GL.prototype.getExtension = function (this: any, name: string) {
        const real = getExtension.call(this, name);
        return name === 'KHR_parallel_shader_compile' ? (real ?? { COMPLETION_STATUS_KHR: STATUS }) : real;
      } as any;
      const getProgramParameter = GL.prototype.getProgramParameter;
      GL.prototype.getProgramParameter = function (this: any, program: WebGLProgram, pname: number) {
        if (pname === STATUS) return (window as any).__compiled === true;
        return getProgramParameter.call(this, program, pname);
      };
    }
  }, waitMs ?? null);
}

test('a level shows a loading sign until its scene is drawn', async ({ page }) => {
  // The game's patience is set far beyond this test's length, so that a slow test machine can't run into it.
  await holdShaders(page, 3_600_000);

  await page.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);

  // Behind the rules card: the curtain covers the canvas, and the card says what is going on.
  await expect(curtain(page)).toBeVisible();
  await expect(page.getByText('Setting the scene')).toBeVisible();
  await passRulesCard(page, one.title);

  // With the card gone and the scene still not drawn, the sign is in the middle of the screen, and it stays.
  await expect(curtain(page)).toBeVisible();
  await expect(curtain(page).getByText('Setting the scene')).toBeVisible();
  await page.waitForTimeout(4000);
  await expect(curtain(page)).toBeVisible();
  // The way back is in reach all the while.
  await expect(page.getByRole('button', { name: 'Back to levels' })).toBeVisible();

  await page.evaluate(() => ((window as any).__compiled = true));
  await expect(curtain(page)).toHaveCount(0);
  await expect(page.getByText('Setting the scene')).toHaveCount(0);
  await playMove(page, one.moves[0], 1);
});

test('a scene that is still not drawn after the wait gets the card, never a bare screen', async ({ page }) => {
  // The game's own wait, untouched. The page keeps its own record, on its own clock, so the speed of
  // the test machine has no part in it: what was up 15 seconds after the loading sign first showed,
  // and whether the sign was ever gone while neither the card nor the drawn scene had taken its place.
  await holdShaders(page);
  await page.addInitScript(() => {
    const w = window as any;
    w.__seen = { early: null, bare: false };
    const look = () => ({
      sign: !!document.querySelector('[role="status"][aria-label="Loading level"]'),
      card: !!document.querySelector('[role="alertdialog"]'),
    });
    let signed = false;
    new MutationObserver(() => {
      const now = look();
      if (now.sign && !signed) {
        signed = true;
        setTimeout(() => (w.__seen.early = look()), 15_000);
      }
      if (signed && !now.sign && !w.__compiled) w.__seen.bare = true;
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);
  await expect(curtain(page)).toBeVisible();

  // The wait is 30 seconds. Then the card comes, over the rules card and the loading sign.
  await expect(message(page)).toBeVisible({ timeout: 120_000 });
  const seen = await page.evaluate(() => (window as any).__seen);
  expect(seen.early, 'after 15 seconds: the loading sign still, and no card yet').toEqual({ sign: true, card: false });
  await expect(curtain(page)).toBeVisible();
  await expect(message(page).getByRole('button', { name: 'All levels' })).toBeInViewport({ ratio: 1 });

  // Trying again starts the wait anew: the card goes, the sign stays.
  await message(page).getByRole('button', { name: 'Try again' }).tap();
  await expect(message(page)).toHaveCount(0);
  await expect(curtain(page)).toBeVisible();
  expect(await page.evaluate(() => (window as any).__seen.bare), 'the sign was gone with nothing in its place').toBe(false);

  // Once the device gets there, the level is drawn and plays.
  await page.evaluate(() => ((window as any).__compiled = true));
  await expect(curtain(page)).toHaveCount(0);
  await expect(message(page)).toHaveCount(0);
  await passRulesCard(page, one.title);
  await playMove(page, one.moves[0], 1);
});

test('a scene that is drawn late after all takes the card away by itself', async ({ page }) => {
  await holdShaders(page, 3000);
  await page.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);
  await expect(message(page)).toBeVisible();
  await expect(curtain(page)).toBeVisible();

  await page.evaluate(() => ((window as any).__compiled = true));
  await expect(message(page)).toHaveCount(0);
  await expect(curtain(page)).toHaveCount(0);
  await passRulesCard(page, one.title);
  await playMove(page, one.moves[0], 1);
});

for (const [name, plant] of [
  [
    'the device gives no 3D context',
    () => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
        if (/webgl/.test(type) && !(window as any).__allow3d) return null;
        return (getContext as any).call(this, type, ...rest);
      } as any;
    },
  ],
  [
    // What the iPhone simulator did: "null is not an object (evaluating 'e.getContext().getContextAttributes().alpha')".
    'the 3D context is dead on arrival',
    () => {
      for (const GL of [WebGLRenderingContext, WebGL2RenderingContext]) {
        const getContextAttributes = GL.prototype.getContextAttributes;
        GL.prototype.getContextAttributes = function (this: any) {
          return (window as any).__allow3d ? getContextAttributes.call(this) : null;
        };
      }
    },
  ],
] as const) {
  test(`when ${name}, the level says so and offers two ways out`, async ({ page, faults }) => {
    await page.addInitScript(plant);
    await page.goto(`?debug&quality=low#/level/${one.id}`);
    await waitForSession(page, one.id);

    await expect(message(page)).toBeVisible();
    await expect(message(page)).toContainText("Your device didn't draw the 3D scene this time.");
    const again = message(page).getByRole('button', { name: 'Try again' });
    const back = message(page).getByRole('button', { name: 'All levels' });
    await expect(again).toBeInViewport({ ratio: 1 });
    await expect(back).toBeInViewport({ ratio: 1 });

    // Trying again while the fault lasts brings the card back, not a blank screen.
    await again.tap();
    await expect(message(page)).toBeVisible();

    // Once the device gives a context, trying again draws the level, and it plays.
    await page.evaluate(() => ((window as any).__allow3d = true));
    await again.tap();
    await expect(message(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toBeVisible();
    await passRulesCard(page, one.title);
    await expect(curtain(page)).toHaveCount(0);
    await playMove(page, one.moves[0], 1);

    dropPlanted(faults);
    expectClean(faults);
  });

  test(`when ${name}, "All levels" leads back to the map`, async ({ page, faults }) => {
    await page.addInitScript(plant);
    await page.goto(`?debug&quality=low#/level/${one.id}`);
    await expect(message(page)).toBeVisible();
    await message(page).getByRole('button', { name: 'All levels' }).tap();
    await expect(page.getByRole('heading', { name: 'Riddle Games' })).toBeVisible();
    await expect(page).not.toHaveURL(/#\/level\//);
    await expect(message(page)).toHaveCount(0);
    dropPlanted(faults);
    expectClean(faults);
  });
}

/** Takes the 3D context away, as iOS does to an app in the background. `backAfter` hands it back after that many ms, by the page's own clock. */
async function loseContext(page: Page, backAfter?: number) {
  await page.evaluate((ms) => {
    const canvas = document.querySelector('canvas')!;
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext;
    const ext = gl.getExtension('WEBGL_lose_context')!;
    ext.loseContext();
    if (ms != null) setTimeout(() => ext.restoreContext(), ms);
  }, backAfter ?? null);
}

test('a 3D context that is lost while playing and stays lost brings the card, and trying again keeps the moves', async ({ page, faults }) => {
  await page.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);
  await passRulesCard(page, one.title);
  await expect(curtain(page)).toHaveCount(0);
  await playMove(page, one.moves[0], 1);

  await loseContext(page);
  await expect(message(page)).toBeVisible();
  await message(page).getByRole('button', { name: 'Try again' }).tap();
  await expect(message(page)).toHaveCount(0);
  await expect(curtain(page)).toHaveCount(0);

  // The move made before the loss is still there, and the level plays on.
  expect(await page.evaluate(() => window.__riddle!.getState().moves.length)).toBe(1);
  await expect(page.getByRole('heading', { name: one.title, exact: true })).toHaveCount(0);
  await playMove(page, one.moves[1], 2);

  dropPlanted(faults);
  expectClean(faults);
});

test('a 3D context that is lost for a moment and comes back shows no card', async ({ page, faults }) => {
  await page.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);
  await passRulesCard(page, one.title);
  await expect(curtain(page)).toHaveCount(0);

  // The page itself notes a card at any moment, however short: one that flashes up and away counts too.
  await page.evaluate(() => {
    const w = window as any;
    w.__sawCard = false;
    new MutationObserver(() => {
      if (document.querySelector('[role="alertdialog"]')) w.__sawCard = true;
    }).observe(document, { childList: true, subtree: true });
  });
  // Gone for a full second: far longer than a blink, well inside the game's patience of 2.5 seconds.
  await loseContext(page, 1000);
  // Longer than the game waits before it would show the card.
  await page.waitForTimeout(5000);
  await expect(message(page)).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__sawCard), 'a card showed while the context was away').toBe(false);
  await playMove(page, one.moves[0], 1);

  dropPlanted(faults);
  expectClean(faults);
});
