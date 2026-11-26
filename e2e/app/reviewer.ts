/**
 * TEST ONLY (branch test/reviewer-session-mac-test, never for main). A session with the built app as
 * Apple's App Review would have it: first launch, the reviewer note's own path through levels 1 to 5,
 * a loss and Undo, Hint, harder levels, a trip to the background mid-level, every page of About and
 * settings, the gestures a browser would answer (long press, pinch, double tap, edge swipe, pull), and
 * the device turned. Every press is a real touch placed by XCTest; scripts in the page only read, but
 * for one shortcut that is said where it happens (stars written for levels 1 to 29, to reach hard levels
 * that a reviewer would reach only by solving all before them).
 *
 *   tsx e2e/app/reviewer.ts --device iphone --out out/iphone --caps '{...}' --bundle-id X [--orientation LANDSCAPE] [--fps 6] [--sd-first]
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LEVELS, type LevelCase } from '../levels';
import { levelRules, lossPath } from '../loss-paths';
import { PLAYERS } from '../taps/players';
import { TapFault, Taps, type Point, type TapRecord } from '../taps/harness';
import { AppiumBackend } from './backends';
import { FakePage, sleep } from './fake-page';

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
);
const device = args.device ?? 'device';
const out = resolve(args.out ?? `out/${device}`);
const shots = join(out, 'shots');
mkdirSync(shots, { recursive: true });
(globalThis as any).__outDir = out;
const HARD = (args.hard ?? '12,18,30').split(',').map(Number).filter(Boolean);

function log(s: string) {
  const line = `${new Date().toISOString().slice(11, 19)} [review] ${s}`;
  console.log(line);
  appendFileSync(join(out, 'run-log.txt'), line + '\n');
}

class AppTaps extends Taps {
  constructor(readonly fake: FakePage, level: LevelCase) {
    super(fake as any, level, fake.viewportSize());
  }
  override async dragAt(from: Point, to: Point, what: string, opts: { steps?: number; stepMs?: number; holdMs?: number } = {}): Promise<TapRecord> {
    const seen = await (this as any).look(from, what);
    const rec: TapRecord = { step: this.step, what, kind: 'drag', at: from, to, ...seen };
    this.log.push(rec);
    if (seen.onTop !== 'CANVAS') throw new TapFault('covered', this.step, `${what} lies under ${seen.onTop}`);
    await this.fake.backend.drag(from, to, { steps: opts.steps ?? 8, stepMs: opts.stepMs ?? 40, holdMs: opts.holdMs ?? 120 });
    return rec;
  }
}

async function waitIdle(page: FakePage, timeout = 90_000) {
  await page.waitForFunction(() => {
    const s = (window as any).__riddle.getState();
    return s.status.kind !== 'playing' || !s.busy;
  }, undefined, { timeout });
}
async function waitCameraStill(page: FakePage, quietMs = 800, timeout = 60_000) {
  const end = Date.now() + timeout;
  let last = '';
  let since = Date.now();
  while (Date.now() < end) {
    const now = JSON.stringify(await page.evaluate(() => (window as any).__taps.camera()?.map((n: number) => Math.round(n * 1e4))));
    if (now !== last) { last = now; since = Date.now(); } else if (Date.now() - since >= quietMs) return;
    await sleep(150);
  }
  throw new Error('the camera never came to rest');
}

/** What a reviewer would read on the screen now: every visible text, and the page's own measures. */
const SCREEN = () => {
  const seen: string[] = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.textContent?.trim();
    const el = n.parentElement;
    if (!t || !el) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
    seen.push(t);
  }
  const vv = window.visualViewport;
  return {
    hash: location.hash,
    texts: seen,
    scale: vv ? vv.scale : null,
    scroll: [scrollX, scrollY, document.scrollingElement?.scrollTop ?? 0],
    selection: String(getSelection() ?? ''),
    size: [innerWidth, innerHeight],
  };
};

async function main() {
  const caps = JSON.parse(args.caps ?? '{}');
  const appium = new AppiumBackend(caps, log);
  const s0 = Date.now();
  await appium.start();
  log(`web view found ${((Date.now() - s0) / 1000).toFixed(0)} s after the session was asked for: ${appium.size().width} by ${appium.size().height}`);
  if (args.orientation && args.orientation !== '-') {
    await appium.setOrientation(args.orientation as 'PORTRAIT' | 'LANDSCAPE');
    log(`turned ${args.orientation}: ${appium.size().width} by ${appium.size().height}`);
  }
  log(`calibration: ${await appium.calibrate()}`);
  const page = new FakePage(appium);
  const d = appium.driver;
  let n = 0;
  const shot = async (what: string) => {
    const file = `${device}-${String(++n).padStart(2, '0')}-${what}.png`;
    try { await appium.screenshot(join(shots, file)); } catch (e) { log(`picture ${what} failed: ${e}`); return ''; }
    return file;
  };
  const screen = () => appium.exec<ReturnType<typeof SCREEN>>(SCREEN.toString());
  const waitMap = (timeout = 180_000) => page.waitForFunction(() => !!document.querySelector('[aria-label="About and settings"]') && !!document.querySelector('button[aria-label^="Level 1:"]'), undefined, { timeout });
  const result: Record<string, any> = { device, startedAt: new Date().toISOString(), steps: {} };
  const save = () => writeFileSync(join(out, 'review.json'), JSON.stringify(result, null, 1));
  const step = async (name: string, fn: () => Promise<unknown>) => {
    log(`--- ${name}`);
    const t = Date.now();
    try {
      const v = await fn();
      result.steps[name] = { ok: true, seconds: Math.round((Date.now() - t) / 1000), ...(v && typeof v === 'object' ? v : { value: v }) };
    } catch (e: any) {
      log(`${name} FAILED: ${e?.stack ?? e}`);
      result.steps[name] = { ok: false, seconds: Math.round((Date.now() - t) / 1000), error: String(e?.message ?? e).slice(0, 1500), shot: await shot(`${name}-failed`) };
      // Back to a known place, if we can.
      await page.getByRole('button', { name: 'All levels', exact: true }).tap({ timeout: 3000 }).catch(() => undefined);
      await page.getByRole('button', { name: 'Back to levels' }).tap({ timeout: 3000 }).catch(() => undefined);
      await waitMap(60_000).catch(() => undefined);
    }
    result.faults = await appium.exec('() => window.__appFaults').catch(() => null);
    save();
  };

  /** Opens a level from its card (scrolled into view by the page's own list if needed), closes the rules card by a touch. */
  const openLevel = async (num: number, via: 'card' | 'next' = 'card') => {
    const level = LEVELS.find((l) => l.number === num)!;
    if (via === 'next') await page.getByRole('button', { name: 'Next level' }).tap();
    else {
      const card = page.getByRole('button', { name: new RegExp(`^Level ${num}: `) });
      const b = await card.boundingBox();
      const sz = appium.size();
      if (!b || b.x < 0 || b.y < 0 || b.x + b.width > sz.width || b.y + b.height > sz.height) {
        await page.evaluate((spec) => (window as any).__appScrollTo(spec, 0), { steps: (card as any).steps });
        await sleep(1200);
      }
      await card.tap();
    }
    const go = page.getByRole('button', { name: "Let's go!" });
    const t = Date.now();
    await go.waitFor({ state: 'visible', timeout: 600_000 });
    await page.waitForFunction((id) => !!(window as any).__taps?.ready() && (window as any).__riddle?.getState().level.id === id, level.id, { timeout: 600_000 });
    const openSeconds = Math.round((Date.now() - t) / 1000);
    await sleep(1500);
    const rules = await shot(`L${num}-rules-card`);
    const rulesText = (await screen()).texts;
    for (let k = 1; k <= 3; k++) {
      await go.tap();
      try { await go.waitFor({ state: 'hidden', timeout: 60_000 }); break; } catch { log(`L${num}: rules card still up after touch ${k}`); if (k === 3) throw new Error('the rules card did not close'); }
    }
    await waitCameraStill(page);
    await waitIdle(page);
    return { level, openSeconds, rules, rulesText };
  };

  /** Plays the given moves by real taps; on a tap fault, says so and finishes by the debug hook. */
  const playMoves = async (level: LevelCase, moves: unknown[], r: Record<string, any>, mid?: (i: number) => Promise<void>) => {
    const taps = new AppTaps(page, level);
    const player = PLAYERS[level.id];
    r.movesByTaps = 0;
    try {
      await player.setup?.(taps);
      for (const [i, move] of moves.entries()) {
        taps.step = i + 1;
        const before = await taps.snapshot();
        await player.move(taps, move, before.state, i);
        try {
          await page.waitForFunction((k) => (window as any).__riddle.getState().moves.length >= k, i + 1, { timeout: 45_000 });
        } catch {
          throw new TapFault('no-move', i + 1, `no move followed the touches for ${JSON.stringify(move)}. Last touch: ${taps.lastTouch()}`);
        }
        r.movesByTaps = i + 1;
        await waitIdle(page);
        if (mid) await mid(i);
      }
    } catch (e) {
      if (!(e instanceof TapFault)) throw e;
      r.fault = { kind: e.kind, step: e.step, detail: e.detail };
      r.faultShot = await shot(`L${level.number}-fault-step-${e.step}`);
      log(`L${level.number}: TAP FAULT at step ${e.step} (${e.kind}): ${e.detail}`);
      const made = await page.evaluate(() => (window as any).__riddle.getState().moves.length);
      for (let i = made; i < moves.length; i++) {
        await waitIdle(page);
        await page.evaluate((m) => (window as any).__riddle.getState().play(m), moves[i]);
        await page.waitForFunction((k) => (window as any).__riddle.getState().moves.length >= k, i + 1, { timeout: 45_000 });
      }
      r.finishedByHook = true;
    }
  };

  const win = async (level: LevelCase, r: Record<string, any>) => {
    await page.getByRole('heading', { name: 'Solved!' }).waitFor({ state: 'visible', timeout: 120_000 });
    await sleep(2500);
    r.winShot = await shot(`L${level.number}-win-card`);
    r.winText = (await screen()).texts;
  };

  // 1. First launch, as the reviewer sees it.
  await waitMap();
  await sleep(2000);
  await step('first-launch', async () => {
    const s = await screen();
    return { shot: await shot('map-at-first-launch'), screen: s, stored: await appium.exec('() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))') };
  });

  if (Number(args.fps) > 0) {
    // TEST ONLY: at most N frames a second (page-hooks.ts), so a Mac with no graphics chip keeps up.
    await appium.exec(`(n) => { localStorage.setItem('app-test:fps', String(n)); setTimeout(() => location.reload(), 50); return true; }`, Number(args.fps));
    await sleep(4000);
    await appium.toWebview();
    await waitMap();
    log(`frames capped at ${args.fps} a second by the test`);
  }

  // 2. Gestures a browser would answer, on the level map, by real touches.
  await step('browser-gestures-map', async () => {
    const sz = appium.size();
    const title = await page.getByText(/Riddle Games|Riddlebrook/).first().boundingBox();
    const at = title ? { x: title.x + title.width / 2, y: title.y + title.height / 2 } : { x: sz.width / 2, y: 40 };
    const dev = (p: Point) => (appium.transform ? appium.transform.toDevice(p) : p);
    const found: Record<string, unknown> = {};
    // Long press on the title text: a browser selects the word and shows a menu or magnifier.
    let p = dev(at);
    await d.execute('mobile: touchAndHold', { x: Math.round(p.x), y: Math.round(p.y), duration: 1.5 });
    await sleep(800);
    found.longPressTitle = { shot: await shot('after-long-press-on-title'), ...(await screen()) };
    await appium.tap(sz.width - 5, sz.height / 2).catch(() => undefined);
    await sleep(500);
    // Long press on a level card: a link would offer a preview or a menu.
    const card = await page.getByRole('button', { name: /^Level 2: / }).boundingBox();
    if (card) {
      p = dev({ x: card.x + card.width / 2, y: card.y + card.height / 2 });
      await d.execute('mobile: touchAndHold', { x: Math.round(p.x), y: Math.round(p.y), duration: 1.5 });
      await sleep(800);
      found.longPressLockedCard = { shot: await shot('after-long-press-on-card'), ...(await screen()) };
    }
    // Double tap and pinch: a web page zooms.
    p = dev({ x: sz.width / 2, y: sz.height / 2 });
    await d.execute('mobile: doubleTap', { x: Math.round(p.x), y: Math.round(p.y) });
    await sleep(1200);
    found.doubleTap = await screen();
    await d.execute('mobile: pinch', { scale: 2.5, velocity: 2 }).catch((e: unknown) => { found.pinchError = String(e).slice(0, 300); });
    await sleep(1500);
    found.pinchOpen = { shot: await shot('after-pinch-open'), ...(await screen()) };
    // An edge swipe from the left: a browser goes back.
    const a = dev({ x: 2, y: sz.height / 2 });
    const b = dev({ x: sz.width * 0.6, y: sz.height / 2 });
    await d.execute('mobile: dragFromToForDuration', { duration: 0.2, fromX: a.x, fromY: a.y, toX: b.x, toY: b.y });
    await sleep(1200);
    found.edgeSwipe = await screen();
    // Pull down from the top: a web page bounces and shows what lies behind it.
    const c1 = dev({ x: sz.width / 2, y: 60 });
    const c2 = dev({ x: sz.width / 2, y: sz.height - 20 });
    await d.execute('mobile: dragFromToForDuration', { duration: 0.3, fromX: c1.x, fromY: c1.y, toX: c2.x, toY: c2.y });
    await sleep(300);
    found.pullDown = { shot: await shot('right-after-pull-down'), ...(await screen()) };
    await sleep(1500);
    found.after = await screen();
    found.stillOnMap = await page.evaluate(() => !!document.querySelector('button[aria-label^="Level 1:"]'));
    return found;
  });

  if (args['sd-first']) {
    await step('sd-first', async () => {
      await page.getByRole('button', { name: 'About and settings' }).tap();
      await page.getByRole('switch', { name: 'HD graphics' }).waitFor({ state: 'visible', timeout: 30_000 });
      await sleep(1000);
      const hd = await page.evaluate(() => document.querySelector('[role=switch][aria-label="HD graphics"]')!.getAttribute('aria-checked'));
      if (hd === 'true') await page.locator('[role=switch][aria-label="HD graphics"]').tap();
      await sleep(1000);
      await page.getByRole('button', { name: 'Back to levels' }).tap();
      await waitMap();
      return { hdWas: hd };
    });
  }

  // 3. The note's path: levels 1 to 5 in order, by taps, as a reviewer plays.
  for (const num of [1, 2, 3, 4, 5]) {
    await step(`level-${num}`, async () => {
      const r: Record<string, any> = {};
      const via = num === 1 ? 'card' : 'next';
      const o = await openLevel(num, via);
      Object.assign(r, { openSeconds: o.openSeconds, rules: o.rules, rulesText: o.rulesText, openedBy: via });
      if (num === 1) {
        r.guideShown = await page.evaluate(() => !!document.querySelector('[data-testid="first-play-guide"]'));
        r.guideShot = await shot('L1-first-play-guide');
        // A loss first, as a reviewer may well make: then Undo, as the card offers.
        const rules = await levelRules(o.level.dir);
        const loss = lossPath(rules) ?? [];
        r.lossMoves = loss.length;
        await playMoves(o.level, loss, r);
        await page.getByRole('heading', { name: 'Oh no!' }).waitFor({ state: 'visible', timeout: 120_000 });
        await sleep(2500);
        r.lossShot = await shot('L1-oh-no-card');
        r.lossText = (await screen()).texts;
        // Undo on the card itself, as the note says, then Restart in the bar to start clean.
        await page.locator('[aria-label="Oh no!"]').getByRole('button', { name: 'Undo' }).tap();
        await page.getByRole('heading', { name: 'Oh no!' }).waitFor({ state: 'hidden', timeout: 60_000 });
        await waitIdle(page);
        await sleep(1500);
        r.afterUndoShot = await shot('L1-after-undo');
        r.movesAfterUndo = await page.evaluate(() => (window as any).__riddle.getState().moves.length);
        await page.getByRole('button', { name: 'Restart' }).tap();
        await page.waitForFunction(() => (window as any).__riddle.getState().moves.length === 0, undefined, { timeout: 30_000 });
        await waitIdle(page);
        await waitCameraStill(page);
        r.afterLossShot = await shot('L1-after-restart');
      }
      if (num === 4) {
        // Hint, as the note tells a reviewer to use.
        await page.getByRole('button', { name: 'Hint' }).tap();
        await sleep(2500);
        r.hintShot = await shot('L4-hint');
        r.hintText = (await screen()).texts;
      }
      await playMoves(o.level, o.level.moves, r, async (i) => { if (i === 2) r.inPlayShot = await shot(`L${num}-in-play`); });
      await win(o.level, r);
      return r;
    });
  }
  await step('back-to-map', async () => {
    await page.getByRole('button', { name: 'All levels', exact: true }).tap();
    await waitMap();
    await sleep(1500);
    return { shot: await shot('map-after-five'), screen: await screen() };
  });

  // 4. About and settings, every page, by touches.
  await step('about', async () => {
    const r: Record<string, any> = {};
    await page.getByRole('button', { name: 'About and settings' }).tap();
    await page.getByRole('switch', { name: 'Sound' }).waitFor({ state: 'visible', timeout: 30_000 });
    await sleep(1200);
    for (const tab of ['Settings', 'Privacy', 'Contact', 'Credits']) {
      const t = page.getByRole('tab', { name: tab });
      if (await t.count()) await t.tap(); else await page.getByRole('button', { name: tab, exact: true }).tap();
      await sleep(1500);
      r[tab] = { shot: await shot(`about-${tab.toLowerCase()}`), screen: await screen() };
      if (tab === 'Privacy' || tab === 'Credits') {
        // Swipe up to the end, as a reader would.
        const sz = appium.size();
        const dev = (p: Point) => (appium.transform ? appium.transform.toDevice(p) : p);
        for (let k = 0; k < 12; k++) {
          const a = dev({ x: sz.width * 0.65, y: sz.height * 0.8 });
          const b = dev({ x: sz.width * 0.65, y: sz.height * 0.2 });
          await d.execute('mobile: dragFromToForDuration', { duration: 0.15, fromX: a.x, fromY: a.y, toX: b.x, toY: b.y });
          await sleep(300);
        }
        await sleep(1200);
        r[`${tab}-end`] = { shot: await shot(`about-${tab.toLowerCase()}-end`), screen: await screen() };
      }
    }
    const s = page.getByRole('tab', { name: 'Settings' });
    if (await s.count()) await s.tap(); else await page.getByRole('button', { name: 'Settings', exact: true }).tap();
    await sleep(1000);
    await page.getByRole('button', { name: 'Reset progress' }).tap();
    await page.getByRole('button', { name: 'Keep my stars' }).waitFor({ state: 'visible', timeout: 20_000 });
    await sleep(1200);
    r.resetAsk = { shot: await shot('about-reset-ask'), screen: await screen() };
    await page.getByRole('button', { name: 'Keep my stars' }).tap();
    await page.getByRole('button', { name: 'Keep my stars' }).waitFor({ state: 'hidden', timeout: 20_000 });
    r.starsKept = (await screen()).texts.find((t) => /star/i.test(t)) ?? null;
    await page.getByRole('button', { name: 'Back to levels' }).tap();
    await waitMap();
    return r;
  });

  // 5. The device turned upright, and back.
  await step('turned-upright', async () => {
    const before = appium.size();
    await appium.setOrientation('PORTRAIT');
    await sleep(2500);
    const r = { before, upright: appium.size(), shot: await shot('held-upright'), screen: await screen() };
    await appium.setOrientation('LANDSCAPE');
    await sleep(2500);
    log(`calibration again: ${await appium.calibrate()}`);
    return { ...r, back: appium.size(), shotBack: await shot('turned-back') };
  });

  // 6. Harder levels. SHORTCUT, TEST ONLY: the run writes 3 stars for levels 1 to 29 into the game's own
  // saved progress, as a reviewer would have after solving them, then starts the page again.
  await step('open-hard-levels', async () => {
    await appium.exec(`(ids) => { const k = 'riddle-games:progress:v1'; const p = JSON.parse(localStorage.getItem(k) || '{"stars":{}}'); for (const id of ids) p.stars[id] = Math.max(p.stars[id] || 0, 3); localStorage.setItem(k, JSON.stringify(p)); setTimeout(() => location.reload(), 50); return true; }`, LEVELS.filter((l) => l.number <= 29).map((l) => l.id));
    await sleep(4000);
    await appium.toWebview();
    await waitMap();
    await sleep(1500);
    return { shot: await shot('map-with-29-solved'), screen: await screen() };
  });
  for (const num of HARD) {
    await step(`level-${num}`, async () => {
      const r: Record<string, any> = {};
      const o = await openLevel(num, 'card');
      Object.assign(r, { openSeconds: o.openSeconds, rules: o.rules, rulesText: o.rulesText });
      await playMoves(o.level, o.level.moves, r, async (i) => {
        if (i === 2) {
          r.inPlayShot = await shot(`L${num}-in-play`);
          if (num === HARD[0]) {
            // Home, a few seconds away, and back, in the middle of a level.
            const movesBefore = await page.evaluate(() => (window as any).__riddle.getState().moves.length);
            await appium.background(6);
            await sleep(2500);
            await appium.toWebview();
            r.backFromBackground = { movesBefore, movesAfter: await page.evaluate(() => (window as any).__riddle.getState().moves.length), shot: await shot(`L${num}-back-from-background`), screen: await screen() };
            await waitIdle(page);
          }
        }
      });
      await win(o.level, r);
      await page.getByRole('button', { name: 'All levels', exact: true }).tap();
      await waitMap();
      return r;
    });
  }
  await step('end', async () => ({ shot: await shot('map-at-end'), screen: await screen(), execMsAvg: Math.round(appium.execTimes.reduce((a, b) => a + b, 0) / Math.max(1, appium.execTimes.length)) }));
  result.endedAt = new Date().toISOString();
  save();
  await sleep(4000);
  await appium.end();
}

main().catch((e) => {
  log(`stopped: ${e?.stack ?? e}`);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 5000);
});
