/**
 * TEST ONLY. Plays every level inside the built app, by real touches placed where the scene draws
 * each thing at that moment (the real-tap players of e2e/taps). Where a level has a known tap fault
 * (e2e/taps/known-tap-faults.ts), or a new one turns up, the rest of the level is played through the
 * game's debug hook, and the report says so.
 *
 *   tsx e2e/app/run.ts --backend appium --device iphone-large --levels 1-30 --out out/iphone-large
 *   tsx e2e/app/run.ts --backend chromium --device local-852 --size 852x393 --levels 1-3 --out out/local
 */
import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LEVELS, type LevelCase } from '../levels';
import { KNOWN_TAP_FAULTS } from '../taps/known-tap-faults';
import { PLAYERS, BROKEN_PLAYERS } from '../taps/players';
import { TapFault, Taps, READ_SCENE, type Point, type TapRecord } from '../taps/harness';
import { AppiumBackend, ChromiumBackend, serve } from './backends';
import { FakePage, sleep, type Backend } from './fake-page';
import { extras } from './extras';

void READ_SCENE;
const PROGRESS_KEY = 'riddle-games:progress:v1';

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
);
const device = args.device ?? 'device';
const out = resolve(args.out ?? `out/${device}`);
const shots = join(out, 'shots');
mkdirSync(shots, { recursive: true });
(globalThis as any).__outDir = out;
const [lo, hi] = (args.levels ?? '1-30').split('-').map(Number);
const LEVEL_BUDGET_MS = Number(args['level-minutes'] ?? 25) * 60_000;
const bundleId = args['bundle-id'] ?? 'com.example.riddlegames';

const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}s`;
export function log(s: string) {
  const line = `${stamp()} ${s}`;
  console.log(line);
  appendFileSync(join(out, 'run-log.txt'), line + '\n');
}

/** The real-tap harness, with its one Chromium-only part (drags by CDP) sent to the backend instead. */
class AppTaps extends Taps {
  constructor(
    readonly fake: FakePage,
    level: LevelCase,
  ) {
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

interface LevelResult {
  level: number;
  id: string;
  title: string;
  device: string;
  size: string;
  quality: string | null;
  openedBy: string;
  /** "won by taps", "won, finished by the debug hook after a known tap fault", ... */
  state: string;
  wonByTaps: boolean;
  won: boolean;
  finishedByHook: boolean;
  movesByTaps: number;
  moves: number;
  touches: number;
  stars: number | null;
  savedStars: number | null;
  fault: null | { kind: string; step: number; detail: string; known: boolean; knownReason?: string };
  error: string | null;
  seconds: { open: number | null; rulesCard: number | null; drawn: number | null; play: number | null; total: number };
  pageErrors: string[];
  consoleErrors: string[];
  outsideRequests: string[];
  shots: string[];
  log: TapRecord[];
}

const nn = (n: number) => String(n).padStart(2, '0');

async function backendFor(): Promise<{ backend: Backend; reload(): Promise<void>; relaunch(): Promise<void>; end(): Promise<void>; calibration: string }> {
  if (args.backend === 'chromium') {
    const [w, h] = (args.size ?? '852x393').split('x').map(Number);
    const srv = await serve(resolve(args.dist ?? join(import.meta.dirname, '..', '..', 'apps', 'web', 'dist-app')));
    const b = new ChromiumBackend(srv.url, { width: w, height: h });
    await b.start();
    return {
      backend: b,
      reload: async () => {
        await b.page.goto(srv.url);
      },
      relaunch: async () => {
        await b.page.goto(srv.url);
      },
      end: async () => {
        await b.end();
        srv.close();
      },
      calibration: 'Chromium: page points are touch points',
    };
  }
  const caps = JSON.parse(args.caps ?? '{}');
  const b = new AppiumBackend(caps, log);
  log(`starting the Appium session: ${JSON.stringify(caps)}`);
  await b.start();
  log(`web view found: ${b.webview}, ${b.size().width} by ${b.size().height}`);
  if (args.orientation) {
    await b.setOrientation(args.orientation as 'PORTRAIT' | 'LANDSCAPE');
    log(`turned ${args.orientation}: ${b.size().width} by ${b.size().height}`);
  }
  const calibration = await b.calibrate();
  log(`calibration: ${calibration}`);
  return {
    backend: b,
    reload: async () => {
      await b.exec('() => { setTimeout(() => location.reload(), 50); return true; }');
      await sleep(4000);
      await b.toWebview();
    },
    relaunch: async () => {
      await b.terminate(bundleId).catch((e) => log(`terminate: ${e}`));
      await sleep(2000);
      await b.activate(bundleId);
      await sleep(5000);
      await b.toWebview();
    },
    end: () => b.end(),
    calibration,
  };
}

async function main() {
  const levels = LEVELS.filter((l) => l.number >= lo && l.number <= hi);
  log(`device ${device}; levels ${lo}-${hi} (${levels.length}); players missing: ${LEVELS.filter((l) => !PLAYERS[l.id]).map((l) => l.id).join(', ') || 'none'}; broken players: ${BROKEN_PLAYERS.length}`);
  const run = await backendFor();
  const { backend } = run;
  const page = new FakePage(backend);
  if (args.quality === 'low' || args.quality === 'high') {
    // The player's own HD/SD switch, set before play: a hosted Mac has no real graphics chip, and HD there crawls.
    await backend.exec(`(q) => { const k = 'riddle-games:settings:v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(k) || '{}'); } catch {} s.quality = q; localStorage.setItem(k, JSON.stringify(s)); return true; }`, args.quality);
    await run.reload();
    log(`graphics quality set to ${args.quality === 'low' ? 'SD' : 'HD'} by the player's setting`);
  }
  const size = backend.size();
  const results: LevelResult[] = [];
  writeFileSync(join(out, 'device.json'), JSON.stringify({ device, size, calibration: run.calibration, args }, null, 1));

  const shot = async (name: string) => {
    const file = `${device}-${name}.png`;
    try {
      await backend.screenshot(join(shots, file));
      return file;
    } catch (e) {
      log(`screenshot ${name} failed: ${e}`);
      return '';
    }
  };
  (globalThis as any).__shot = shot;

  // Waits for the level map (after a launch or a reload).
  const waitMap = async (timeout = 120_000) => {
    await page.waitForFunction(() => !!document.querySelector('[aria-label="About and settings"]'), undefined, { timeout });
  };

  /** Seeds stars for every level before `level`, then reloads, so the map has it open. */
  const seedAndReload = async (level: LevelCase) => {
    const stars = Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3]));
    await page.evaluate(
      ([key, s]) => {
        const now = JSON.parse(localStorage.getItem(key) ?? '{"stars":{}}');
        const merged = { ...now, stars: { ...s, ...(now.stars ?? {}) } };
        localStorage.setItem(key, JSON.stringify(merged));
        history.replaceState(null, '', location.pathname);
        return true;
      },
      [PROGRESS_KEY, stars] as const,
    );
    await run.reload();
    await waitMap();
  };

  let onWinCardOf = 0;

  const FRAMES = '() => { if (!window.__fc) { window.__fc = 1; const f = () => { window.__fc++; requestAnimationFrame(f); }; requestAnimationFrame(f); } return { c: window.__fc, t: performance.now() }; }';
  for (const level of levels) {
    if (args['relaunch-each'] && level.number !== lo) {
      // A fresh app for each level, so one level's slowness can't carry into the next.
      try {
        await run.relaunch();
        await waitMap();
        onWinCardOf = 0;
        log(`L${nn(level.number)}: fresh app`);
      } catch (e) {
        log(`fresh app failed: ${e}`);
      }
    }
    const started = Date.now();
    let f0: { c: number; t: number } | null = null;
    const r: LevelResult = {
      level: level.number, id: level.id, title: level.title, device, size: `${size.width}x${size.height}`, quality: null, openedBy: '', state: '', wonByTaps: false, won: false, finishedByHook: false,
      movesByTaps: 0, moves: level.moves.length, touches: 0, stars: null, savedStars: null, fault: null, error: null,
      seconds: { open: null, rulesCard: null, drawn: null, play: null, total: 0 }, pageErrors: [], consoleErrors: [], outsideRequests: [], shots: [], log: [],
    };
    const taps = new AppTaps(page, level);
    let budget: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        (async () => {
          // Open the level: by the win card's "Next level" when the last level was just won, else from the map.
          const next = page.getByRole('button', { name: 'Next level' });
          let openTap = Date.now();
          if (onWinCardOf === level.number - 1 && (await next.isVisible())) {
            openTap = Date.now();
            await next.tap();
            r.openedBy = '"Next level" on the win card';
          } else {
            await seedAndReload(level);
            const name = `Level ${level.number}: ${level.title}`;
            const card = page.getByRole('button', { name, exact: true });
            await card.waitFor({ state: 'attached', timeout: 30_000 });
            const box = await card.boundingBox();
            const inView = box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height;
            if (!inView) await page.evaluate((spec) => (window as any).__appScrollTo(spec, 0), { steps: (card as any).steps });
            await sleep(600);
            openTap = Date.now();
            await card.tap();
            r.openedBy = inView ? 'its card on the level map' : 'its card on the level map (scrolled into view by the run)';
          }
          log(`L${nn(level.number)} ${level.id}: opened by ${r.openedBy}`);
          f0 = await backend.exec<{ c: number; t: number }>(FRAMES).catch(() => null);
          // The loading mark, once, if it can be caught.
          let sawMark = false;
          const end = Date.now() + 180_000;
          for (;;) {
            const st = await page.evaluate(() => ({
              mark: !!Array.from(document.querySelectorAll('[role=status][aria-label="Loading level"]')).find((e) => e.getBoundingClientRect().width > 0),
              rules: !!Array.from(document.querySelectorAll('h1,h2,h3')).find((h) => /Let's go/.test(h.closest('div')?.parentElement?.textContent ?? '')),
              go: !!Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === "Let's go!" && b.getBoundingClientRect().width > 0),
              ready: !!(window as any).__taps?.ready(),
              session: (window as any).__riddle?.getState().level.id ?? null,
            }));
            if (st.mark && !sawMark) {
              sawMark = true;
              r.shots.push(await shot(`L${nn(level.number)}-loading-mark`));
            }
            if (st.go && r.seconds.rulesCard === null) r.seconds.rulesCard = (Date.now() - openTap) / 1000;
            if (st.ready && !st.mark && st.session === level.id && r.seconds.drawn === null) r.seconds.drawn = (Date.now() - openTap) / 1000;
            if (r.seconds.rulesCard !== null && r.seconds.drawn !== null) break;
            if (Date.now() > end) throw new Error(`the level did not open within 180 s (rules card ${r.seconds.rulesCard ?? 'never'}, scene ${r.seconds.drawn ?? 'never'}; loading mark seen: ${sawMark})`);
            await sleep(300);
          }
          r.seconds.open = Math.max(r.seconds.rulesCard ?? 0, r.seconds.drawn ?? 0);
          r.quality = await page.evaluate(() => document.querySelector('[aria-label="Graphics quality"]')?.textContent?.trim() ?? null);
          await sleep(1500);
          r.shots.push(await shot(`L${nn(level.number)}-rules-card`));
          // "Let's go!" by a real touch. If it lies off the screen, that is a finding, and the run scrolls it into view.
          const go = page.getByRole('button', { name: "Let's go!" });
          const gb = await go.boundingBox();
          if (gb && (gb.y + gb.height / 2 > size.height || gb.x + gb.width / 2 > size.width)) {
            r.error = `"Let's go!" lies off the screen (${Math.round(gb.x)}, ${Math.round(gb.y)}, ${Math.round(gb.width)} by ${Math.round(gb.height)}); scrolled into view by the run`;
            await page.evaluate((spec) => (window as any).__appScrollTo(spec, 0), { steps: (go as any).steps });
            await sleep(500);
          }
          await go.tap();
          await go.waitFor({ state: 'hidden', timeout: 30_000 });
          await page.waitForFunction(() => (window as any).__taps.ready(), undefined, { timeout: 60_000 });
          await waitCameraStill(page);
          await waitIdle(page);
          const playStart = Date.now();

          const player = PLAYERS[level.id];
          let fault: TapFault | null = null;
          try {
            if (!player) throw new TapFault('no-response', 1, 'no real-tap player for this level');
            await player.setup?.(taps);
            for (const [i, move] of level.moves.entries()) {
              taps.step = i + 1;
              const before = await taps.snapshot();
              if (before.moves.length !== i) throw new TapFault('wrong-move', i + 1, `${before.moves.length} moves made before step ${i + 1}`);
              await player.move(taps, move, before.state, i);
              try {
                await page.waitForFunction((n) => (window as any).__riddle.getState().moves.length >= n, i + 1, { timeout: 30_000 });
              } catch {
                throw new TapFault('no-move', i + 1, `no move followed the touches for ${JSON.stringify(move)}. Last touch: ${taps.lastTouch()}`);
              }
              const after = await page.evaluate(
                ([prev, want]) => {
                  const s = (window as any).__riddle.getState();
                  const ru = s.level.rules;
                  return { count: s.moves.length, played: s.moves[s.moves.length - 1], same: ru.key(s.history[s.history.length - 1]) === ru.key(ru.apply(prev, want)) };
                },
                [before.state, move] as const,
              );
              if (after.count !== i + 1 || !after.same) throw new TapFault('wrong-move', i + 1, `aimed at ${JSON.stringify(move)}, the game played ${JSON.stringify(after.played)}. Last touch: ${taps.lastTouch()}`);
              r.movesByTaps = i + 1;
              if (i === Math.floor(level.moves.length / 2)) r.shots.push(await shot(`L${nn(level.number)}-in-play`));
              await waitIdle(page);
            }
          } catch (e) {
            if (!(e instanceof TapFault)) throw e;
            fault = e;
          }
          if (fault) {
            const known = (KNOWN_TAP_FAULTS[level.id] ?? []).find((k) => k.steps.includes(fault!.step) && k.kind === fault!.kind);
            const anyKnown = (KNOWN_TAP_FAULTS[level.id] ?? [])[0];
            r.fault = { kind: fault.kind, step: fault.step, detail: fault.detail, known: !!known, knownReason: (known ?? anyKnown)?.reason };
            log(`L${nn(level.number)}: tap fault at step ${fault.step} (${fault.kind}, ${known ? 'known' : 'NEW'}): ${fault.detail}`);
            r.shots.push(await shot(`L${nn(level.number)}-fault-step-${fault.step}`));
            await finishByHook(page, level);
            r.finishedByHook = true;
          }
          await page.getByRole('heading', { name: 'Solved!' }).waitFor({ state: 'visible', timeout: 90_000 });
          r.seconds.play = (Date.now() - playStart) / 1000;
          await sleep(2500);
          r.shots.push(await shot(`L${nn(level.number)}-win-card`));
          const end2 = await page.evaluate((key) => {
            const s = (window as any).__riddle.getState();
            const label = Array.from(document.querySelectorAll('[aria-label$="of 3 stars"]')).map((e) => e.getAttribute('aria-label'));
            return { kind: s.status.kind, moves: s.moves.length, hints: s.hintsUsed, labels: label, saved: JSON.parse(localStorage.getItem(key) ?? '{"stars":{}}').stars };
          }, PROGRESS_KEY);
          r.won = end2.kind === 'won';
          r.wonByTaps = r.won && !r.finishedByHook && r.movesByTaps === level.moves.length;
          const shown = end2.labels.map((l: string) => Number(l?.split(' ')[0])).filter((n: number) => !Number.isNaN(n));
          r.stars = shown.length ? Math.max(...shown) : null;
          r.savedStars = end2.saved?.[level.id] ?? null;
          onWinCardOf = level.number;
        })(),
        new Promise((_, no) => {
          budget = setTimeout(() => no(new Error(`level budget of ${LEVEL_BUDGET_MS / 60000} min ran out`)), LEVEL_BUDGET_MS);
        }),
      ]);
    } catch (e) {
      r.error = (r.error ? r.error + '; ' : '') + String(e instanceof Error ? e.message : e).slice(0, 800);
      const dog = join(out, 'watchdog.txt');
      if (existsSync(dog) && statSync(dog).mtimeMs >= started) r.error += '; the memory watchdog stopped the app while this level ran (the Mac was swapping hard)';
      log(`L${nn(level.number)}: ERROR ${r.error}`);
      r.shots.push(await shot(`L${nn(level.number)}-error`));
      onWinCardOf = 0;
      try {
        await run.relaunch();
        await waitMap();
        log('app relaunched after the error');
      } catch (e2) {
        log(`relaunch failed: ${e2}`);
      }
    } finally {
      clearTimeout(budget);
    }
    r.touches = taps.log.length;
    r.log = taps.log;
    r.seconds.total = (Date.now() - started) / 1000;
    try {
      const f = await page.evaluate(() => {
        const a = (window as any).__appFaults;
        const copy = { pageErrors: [...a.pageErrors], consoleErrors: [...a.consoleErrors], outsideRequests: [...a.outsideRequests] };
        a.pageErrors.length = 0;
        a.consoleErrors.length = 0;
        a.outsideRequests.length = 0;
        return copy;
      });
      Object.assign(r, f);
      const f1 = await backend.exec<{ c: number; t: number }>(FRAMES);
      if (f0 && f1.c >= f0.c) (r as any).fps = Math.round(((f1.c - f0.c) / ((f1.t - f0.t) / 1000)) * 10) / 10;
    } catch (e) {
      log(`could not read the page's faults: ${e}`);
    }
    r.state = r.wonByTaps
      ? 'won by taps'
      : r.won && r.fault
        ? `won, finished by the debug hook after a ${r.fault.known ? 'known' : 'NEW'} tap fault at step ${r.fault.step} (${r.fault.kind})`
        : r.won
          ? 'won'
          : `not won${r.error ? `: ${r.error.slice(0, 200)}` : ''}`;
    log(`L${nn(level.number)} ${level.id}: ${r.state}; stars ${r.stars} (saved ${r.savedStars}); open ${r.seconds.open}s, play ${r.seconds.play}s, total ${r.seconds.total}s; page errors ${r.pageErrors.length}, console errors ${r.consoleErrors.length}; frames per second ${(r as any).fps ?? '?'}`);
    results.push(r);
    writeFileSync(join(out, `level-${nn(level.number)}-${level.id}.json`), JSON.stringify(r, null, 1));
    writeFileSync(join(out, 'results.json'), JSON.stringify(results.map(({ log: _l, ...rest }) => rest), null, 1));
  }

  if (args.extras) {
    try {
      await extras({ page, backend, run, device, out, shot, log, bundleId, waitMap });
    } catch (e) {
      log(`extras stopped: ${e}`);
    }
  }
  if (backend instanceof AppiumBackend) {
    const t = backend.execTimes.sort((a, b) => a - b);
    log(`script calls: ${t.length}, median ${t[Math.floor(t.length / 2)]} ms, 90th ${t[Math.floor(t.length * 0.9)]} ms`);
  }
  await run.end();
  const won = results.filter((r) => r.won).length;
  log(`done: ${won} of ${results.length} levels won, ${results.filter((r) => r.wonByTaps).length} by taps alone`);
}

/** Plays the rest of the level through the debug hook, from where the taps left it. */
async function finishByHook(page: FakePage, level: LevelCase) {
  const prefix = await page.evaluate((plan) => {
    const s = (window as any).__riddle.getState();
    const made = s.moves.map((m: unknown) => JSON.stringify(m));
    const ok = made.every((m: string, i: number) => m === JSON.stringify(plan[i]));
    return ok ? made.length : -1;
  }, level.moves);
  let from = prefix;
  if (from < 0) {
    await waitIdle(page);
    await page.evaluate(() => (window as any).__riddle.getState().restart());
    from = 0;
  }
  for (let i = from; i < level.moves.length; i++) {
    await waitIdle(page);
    await page.evaluate((m) => (window as any).__riddle.getState().play(m), level.moves[i]);
    await page.waitForFunction((n) => (window as any).__riddle.getState().moves.length >= n, i + 1, { timeout: 30_000 });
  }
}

export async function waitIdle(page: FakePage, timeout = 90_000) {
  await page.waitForFunction(() => {
    const s = (window as any).__riddle.getState();
    return s.status.kind !== 'playing' || !s.busy;
  }, undefined, { timeout });
}

export async function waitCameraStill(page: FakePage, quietMs = 800, timeout = 60_000) {
  const end = Date.now() + timeout;
  let last = '';
  let since = Date.now();
  while (Date.now() < end) {
    const now = JSON.stringify(await page.evaluate(() => (window as any).__taps.camera()?.map((n: number) => Math.round(n * 1e4))));
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) return;
    await sleep(150);
  }
  throw new Error('the camera never came to rest');
}

main().catch((e) => {
  log(`run stopped: ${e?.stack ?? e}`);
  process.exitCode = 1;
});
