import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { LEVELS } from '../levels';
import { expect, passRulesCard, test, waitForSession } from './fixtures';

/**
 * The HD/SD button pressed in the middle of a level, with Reduce Motion on and off.
 *
 * Most levels give their sparkles more dots in HD than in SD. drei then throws its points away and makes new
 * ones, with a new material and a fresh copy of its shader. That shader divides by zero at a dot's middle, and
 * the bloom spreads the bad pixel over the whole frame: the scene goes blank, and with Reduce Motion on it stays
 * blank (see packages/fx/src/Sparkles.tsx). The guard must reach the new points too.
 *
 * A blank frame needs a dot to land exactly on a pixel's centre, which happens only now and then. So the test
 * looks at the cause, which is certain: it records every shader the browser is handed and fails if drei's
 * unguarded sparkle shader is ever among them. It also checks that the scene is drawn after each press.
 */

const RAW = '0.05 / distanceToCenter';
const GUARDED = '0.05 / max(distanceToCenter, 0.001)';

/** The levels whose sparkles change their number of dots with the HD/SD button, read from their source. */
function levelsWithSwitchingSparkles(): Set<string> {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'levels');
  const found = new Set<string>();
  const walk = (dir: string, level: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path, level);
      else if (/\.tsx$/.test(e.name) && /<Sparkles\s[^>]*count=\{\s*(high|low)\b/.test(readFileSync(path, 'utf8'))) found.add(level);
    }
  };
  for (const level of readdirSync(root)) walk(join(root, level), level);
  return found;
}

const SWITCHING = levelsWithSwitchingSparkles();
const CASES = LEVELS.filter((l) => SWITCHING.has(l.dir));

/** Counts the shaders the page hands to WebGL: drei's raw sparkle shader, and the guarded one. */
async function recordShaders(page: Page) {
  await page.addInitScript(
    ([raw, guarded]) => {
      const seen = { raw: 0, guarded: 0 };
      (window as unknown as { __sparkleShaders: typeof seen }).__sparkleShaders = seen;
      for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
        const original = C.prototype.shaderSource;
        C.prototype.shaderSource = function (shader: WebGLShader, source: string) {
          if (source.includes(raw)) seen.raw++;
          if (source.includes(guarded)) seen.guarded++;
          return original.call(this, shader, source);
        };
      }
    },
    [RAW, GUARDED],
  );
}

const shaders = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __sparkleShaders: { raw: number; guarded: number } }).__sparkleShaders }));

/** A fresh frame holds a picture, not one flat colour: read from the canvas right after the scene's own drawing. */
async function expectSceneDrawn(page: Page, what: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<number>((done) => {
              requestAnimationFrame(() => {
                const canvas = document.querySelector('canvas');
                const gl = (canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')) as WebGL2RenderingContext | null | undefined;
                if (!canvas || !gl || gl.isContextLost()) return done(0);
                const colours = new Set<number>();
                const px = new Uint8Array(4);
                for (let x = 1; x < 12; x++) {
                  for (let y = 1; y < 8; y++) {
                    gl.readPixels(Math.floor((canvas.width * x) / 12), Math.floor((canvas.height * y) / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                    colours.add((px[0] << 16) | (px[1] << 8) | px[2]);
                  }
                }
                done(colours.size);
              });
            }),
        ),
      { message: `${what}: the scene is drawn (colours found at 77 points of a fresh frame)`, timeout: 15_000 },
    )
    .toBeGreaterThan(8);
}

test('the levels with sparkles that change with HD/SD are found', () => {
  // Fifteen levels when this test was written. Fewer than five means the search above no longer matches.
  expect(CASES.length).toBeGreaterThanOrEqual(5);
});

for (const motion of ['reduce', 'no-preference'] as const) {
  test.describe(`with Reduce Motion ${motion === 'reduce' ? 'on' : 'off'}`, () => {
    test.use({ reducedMotion: motion });

    for (const level of CASES) {
      const nn = String(level.number).padStart(2, '0');
      test(`level ${nn} ${level.id}: SD to HD and back mid-level, every sparkle guarded`, async ({ page }, testInfo) => {
        // The same scene at every phone size: one size is enough.
        test.skip(testInfo.project.name !== 'iphone-landscape');
        await recordShaders(page);
        await page.goto(`?debug&quality=low#/level/${level.id}`);
        await waitForSession(page, level.id);
        await passRulesCard(page, level.title);
        await expect(page.getByRole('status', { name: 'Loading level' })).toHaveCount(0, { timeout: 60_000 });
        await expectSceneDrawn(page, 'in SD');

        const button = page.getByRole('button', { name: /^(HD|SD) graphics$/ });
        await expect(button).toHaveAccessibleName('SD graphics');
        await button.tap();
        await expect(button).toHaveAccessibleName('HD graphics');
        await page.waitForTimeout(1500);
        await expectSceneDrawn(page, 'after switching to HD');

        await button.tap();
        await expect(button).toHaveAccessibleName('SD graphics');
        await page.waitForTimeout(1500);
        await expectSceneDrawn(page, 'after switching back to SD');

        const seen = await shaders(page);
        expect(seen.guarded, 'guarded sparkle shaders compiled').toBeGreaterThan(0);
        expect(seen.raw, "drei's unguarded sparkle shader compiled, which can blank the scene").toBe(0);
      });
    }
  });
}
