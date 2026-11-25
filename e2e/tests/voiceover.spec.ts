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

  // A hint is spoken as well as shown.
  await page.getByRole('button', { name: 'Hint' }).first().tap();
  await expect(page.getByTestId('hint-spoken')).not.toBeEmpty();
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

  await page.getByRole('button', { name: 'Restart' }).last().tap();
  for (const [i, move] of one.moves.entries()) await playMove(page, move, i + 1);
  await expect(page.getByRole('dialog', { name: 'Solved!' })).toBeVisible({ timeout: 30_000 });
  const win = await expectAllNamed(page, cdp, 'win card');
  expect(win.map((c) => c.name)).toEqual(expect.arrayContaining(['Next level', 'Play again', 'All levels']));
  await expect(page.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
});
