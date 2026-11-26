/**
 * TEST ONLY (branch quit-relaunch-mac-test, never for main). Does what the game keeps for a player
 * (stars, opened levels, the first-play guide's flag, sound and graphics) outlive a full quit of the
 * built app? One call of this script is one life of the app; the shell around it (ios-quit.sh) ends
 * the app, or shuts the simulated device down and boots it, between calls.
 *
 *   tsx e2e/app/quit.ts --backend appium --phase play --device iphone --out out/iphone --caps '{...}'
 *   tsx e2e/app/quit.ts --backend chromium --profile /tmp/p --size 956x440 --phase play --out out/local
 *
 * Phases:
 *   play        fresh install: reads what is stored, wins levels 1 and 2 by real touches, switches
 *               both settings away from their defaults by touches in About, and writes down what it sees
 *   check       reads what the newly started app shows and has stored, against --expect <file>
 *   quick       switches HD once more by a touch and ends the app at once (how soon is a save safe?)
 *   reset       About > Reset progress > Erase stars, by touches
 * Every phase writes <out>/<name>.json and pictures.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { LEVELS, type LevelCase } from '../levels';
import { PLAYERS } from '../taps/players';
import { TapFault, Taps, type Point, type TapRecord } from '../taps/harness';
import { AppiumBackend, serve } from './backends';
import { FakePage, sleep, type Backend } from './fake-page';

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
);
const device = args.device ?? 'device';
const phase = args.phase ?? 'check';
const name = args.name ?? phase;
const out = resolve(args.out ?? `out/${device}`);
const shots = join(out, 'shots');
mkdirSync(shots, { recursive: true });
(globalThis as any).__outDir = out;
const bundleId = args['bundle-id'] ?? '';
const udid = args.udid ?? '';

const t0 = Date.now();
function log(s: string) {
  const line = `${new Date().toISOString().slice(11, 19)} [${name}] ${s}`;
  console.log(line);
  appendFileSync(join(out, 'run-log.txt'), line + '\n');
}

const wrap = (src: string) =>
  `var __name = function (f) { return f; }; try { var v = (${src})(arguments[0]); return { ok: true, v: v === undefined ? null : v }; } catch (e) { return { ok: false, e: String(e && e.message ? e.name + ': ' + e.message + ' | ' + e.stack : e) }; }`;

/** Chromium on one kept profile folder: closing it and opening it again stands in for a quit and a relaunch. */
class ProfileBackend implements Backend {
  page: any;
  ctx: any;
  constructor(readonly url: string, readonly profile: string, readonly vp: { width: number; height: number }) {}
  async start() {
    const { chromium } = await import('playwright-core');
    this.ctx = await chromium.launchPersistentContext(this.profile, { executablePath: process.env.CHROMIUM_PATH || undefined, viewport: this.vp, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    this.page = this.ctx.pages()[0] ?? (await this.ctx.newPage());
    await this.page.goto(this.url);
  }
  size() { return this.vp; }
  async exec<T>(src: string, arg?: unknown): Promise<T> {
    const r = await this.page.evaluate(([s, a]: [string, unknown]) => new Function(s).call(null, a), [wrap(src), arg ?? null]);
    if (!r.ok) throw new Error(`in the page: ${r.e}`);
    return r.v as T;
  }
  async tap(x: number, y: number) { await this.page.touchscreen.tap(x, y); }
  async drag() { throw new Error('no drags in this run'); }
  async screenshot(file: string) { await this.page.screenshot({ path: file }); }
  async end() { await this.ctx?.close(); }
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

/** Everything the page has stored, and what the screen says, read only. */
const READ = () => {
  const storage: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    storage[k] = localStorage.getItem(k);
  }
  const cards = Array.from(document.querySelectorAll('button[aria-label^="Level "]')).slice(0, 4).map((b) => b.getAttribute('aria-label'));
  const header = Array.from(document.querySelectorAll('span')).map((s) => s.textContent?.trim()).find((t) => /^\d+ \/ \d+$/.test(t ?? '')) ?? null;
  const sw = (label: string) => document.querySelector(`[role=switch][aria-label="${label}"]`)?.getAttribute('aria-checked') ?? null;
  return {
    href: location.href,
    storage,
    sessionKeys: sessionStorage.length,
    cookie: document.cookie,
    mapHeader: header,
    firstCards: cards,
    mapSoundButtonPressed: document.querySelector('button[aria-label="Sound"]')?.getAttribute('aria-pressed') ?? null,
    aboutSwitches: document.querySelector('[role=switch]') ? { sound: sw('Sound'), hd: sw('HD graphics') } : null,
    progressLine: document.querySelector('[data-testid="progress-line"]')?.textContent?.trim() ?? null,
    screen: [innerWidth, innerHeight],
    fpsCap: (window as any).__appFpsCap ?? 0,
    at: new Date().toISOString(),
  };
};
type Seen = ReturnType<typeof READ>;

async function main() {
  log(`phase ${phase} on ${device}`);
  let backend: Backend;
  let end: () => Promise<void>;
  let appium: AppiumBackend | null = null;
  if (args.backend === 'chromium') {
    const [w, h] = (args.size ?? '956x440').split('x').map(Number);
    const srv = await serve(resolve(args.dist ?? join(import.meta.dirname, '..', '..', 'apps', 'web', 'dist-app')), Number(args.port ?? 0));
    const b = new ProfileBackend(srv.url, resolve(args.profile ?? join(out, 'profile')), { width: w, height: h });
    await b.start();
    backend = b;
    end = async () => { await b.end(); srv.close(); };
  } else {
    const caps = JSON.parse(args.caps ?? '{}');
    appium = new AppiumBackend(caps, log);
    const s0 = Date.now();
    await appium.start();
    log(`web view found ${((Date.now() - s0) / 1000).toFixed(0)} s after the session was asked for: ${appium.size().width} by ${appium.size().height}`);
    if (args.orientation && args.orientation !== '-') {
      await appium.setOrientation(args.orientation as 'PORTRAIT' | 'LANDSCAPE');
      log(`turned ${args.orientation}: ${appium.size().width} by ${appium.size().height}`);
    }
    log(`calibration: ${await appium.calibrate()}`);
    backend = appium;
    end = () => appium!.end();
  }
  const page = new FakePage(backend);
  let n = 0;
  const shot = async (what: string) => {
    const file = `${device}-${name}-${String(++n).padStart(2, '0')}-${what}.png`;
    try { await backend.screenshot(join(shots, file)); } catch (e) { log(`picture ${what} failed: ${e}`); return ''; }
    return file;
  };
  const waitMap = (timeout = 180_000) => page.waitForFunction(() => !!document.querySelector('[aria-label="About and settings"]') && !!document.querySelector('button[aria-label^="Level 1:"]'), undefined, { timeout });
  const read = () => backend.exec<Seen>(READ.toString());
  const openAbout = async () => {
    await page.getByRole('button', { name: 'About and settings' }).tap();
    await page.getByRole('switch', { name: 'Sound' }).waitFor({ state: 'visible', timeout: 30_000 });
    await sleep(1200);
  };
  const backToMap = async () => {
    await page.getByRole('button', { name: 'Back to levels' }).tap();
    await waitMap();
    await sleep(1200);
  };
  /** One touch on a switch, and the wait until the page shows it changed. */
  const flip = async (label: 'Sound' | 'HD graphics') => {
    const sw = `[role=switch][aria-label="${label}"]`;
    const before = await page.evaluate((s) => document.querySelector(s)!.getAttribute('aria-checked'), sw);
    await page.locator(sw).tap();
    await page.waitForFunction(([s, b]) => document.querySelector(s)!.getAttribute('aria-checked') !== b, [sw, before] as const, { timeout: 20_000 });
    const after = await page.evaluate((s) => document.querySelector(s)!.getAttribute('aria-checked'), sw);
    log(`${label}: ${before} -> ${after}, by a touch`);
    return { label, before, after, at: Date.now() };
  };

  const result: Record<string, unknown> = { phase, name, device, startedAt: new Date(t0).toISOString() };
  const save = () => writeFileSync(join(out, `${name}.json`), JSON.stringify(result, null, 1));

  await waitMap();
  await sleep(1500);
  const atLaunch = await read();
  result.atLaunch = atLaunch;
  log(`at launch: header ${atLaunch.mapHeader}; stored ${JSON.stringify(atLaunch.storage)}; cards ${JSON.stringify(atLaunch.firstCards)}`);
  save();

  if (phase === 'play') {
    result.launchMapShot = await shot('map-at-first-launch');
    if (Number(args.fps) > 0) {
      // TEST ONLY: at most N frames a second (page-hooks.ts), so a Mac with no graphics chip keeps up. It is the test's own key.
      await backend.exec(`(n) => { localStorage.setItem('app-test:fps', String(n)); setTimeout(() => location.reload(), 50); return true; }`, Number(args.fps));
      await sleep(4000);
      if (appium) await appium.toWebview();
      await waitMap();
      log(`frames capped at ${args.fps} a second by the test (page says ${await backend.exec('() => window.__appFpsCap || 0')})`);
    }
    const flips: unknown[] = [];
    const settings = async () => {
      await openAbout();
      result.aboutBefore = await read();
      await shot('about-before-switching');
      flips.push(await flip('Sound'));
      await sleep(600);
      flips.push(await flip('HD graphics'));
      await sleep(1500);
      result.flips = flips;
      result.aboutAfter = await read();
      result.aboutShot = await shot('about-after-switching');
      await backToMap();
    };
    // Where HD is the default (the iPad), both switches are turned first: HD is too slow to play on a Mac with no graphics chip.
    if (args['settings-first']) await settings();

    const levels: unknown[] = [];
    for (const level of LEVELS.filter((l) => l.number <= 2)) {
      const r: Record<string, unknown> = { level: level.number, id: level.id, movesNeeded: level.moves.length, movesByTaps: 0, finishedByHook: false };
      levels.push(r);
      result.levels = levels;
      const taps = new AppTaps(page, level);
      if (level.number === 1) {
        await page.getByRole('button', { name: /^Level 1: / }).tap();
        r.openedBy = 'its card on the level map';
      } else {
        await page.getByRole('button', { name: 'Next level' }).tap();
        r.openedBy = '"Next level" on the win card';
      }
      const go = page.getByRole('button', { name: "Let's go!" });
      await go.waitFor({ state: 'visible', timeout: 600_000 });
      await page.waitForFunction((id) => !!(window as any).__taps?.ready() && (window as any).__riddle?.getState().level.id === id, level.id, { timeout: 600_000 });
      await sleep(1500);
      await shot(`L${level.number}-rules-card`);
      let closed = false;
      for (let k = 1; k <= 3 && !closed; k++) {
        await go.tap();
        try { await go.waitFor({ state: 'hidden', timeout: 60_000 }); closed = true; r.rulesCardTouches = k; } catch { log(`L${level.number}: rules card still up after touch ${k}`); }
      }
      if (!closed) throw new Error('the rules card did not close');
      await waitCameraStill(page);
      await waitIdle(page);
      if (level.number === 1) r.guideShown = await page.evaluate(() => !!document.querySelector('[data-testid="first-play-guide"]'));
      const player = PLAYERS[level.id];
      let fault: TapFault | null = null;
      try {
        await player.setup?.(taps);
        for (const [i, move] of level.moves.entries()) {
          taps.step = i + 1;
          const before = await taps.snapshot();
          await player.move(taps, move, before.state, i);
          try {
            await page.waitForFunction((k) => (window as any).__riddle.getState().moves.length >= k, i + 1, { timeout: 45_000 });
          } catch {
            throw new TapFault('no-move', i + 1, `no move followed the touches for ${JSON.stringify(move)}. Last touch: ${taps.lastTouch()}`);
          }
          r.movesByTaps = i + 1;
          if (i === 2) await shot(`L${level.number}-in-play`);
          await waitIdle(page);
        }
      } catch (e) {
        if (!(e instanceof TapFault)) throw e;
        fault = e;
      }
      if (fault) {
        r.fault = { kind: fault.kind, step: fault.step, detail: fault.detail };
        log(`L${level.number}: tap fault at step ${fault.step} (${fault.kind}): ${fault.detail}`);
        await shot(`L${level.number}-fault-step-${fault.step}`);
        // The rest through the game's debug hook, from where the taps left it; the report says so.
        const made = await page.evaluate((plan) => {
          const s = (window as any).__riddle.getState();
          const m = s.moves.map((x: unknown) => JSON.stringify(x));
          return m.every((x: string, i: number) => x === JSON.stringify(plan[i])) ? m.length : -1;
        }, level.moves);
        let from = made;
        if (from < 0) { await waitIdle(page); await page.evaluate(() => (window as any).__riddle.getState().restart()); from = 0; }
        for (let i = from; i < level.moves.length; i++) {
          await waitIdle(page);
          await page.evaluate((m) => (window as any).__riddle.getState().play(m), level.moves[i]);
          await page.waitForFunction((k) => (window as any).__riddle.getState().moves.length >= k, i + 1, { timeout: 45_000 });
        }
        r.finishedByHook = true;
      }
      await page.getByRole('heading', { name: 'Solved!' }).waitFor({ state: 'visible', timeout: 120_000 });
      r.wonAt = new Date().toISOString();
      await sleep(2500);
      r.winShot = await shot(`L${level.number}-win-card`);
      r.storedAtWin = (await read()).storage;
      r.buttons = await page.evaluate(() => Array.from(document.querySelectorAll('[role=dialog] button, [aria-label="Solved!"] button')).map((b) => b.textContent?.trim()));
      log(`L${level.number}: won; ${r.movesByTaps} of ${level.moves.length} moves by taps${r.finishedByHook ? ', the rest by the debug hook' : ''}; stored ${JSON.stringify(r.storedAtWin)}`);
      save();
    }
    await page.getByRole('button', { name: 'All levels', exact: true }).tap();
    await waitMap();
    await sleep(2000);
    if (!args['settings-first']) await settings();
    result.mapShot = await shot('map-after-play');
    result.map = await read();
    await openAbout();
    result.about = await read();
    result.aboutEndShot = await shot('about-after-play');
    await backToMap();
  }

  if (phase === 'check' || phase === 'quick' || phase === 'reset') {
    result.mapShot = await shot('map');
    result.map = atLaunch;
    await openAbout();
    result.about = await read();
    result.aboutShot = await shot('about');
    if (phase === 'check') {
      // A locked level must stay shut, and an opened one must open: one touch on each, on the map.
      await backToMap();
      if (args.locked) {
        const card = page.getByRole('button', { name: new RegExp(`^Level ${args.locked}: `) });
        const b = await card.boundingBox();
        const sz = backend.size();
        if (!b || b.x < 0 || b.y < 0 || b.x + b.width > sz.width || b.y + b.height > sz.height) {
          await page.evaluate((spec) => (window as any).__appScrollTo(spec, 0), { steps: (card as any).steps });
          await sleep(1000);
          result.lockedCardScrolledIntoViewByTheRun = true;
        }
        result.lockedCardName = await page.evaluate((k) => document.querySelector(`button[aria-label^="Level ${k}: "]`)?.getAttribute('aria-label') ?? null, args.locked);
        await card.tap();
        await sleep(2500);
        result.lockedLevelStaysShut = await page.evaluate(() => !/#\/level\//.test(location.hash));
        log(`a touch on level ${args.locked}: ${result.lockedLevelStaysShut ? 'stays shut' : 'OPENED'}`);
      }
    }
    if (phase === 'reset') {
      await page.getByRole('button', { name: 'Reset progress' }).tap();
      await page.getByRole('button', { name: 'Erase stars' }).waitFor({ state: 'visible', timeout: 20_000 });
      await sleep(1200);
      result.confirmText = await page.evaluate(() => document.querySelector('[role=alertdialog]')?.textContent?.trim() ?? null);
      result.confirmShot = await shot('reset-confirm');
      await page.getByRole('button', { name: 'Erase stars' }).tap();
      await page.getByRole('button', { name: 'Erase stars' }).waitFor({ state: 'hidden', timeout: 20_000 });
      result.erasedAt = new Date().toISOString();
      await sleep(1500);
      result.aboutAfterReset = await read();
      result.aboutAfterResetShot = await shot('about-after-reset');
      await backToMap();
      result.mapAfterReset = await read();
      result.mapAfterResetShot = await shot('map-after-reset');
      log(`after reset: header ${(result.mapAfterReset as Seen).mapHeader}; stored ${JSON.stringify((result.mapAfterReset as Seen).storage)}`);
    }
    if (phase === 'quick') {
      // The last thing this life of the app does is one save; the app is ended as soon as the page shows the change.
      const f = await flip('HD graphics');
      const seenAt = Date.now();
      if (appium && udid) {
        execFileSync('xcrun', ['simctl', 'terminate', udid, bundleId], { stdio: 'ignore' });
        result.quick = { ...f, endedMsAfterTheChangeWasSeen: Date.now() - seenAt, endedBy: 'simctl terminate, straight after the page showed the change' };
      } else {
        result.quick = { ...f, endedMsAfterTheChangeWasSeen: null, endedBy: 'the browser is closed by the script right after' };
      }
      log(`quick end: ${JSON.stringify(result.quick)}`);
      save();
      if (appium) { await Promise.race([end().catch(() => undefined), sleep(20_000)]); return; }
    }
  }

  if (args.expect) {
    // What must be the same as before the quit: the stored entries, the star count, the first cards and both switches.
    const was = JSON.parse(readFileSync(resolve(out, args.expect), 'utf8'));
    const wasMap: Seen = was.mapAfterReset ?? was.map;
    const wasAbout: Seen = was.aboutAfterReset ?? was.about;
    const nowMap = result.map as Seen;
    const nowAbout = result.about as Seen;
    const same = {
      storedEntries: JSON.stringify(wasAbout.storage) === JSON.stringify(nowMap.storage),
      starCount: wasMap.mapHeader === nowMap.mapHeader,
      firstCards: JSON.stringify(wasMap.firstCards) === JSON.stringify(nowMap.firstCards),
      soundSwitch: wasAbout.aboutSwitches?.sound === nowAbout.aboutSwitches?.sound,
      hdSwitch: wasAbout.aboutSwitches?.hd === nowAbout.aboutSwitches?.hd,
      progressLine: (args['expect-progress-line'] ?? wasAbout.progressLine) === nowAbout.progressLine,
    };
    result.comparedWith = args.expect;
    result.same = same;
    result.allSame = Object.values(same).every(Boolean);
    log(`against ${args.expect}: ${JSON.stringify(same)} => ${result.allSame ? 'ALL KEPT' : 'SOMETHING CHANGED'}`);
    if (!result.allSame) log(`was ${JSON.stringify({ map: wasMap, about: wasAbout })}\nnow ${JSON.stringify({ map: nowMap, about: nowAbout })}`);
  }
  result.faults = await page.evaluate(() => ({ ...(window as any).__appFaults })).catch(() => null);
  result.endedAt = new Date().toISOString();
  save();
  // Let the page's last save settle before the shell ends the app (the quick phase is the one that does not wait).
  await sleep(Number(args['settle-seconds'] ?? 8) * 1000);
  await end();
}

main().catch((e) => {
  log(`stopped: ${e?.stack ?? e}`);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 5000);
});
