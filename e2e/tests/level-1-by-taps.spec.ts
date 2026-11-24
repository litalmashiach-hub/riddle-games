import { LEVELS } from '../levels';
import { expect, passRulesCard, savedStars, test, waitForSession } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Level 1 the way a player plays it: every step is a tap on the touch screen, from the level map
 * to the win card and on to level 2. No level is unlocked and no graphics setting is forced.
 *
 * The `?debug` hook is only read, never used to play: its camera tells the test where on the
 * screen an animal stands, since an animal is a 3D model with no page element to aim at.
 */

type Animal = 'wolf' | 'sheepA' | 'sheepB';
type Side = 'L' | 'R';

/** Where each animal stands on the right bank (mirrored on the left). From levels/01-wolf-two-sheep/src/Scene.tsx. */
const SLOTS: Record<Animal, { x: number; z: number }> = {
  wolf: { x: 4.1, z: -0.3 },
  sheepA: { x: 3.9, z: 1.4 },
  sheepB: { x: 5.0, z: 0.8 },
};

/** The spot on the screen where a point of the 3D scene is drawn. */
async function screenPoint(page: Page, world: [number, number, number]) {
  return page.evaluate((w) => {
    const { camera } = window.__camera!;
    camera.updateMatrixWorld();
    const v = camera.position.clone().set(w[0], w[1], w[2]).project(camera);
    const r = document.querySelector('canvas')!.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }, world);
}

/** Taps an animal's body. Fails if a button or a bar covers it, as it would for a finger. */
async function tapAnimal(page: Page, animal: Animal, side: Side) {
  const s = SLOTS[animal];
  const at = await screenPoint(page, [(side === 'L' ? -1 : 1) * s.x, 0.75, s.z]);
  const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? 'nothing', at);
  expect(top, `what is on top at ${animal}'s place (${Math.round(at.x)}, ${Math.round(at.y)})`).toBe('CANVAS');
  await page.touchscreen.tap(at.x, at.y);
}

test('level 1 by real taps: from the map to the win card and on to level 2', async ({ page }) => {
  const [one, two] = LEVELS;
  const moves = one.moves as { passenger: Animal | null }[];

  await page.goto('?debug');
  await expect(page.getByRole('heading', { name: 'Riddle Games' })).toBeVisible();
  await expect(page.getByText(`0 / ${LEVELS.length * 3}`)).toBeVisible();

  // A locked level does not open.
  await page.getByRole('button', { name: /^Level 2:/ }).tap();
  await expect(page).not.toHaveURL(/#\/level\//);

  await page.getByRole('button', { name: /^Level 1:/ }).tap();
  await passRulesCard(page, one.title);
  await waitForSession(page, one.id);
  // The camera flies in for 2.2 seconds; aim only once it has landed.
  await page.waitForTimeout(3000);

  const row = page.getByRole('button', { name: /Row across|Row back/ });
  let side: Side = 'L';
  for (const [i, move] of moves.entries()) {
    await expect(row).toBeVisible({ timeout: 30_000 });
    if (move.passenger) {
      await tapAnimal(page, move.passenger, side);
      await expect(row, `the tap put ${move.passenger} in the boat`).toContainText(move.passenger === 'wolf' ? 'with wolf' : 'with sheep');
    } else {
      await expect(row).toContainText('alone');
    }
    await row.tap();
    await expect(page.locator('.tabular-nums'), 'the move counter').toHaveText(String(i + 1));
    side = side === 'L' ? 'R' : 'L';
  }

  await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  expect((await savedStars(page))[one.id]).toBe(3);

  await page.getByRole('button', { name: 'Next level' }).tap();
  await expect(page.getByRole('heading', { name: two.title, exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/level/${two.id}$`));
});

test('level 1: a loss shows the "Oh no!" card, and undo takes it back', async ({ page }) => {
  const one = LEVELS[0];
  await page.goto(`?debug#/level/${one.id}`);
  await passRulesCard(page, one.title);
  await waitForSession(page, one.id);
  await page.waitForTimeout(3000);

  // Rowing one sheep across leaves the wolf alone with the other.
  const row = page.getByRole('button', { name: /Row across|Row back/ });
  await tapAnimal(page, 'sheepA', 'L');
  await expect(row).toContainText('with sheep');
  await row.tap();

  await expect(page.getByRole('heading', { name: 'Oh no!' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/The wolf was left alone with one sheep/)).toBeVisible();
  expect(await savedStars(page), 'a loss saves no stars').toEqual({});

  // Two undo buttons show now: the card's and the bottom bar's. The card's is the one in reach.
  await page.getByRole('button', { name: 'Undo' }).last().tap();
  await expect(page.getByRole('heading', { name: 'Oh no!' })).toBeHidden();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText('Row across');
  const state = await page.evaluate(() => {
    const s = window.__riddle!.getState();
    return { kind: s.status.kind, moves: s.moves.length, ended: s.ended };
  });
  expect(state).toEqual({ kind: 'playing', moves: 0, ended: false });
});
