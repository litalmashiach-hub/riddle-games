import type { CDPSession, Page } from '@playwright/test';
import { LEVELS } from '../levels';
import { expect, passRulesCard, playMove, seedProgress, test, waitForSession } from './fixtures';

/**
 * Every control has a spoken name: what VoiceOver says for it on an iPhone. On each screen, every control the
 * player can see is looked up in Chromium's accessibility tree, the same names and roles that WebKit hands to
 * VoiceOver, and a control with no name fails the test. See docs/voiceover.md.
 *
 * This file runs against both builds: the `iphone-*` projects open the website build, the `app-iphone-*`
 * projects the app build. The app build has no `?debug` hook and keeps later levels locked, so the win and
 * lose cards are reached in the website build only; they are the same code in both.
 */

const CONTROLS = 'button, a[href], input, select, textarea, canvas, [role=button], [role=tab], [role=switch], [role=link], [role=checkbox], [role=dialog], [role=alertdialog], [tabindex]';

interface Control { tag: string; role: string; name: string; props: Record<string, unknown> }

const appBuild = () => test.info().project.name.startsWith('app-');

/** The controls in view on the screen now, as the accessibility tree has them. Ones hidden from it are left out. */
async function controlsInView(page: Page, cdp: CDPSession): Promise<Control[]> {
  const count = await page.evaluate((sel) => {
    document.querySelectorAll('[data-vo-probe]').forEach((e) => e.removeAttribute('data-vo-probe'));
    let i = 0;
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      el.setAttribute('data-vo-probe', String(i++));
    }
    return i;
  }, CONTROLS);
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const out: Control[] = [];
  for (let i = 0; i < count; i++) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-vo-probe="${i}"]` });
    if (!nodeId) continue;
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const ax = nodes[0] as any;
    if (!ax || ax.ignored) continue;
    const tag = await page.evaluate((i) => document.querySelector(`[data-vo-probe="${i}"]`)!.outerHTML.slice(0, 120), i);
    const props = Object.fromEntries((ax.properties ?? []).map((p: any) => [p.name, p.value?.value]));
    out.push({ tag, role: String(ax.role?.value ?? ''), name: String(ax.name?.value ?? '').trim(), props });
  }
  return out;
}

/** Fails, naming each one, if a control on the screen has no spoken name. Returns the controls for further checks. */
async function expectAllNamed(page: Page, cdp: CDPSession, screen: string) {
  await page.waitForTimeout(400);
  const controls = await controlsInView(page, cdp);
  expect(controls.length, `${screen}: some controls are found`).toBeGreaterThan(0);
  const unnamed = controls.filter((c) => !c.name).map((c) => `${c.role}: ${c.tag}`);
  expect(unnamed, `${screen}: every control has a spoken name`).toEqual([]);
  return controls;
}

test.beforeEach(async ({ page }) => {
  await seedProgress(page, { [LEVELS[0].id]: 2 });
});

async function cdpFor(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  return cdp;
}

test('the level map, and the About and settings screen', async ({ page }) => {
  const cdp = await cdpFor(page);
  await page.goto(appBuild() ? '' : '?quality=low');
  await expect(page.locator('h1')).toBeVisible();
  const map = await expectAllNamed(page, cdp, 'level map');
  // A card says what its badge shows; the sound button is a toggle that says its state.
  const one = LEVELS[0];
  expect(map.map((c) => c.name)).toContain(`Level ${one.number}: ${one.title}, 2 of 3 stars`);
  expect(map.map((c) => c.name)).toContain(`Level ${LEVELS[1].number}: ${LEVELS[1].title}, not solved yet`);
  expect(map.map((c) => c.name)).toContain(`Level ${LEVELS[2].number}: ${LEVELS[2].title}, locked`);
  await expect(page.getByRole('button', { name: 'Sound', pressed: true })).toBeVisible();
  await expect(page.getByRole('img', { name: `2 of ${LEVELS.length * 3} stars` })).toBeVisible();

  await page.getByRole('button', { name: 'About and settings' }).tap();
  const tabs = page.getByRole('tab');
  await expect(tabs.first()).toBeVisible();
  for (const tab of await tabs.allInnerTexts()) {
    await page.getByRole('tab', { name: tab.trim() }).tap();
    await expectAllNamed(page, cdp, `About: ${tab.trim()}`);
  }
  await page.getByRole('tab', { name: 'Settings' }).tap();
  await page.getByRole('button', { name: 'Reset progress' }).tap();
  await expectAllNamed(page, cdp, 'About: the reset question');
});

test('a level: its rules card, the play screen and the scene', async ({ page }) => {
  const cdp = await cdpFor(page);
  const one = LEVELS[0];
  await page.goto(`${appBuild() ? '' : '?debug&quality=low'}#/level/${one.id}`);
  await expect(page.getByRole('dialog', { name: `Rules: level ${one.number}, ${one.title}` })).toBeVisible();
  await expectAllNamed(page, cdp, 'rules card');
  await passRulesCard(page, one.title);
  const play = await expectAllNamed(page, cdp, 'play screen');
  const names = play.map((c) => c.name);
  for (const want of ['Back to levels', 'Sound', 'Rules', 'Undo', 'Redo', 'Restart', 'Hint']) expect(names, `the play screen has "${want}"`).toContain(want);
  expect(names.some((n) => /^(HD|SD) graphics$/.test(n)), 'the graphics button says HD or SD').toBe(true);
  expect(names, 'the scene is named after the level').toContain(`Level ${one.number}: ${one.title}, the riddle's scene`);
  // A name alone is not enough for what is no button: without its role VoiceOver skips the scene and the counter.
  await expect(page.locator('canvas'), 'the scene is a picture to VoiceOver').toHaveRole('img');
  await expect(page.getByRole('img', { name: `Level ${one.number}: ${one.title}, the riddle's scene` })).toBeVisible();
  const counter = page.getByRole('img', { name: /^\d+ \S.*, best \d+$/ });
  await expect(counter, 'the move counter is spoken: "0 crossings, best 7"').toHaveCount(1);
  await expect(counter).toBeVisible();
  await expect(counter).toHaveAccessibleName(/^0 /);
  // What it says is what it shows.
  const shown = (await counter.innerText()).replace(/\s+/g, ' ').toLowerCase();
  expect(shown, 'the counter shows its count and its best').toMatch(/^0 .*best \d+$/);
  expect((await counter.getAttribute('aria-label'))!.endsWith(`best ${shown.match(/best (\d+)$/)![1]}`)).toBe(true);
  if (!appBuild()) {
    await playMove(page, one.moves[0], 1);
    await expect(counter, 'the spoken count follows the moves').toHaveAccessibleName(/^1 /);
    await page.evaluate(() => window.__riddle!.getState().undo());
    await expect(counter).toHaveAccessibleName(/^0 /);
  }

  // A hint is spoken as well as shown: it appears inside a live region that was in the page, empty, before it.
  const spoken = page.getByTestId('hint-spoken');
  await expect(spoken, 'the live region is there before any hint').toHaveCount(1);
  await expect(spoken).toBeEmpty();
  await expect(spoken, 'the hint is announced: its wrapper is a live region').toHaveRole('status');
  await expect(spoken).toHaveAttribute('aria-live', 'polite');
  expect(await spoken.evaluate((el) => !el.closest('[aria-hidden="true"], [inert]')), 'the live region is not hidden from VoiceOver').toBe(true);
  await page.getByRole('button', { name: 'Hint' }).first().tap();
  await expect(spoken).not.toBeEmpty();
  // The words on the screen are the words spoken, once.
  const hint = (await spoken.innerText()).trim();
  expect(hint.length, 'the hint has words').toBeGreaterThan(5);
  await expect(page.getByText(hint, { exact: true })).toHaveCount(1);
});

/** What has the focus now: a control's spoken name, or the page itself. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'the page';
    return el.getAttribute('aria-label') ?? (el as HTMLElement).innerText.trim();
  });
/** True if the focused element is drawn with a focus ring. */
const ringShown = (page: Page) => page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle !== 'none');
const scrolled = (page: Page) =>
  page.evaluate(() => [window.scrollX, window.scrollY, ...[...document.querySelectorAll('*')].filter((e) => e.scrollTop || e.scrollLeft).map((e) => e.scrollTop + e.scrollLeft)].some((n) => n !== 0));

test('when the rules card closes, the focus goes to a button, with no ring or scroll for a player who taps', async ({ page }) => {
  const one = LEVELS[0];
  const rules = page.getByRole('dialog', { name: `Rules: level ${one.number}, ${one.title}` });
  await page.goto(`${appBuild() ? '' : '?debug&quality=low'}#/level/${one.id}`);
  await expect(rules).toBeFocused();

  // Opened by the level itself: nothing opened it, so the Rules button, which brings it back, gets the focus.
  await passRulesCard(page, one.title);
  expect(await focused(page)).toBe('Rules');
  expect(await ringShown(page), 'no focus ring after a tap').toBe(false);
  expect(await scrolled(page), 'nothing scrolled').toBe(false);

  // Opened by a button: back to that button. A tap elsewhere first, so that the focus has to be given back, not kept.
  await page.getByRole('button', { name: /^(HD|SD) graphics$/ }).tap();
  await page.getByRole('button', { name: /^(HD|SD) graphics$/ }).tap();
  await page.getByRole('button', { name: 'Rules' }).tap();
  await expect(rules).toBeFocused();
  await rules.getByRole('button', { name: "Let's go!" }).tap();
  await expect(rules).toBeHidden();
  expect(await focused(page)).toBe('Rules');
  expect(await ringShown(page), 'no focus ring after a tap').toBe(false);
  expect(await scrolled(page), 'nothing scrolled').toBe(false);

  // By keys: Enter on the Rules button opens the card, Enter on its own button closes it, and the focus is back
  // on Rules, this time with its ring, so that a keyboard player sees where they are.
  await page.keyboard.press('Enter');
  await expect(rules).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await focused(page)).toBe("Let's go!");
  await page.keyboard.press('Enter');
  await expect(rules).toBeHidden();
  expect(await focused(page)).toBe('Rules');
  expect(await ringShown(page), 'a keyboard player sees the ring').toBe(true);

  // Escape closes the card too.
  await page.keyboard.press('Enter');
  await expect(rules).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rules).toBeHidden();
  expect(await focused(page)).toBe('Rules');
});

test('the card for a scene that can\'t be shown takes the focus, and all under it is out of reach', async ({ page, faults }) => {
  const cdp = await cdpFor(page);
  const one = LEVELS[0];
  // The device gives no 3D context until the test allows it (as in scene-loading.spec.ts).
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
      if (/webgl/.test(type) && !(window as any).__allow3d) return null;
      return (getContext as any).call(this, type, ...rest);
    } as any;
  });
  await page.goto(`${appBuild() ? '' : '?debug&quality=low'}#/level/${one.id}`);
  const card = page.getByRole('alertdialog', { name: "This level can't be shown" });
  const rules = page.locator('[role="dialog"]');
  await expect(card).toBeVisible();

  // The rules card is still in the page, under the card. The focus is in the card on top, not under it.
  await expect(rules).toHaveCount(1);
  await expect(card).toBeFocused();
  expect(await ringShown(page), 'no focus ring on the card').toBe(false);
  await expect(card).toHaveAttribute('aria-modal', 'true');
  // The accessibility tree has the card's two buttons and nothing of what lies under it.
  const controls = await expectAllNamed(page, cdp, "the level can't be shown");
  expect(controls.map((c) => c.name).sort()).toEqual(['All levels', "This level can't be shown", 'Try again']);
  // Nor does the keyboard get under it.
  const stops = new Set<string>();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => {
      const el = document.activeElement;
      return el && el !== document.body && !el.closest('[role="alertdialog"]') ? el.outerHTML.slice(0, 80) : null;
    });
    if (at) stops.add(at);
  }
  expect([...stops], 'Tab stops outside the card').toEqual([]);

  // Once the scene can be drawn, "Try again" takes the card away, and the focus is back in the rules card.
  await page.evaluate(() => ((window as any).__allow3d = true));
  await card.getByRole('button', { name: 'Try again' }).tap();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: `Rules: level ${one.number}, ${one.title}` })).toBeFocused();
  expect(await page.locator('[inert]').count(), 'nothing is left out of reach').toBe(0);
  await passRulesCard(page, one.title);
  expect(await focused(page)).toBe('Rules');

  // The planted fault's own console lines are not the game's.
  const PLANTED = /WebGL|context|reading 'alpha'|3D scene could not be drawn/i;
  faults.consoleErrors = faults.consoleErrors.filter((t) => !PLANTED.test(t));
  faults.pageErrors = faults.pageErrors.filter((t) => !PLANTED.test(t));
});

test('the lose and win cards', async ({ page }) => {
  test.skip(appBuild(), 'the app build has no debug hook; the cards are the same code in both builds');
  const cdp = await cdpFor(page);
  const one = LEVELS[0];
  await page.goto(`?debug&quality=low#/level/${one.id}`);
  await waitForSession(page, one.id);
  await passRulesCard(page, one.title);
  const losing = await page.evaluate(() => {
    const s = window.__riddle!.getState();
    const r = s.level.rules;
    const st = s.history[s.history.length - 1];
    return r.legalMoves(st).find((m: unknown) => r.status(r.apply(st, m)).kind === 'lost');
  });
  expect(losing, 'level 1 has a move that loses').toBeTruthy();
  await playMove(page, losing, 1);
  await expect(page.getByRole('dialog', { name: 'Oh no!' })).toBeVisible({ timeout: 30_000 });
  await expectAllNamed(page, cdp, 'lose card');

  // Undo closes the card, and the focus goes to a button of the play screen: Undo where it can still be used,
  // else Rules. Here the losing move was the only one, so Undo is switched off.
  await expect(page.getByRole('dialog', { name: 'Oh no!' })).toBeFocused();
  await page.getByRole('dialog', { name: 'Oh no!' }).getByRole('button', { name: 'Undo' }).tap();
  await expect(page.getByRole('dialog', { name: 'Oh no!' })).toBeHidden();
  expect(await focused(page)).toBe('Rules');
  expect(await ringShown(page), 'no focus ring after a tap').toBe(false);
  // After a move that is safe and one that loses, Undo is there to go back further: the focus goes to it.
  await playMove(page, one.moves[0], 1);
  const losingNext = await page.evaluate(() => {
    const s = window.__riddle!.getState();
    const r = s.level.rules;
    const st = s.history[s.history.length - 1];
    return r.legalMoves(st).find((m: unknown) => r.status(r.apply(st, m)).kind === 'lost');
  });
  if (losingNext) {
    await playMove(page, losingNext, 2);
    await expect(page.getByRole('dialog', { name: 'Oh no!' })).toBeFocused({ timeout: 30_000 });
    await page.getByRole('dialog', { name: 'Oh no!' }).getByRole('button', { name: 'Undo' }).tap();
    await expect(page.getByRole('dialog', { name: 'Oh no!' })).toBeHidden();
    expect(await focused(page)).toBe('Undo');
    expect(await ringShown(page), 'no focus ring after a tap').toBe(false);
  }
  await page.evaluate(() => window.__riddle!.getState().restart());

  // Lose once more, for the card's Restart.
  await playMove(page, losing, 1);
  await expect(page.getByRole('dialog', { name: 'Oh no!' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Restart' }).last().tap();
  await expect(page.getByRole('dialog', { name: 'Oh no!' })).toBeHidden();
  expect(await focused(page)).toBe('Rules');
  for (const [i, move] of one.moves.entries()) await playMove(page, move, i + 1);
  await expect(page.getByRole('dialog', { name: 'Solved!' })).toBeVisible({ timeout: 30_000 });
  const win = await expectAllNamed(page, cdp, 'win card');
  expect(win.map((c) => c.name)).toEqual(expect.arrayContaining(['Next level', 'Play again', 'All levels']));
  await expect(page.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();

  // "Play again" closes the win card: the control that opened it is gone, so the focus goes to Rules.
  await expect(page.getByRole('dialog', { name: 'Solved!' })).toBeFocused();
  await page.getByRole('button', { name: 'Play again' }).tap();
  await expect(page.getByRole('dialog', { name: 'Solved!' })).toBeHidden();
  expect(await focused(page)).toBe('Rules');
  expect(await ringShown(page), 'no focus ring after a tap').toBe(false);
  expect(await scrolled(page), 'nothing scrolled').toBe(false);
});
