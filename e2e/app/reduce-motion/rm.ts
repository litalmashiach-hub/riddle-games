/**
 * TEST ONLY (branch test/app-reduce-motion, never for main). One pass of the Reduce Motion check inside the
 * built app in an iOS simulator, with the device's setting as play-rm.sh left it (off or on):
 *
 *   tsx e2e/app/reduce-motion/rm.ts --pass off --udid <sim> --out out/rm --caps '<json>' --levels 1,2,4,7,12,22
 *
 * For each level it opens the level, taps "Let's go!" by a real touch, and takes the simulator's own pictures
 * (xcrun simctl io screenshot): through the opening, then two a second apart once settled. It records every
 * camera position the page drew (window.__camera of the debug hook). Level 2 shows Hint. Levels that can be
 * lost are set just before a loss and the last move is played through the debug hook; levels 1 and 4 are
 * won the same way. A short clip of each loss and win is recorded (xcrun simctl io recordVideo).
 * It reads, in the web view itself, what the device's setting gave the page: matchMedia('(prefers-reduced-motion: reduce)').
 */
import { appendFileSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { LEVELS } from '../../levels';
import { lossPath, levelRules } from '../../loss-paths';
import { AppiumBackend, ChromiumBackend, serve } from '../backends';
import { FakePage, sleep } from '../fake-page';

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
);
const pass = args.pass ?? 'off';
const udid = args.udid;
const out = resolve(args.out ?? 'out/rm');
const frames = join(out, 'frames');
mkdirSync(frames, { recursive: true });
(globalThis as any).__outDir = out;
const PROGRESS_KEY = 'riddle-games:progress:v1';
const t0 = Date.now();
const log = (s: string) => {
  const line = `${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}s [${pass}] ${s}`;
  console.log(line);
  appendFileSync(join(out, `run-log-${pass}.txt`), line + '\n');
};
const nn = (n: number) => String(n).padStart(2, '0');

// --backend chromium: a dry run of this script on the website build in Chromium (no simulator), the setting emulated.
let local: ChromiumBackend | null = null;

function simShot(name: string): Promise<{ file: string; ms: number } | null> {
  const file = `L${name}-reduce-motion-${pass}.png`;
  const at = Date.now();
  if (local) return local.screenshot(join(frames, file)).then(() => ({ file, ms: at }), () => null);
  return new Promise((done) =>
    execFile('xcrun', ['simctl', 'io', udid, 'screenshot', '--type=png', join(frames, file)], { timeout: 60_000 }, (err) => {
      if (err) {
        log(`picture ${name} failed: ${String(err).slice(0, 200)}`);
        return done(null);
      }
      done({ file, ms: at });
    }),
  );
}

/** Share of pixels where a colour channel differs by more than 8, between two pictures (whole screen). */
function changedShare(a: string, b: string): number | null {
  try {
    const x = PNG.sync.read(readFileSync(join(frames, a)));
    const y = PNG.sync.read(readFileSync(join(frames, b)));
    if (x.width !== y.width || x.height !== y.height) return null;
    let changed = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      if (Math.abs(x.data[i] - y.data[i]) > 8 || Math.abs(x.data[i + 1] - y.data[i + 1]) > 8 || Math.abs(x.data[i + 2] - y.data[i + 2]) > 8) changed++;
    }
    return changed / (x.data.length / 4);
  } catch (e) {
    log(`compare ${a} ${b}: ${e}`);
    return null;
  }
}

function startClip(name: string): { stop(): Promise<string> } {
  const file = `L${name}-reduce-motion-${pass}.mp4`;
  let p: ChildProcess | null = null;
  if (local) return { stop: async () => '' };
  try {
    p = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--codec=h264', '--force', join(frames, file)], { stdio: 'ignore' });
  } catch (e) {
    log(`clip ${name}: ${e}`);
  }
  return {
    stop: () =>
      new Promise((done) => {
        if (!p || p.exitCode !== null) return done('');
        p.once('exit', () => done(file));
        p.kill('SIGINT');
        setTimeout(() => done(file), 15_000);
      }),
  };
}

// In the page: every camera position drawn, as changes with their time, from now until __rmCamStop().
const CAM_START = `() => {
  if (window.__rmCamTimer) clearInterval(window.__rmCamTimer);
  window.__rmCam = []; window.__rmCamT0 = performance.now();
  let last = '';
  window.__rmCamTimer = setInterval(() => {
    const c = window.__camera && window.__camera.camera;
    if (!c) return;
    const k = [c.position.x, c.position.y, c.position.z].map((n) => n.toFixed(3)).join(',');
    if (k !== last && window.__rmCam.length < 3000) { window.__rmCam.push({ t: Math.round(performance.now() - window.__rmCamT0), p: k }); last = k; }
  }, 40);
  return true;
}`;
const CAM_STOP = `() => { clearInterval(window.__rmCamTimer); window.__rmCamTimer = 0; return window.__rmCam || []; }`;

const SETTING = `() => ({
  reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
  noPreference: matchMedia('(prefers-reduced-motion: no-preference)').matches,
  userAgent: navigator.userAgent,
  href: location.href,
})`;

async function main() {
  let b: any;
  if (args.backend === 'chromium') {
    const srv = await serve(resolve(join(import.meta.dirname, '..', '..', '..', 'apps', 'web', 'dist-app')));
    local = new ChromiumBackend(srv.url, { width: 852, height: 393 });
    await local.start();
    await local.page.emulateMedia({ reducedMotion: pass === 'on' ? 'reduce' : 'no-preference' });
    await local.page.addInitScript(() => { (window as any).__appTouches = []; });
    b = Object.assign(local, { toWebview: async () => undefined, webview: 'chromium' });
  } else {
    const caps = JSON.parse(args.caps ?? '{}');
    b = new AppiumBackend(caps, log);
    await b.start();
    await b.setOrientation('LANDSCAPE');
    log(`web view ${b.webview}, ${b.size().width} by ${b.size().height}`);
    log(`calibration: ${await b.calibrate()}`);
  }
  const page = new FakePage(b);
  const setting = await b.exec<any>(SETTING);
  log(`the device's setting as the web view reports it: ${JSON.stringify(setting)}`);
  const result: any = { pass, setting, size: b.size(), levels: [] as any[] };
  const save = () => writeFileSync(join(out, `result-${pass}.json`), JSON.stringify(result, null, 1));
  save();
  if (args['probe-only']) {
    // Only what the web view reports, once more after a reload of the page.
    await b.exec('() => { setTimeout(() => location.reload(), 50); return true; }');
    await sleep(5000);
    await b.toWebview();
    result.settingAfterReload = await b.exec<any>(SETTING);
    log(`after a reload: ${JSON.stringify(result.settingAfterReload)}`);
    save();
    await b.end();
    return;
  }

  // SD graphics and at most 6 frames a second, as in the earlier in-app runs (a hosted Mac has no graphics chip).
  await b.exec(`() => { const k = 'riddle-games:settings:v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(k) || '{}'); } catch {} s.quality = 'low'; localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem('app-test:fps', '${args.fps ?? 6}'); return true; }`);
  const reload = async () => {
    await b.exec('() => { setTimeout(() => location.reload(), 50); return true; }');
    await sleep(5000);
    await b.toWebview();
  };
  const allStars = Object.fromEntries(LEVELS.map((l) => [l.id, 3]));
  await page.evaluate(([key, s]) => { localStorage.setItem(key, JSON.stringify({ stars: s })); history.replaceState(null, '', location.pathname); return true; }, [PROGRESS_KEY, allStars] as const);
  await reload();
  await page.waitForFunction(() => !!document.querySelector('[aria-label="About and settings"]'), undefined, { timeout: 120_000 });
  result.settingAfterReload = await b.exec<any>(SETTING);
  log(`after a reload: ${JSON.stringify(result.settingAfterReload)}`);
  // The level map's own page motion (drifting background blobs): two pictures a second apart.
  await sleep(3000);
  const m1 = await simShot('00-map-a');
  await sleep(1000);
  const m2 = await simShot('00-map-b');
  result.map = { frames: [m1?.file, m2?.file], changed: m1 && m2 ? changedShare(m1.file, m2.file) : null };
  log(`level map: ${JSON.stringify(result.map)}`);
  save();

  const order = (args.levels ?? '1,2,4,7,12,22').split(',').map(Number);
  for (const n of order) {
    const level = LEVELS.find((l) => l.number === n);
    if (!level) continue;
    const L = nn(n);
    const r: any = { level: n, id: level.id, title: level.title, frames: {} };
    result.levels.push(r);
    try {
      log(`level ${L} ${level.id}: opening`);
      await b.exec(`(id) => { location.hash = '#/level/' + id; return true; }`, level.id);
      await b.exec(CAM_START);
      await page.waitForFunction((want) => (window as any).__riddle?.getState().level.id === want, level.id, { timeout: 120_000 });
      const go = page.getByRole('button', { name: "Let's go!" });
      await go.waitFor({ state: 'visible', timeout: 120_000 });
      await sleep(1500);
      r.frames.rulesCard = (await simShot(`${L}-0-rules-card`))?.file;
      const tapAt = Date.now();
      await go.tap();
      // Through the opening: a picture as fast as the simulator gives them, for about 6 s.
      const opening: any[] = [];
      for (let i = 1; Date.now() - tapAt < 6000 && i <= 10; i++) {
        const s = await simShot(`${L}-1-open-${i}`);
        if (s) opening.push({ file: s.file, sAfterTap: +((s.ms - tapAt) / 1000).toFixed(2) });
      }
      r.frames.opening = opening;
      await page.waitForFunction(() => !document.querySelector('[role="status"][aria-label="Loading level"]'), undefined, { timeout: 120_000 }).catch((e) => log(`loading curtain: ${e}`));
      const cam = await b.exec<any[]>(CAM_STOP);
      r.cameraWhileOpening = { positions: cam.length, first: cam[0] ?? null, last: cam[cam.length - 1] ?? null, sample: cam.slice(0, 12) };
      log(`level ${L}: camera positions from the hash change until settled: ${cam.length}`);
      // Settled: two pictures a second apart.
      await sleep(3000);
      const a = await simShot(`${L}-2-still-a`);
      await sleep(1000);
      const c = await simShot(`${L}-2-still-b`);
      r.frames.still = [a?.file, c?.file];
      r.stillChanged = a && c ? changedShare(a.file, c.file) : null;
      r.stillGapS = a && c ? (c.ms - a.ms) / 1000 : null;
      log(`level ${L}: share of the screen that changed in ${r.stillGapS} s once settled: ${r.stillChanged}`);
      save();

      if (n === 2) {
        await page.getByRole('button', { name: 'Hint' }).first().tap();
        await sleep(2000);
        const h1 = await simShot(`${L}-3-hint-a`);
        await sleep(800);
        const h2 = await simShot(`${L}-3-hint-b`);
        r.frames.hint = [h1?.file, h2?.file];
        r.hintChanged = h1 && h2 ? changedShare(h1.file, h2.file) : null;
        r.hintSpoken = await b.exec<string>(`() => (document.querySelector('[data-testid="hint-spoken"]') || {}).textContent || ''`);
        log(`level ${L}: hint "${r.hintSpoken}", changed ${r.hintChanged}`);
        save();
      }

      const playOut = async (kind: 'loss' | 'win', moves: unknown[]) => {
        const before = moves.slice(0, -1);
        await page.evaluate((mv) => {
          const store = (window as any).__riddle;
          const s = store.getState();
          const rules = s.level.rules;
          const history = [rules.initialState];
          for (const m of mv) history.push(rules.apply(history[history.length - 1], m));
          store.setState({ history, moves: mv, future: [], status: rules.status(history[history.length - 1]), hint: null });
          return true;
        }, before as any);
        await sleep(2500);
        const rest = await simShot(`${L}-4-${kind}-0-before`);
        await b.exec(CAM_START);
        const clip = startClip(`${L}-${kind}`);
        await sleep(1500);
        const at = Date.now();
        const taken = await page.evaluate((m) => {
          const s = (window as any).__riddle;
          const k = s.getState().moves.length;
          s.getState().play(m);
          return s.getState().moves.length === k + 1;
        }, moves[moves.length - 1] as any);
        const shots: any[] = [];
        for (let i = 1; Date.now() - at < 7000 && i <= 10; i++) {
          const s = await simShot(`${L}-4-${kind}-${i}`);
          if (s) shots.push({ file: s.file, sAfterMove: +((s.ms - at) / 1000).toFixed(2) });
        }
        const heading = kind === 'loss' ? 'Oh no!' : null;
        if (heading) await page.getByRole('heading', { name: heading }).waitFor({ state: 'visible', timeout: 60_000 }).catch((e) => log(`${kind} card: ${e}`));
        else await sleep(3000);
        const card = await simShot(`${L}-4-${kind}-card`);
        const camL = await b.exec<any[]>(CAM_STOP);
        const clipFile = await clip.stop();
        const status = await b.exec<any>(`() => window.__riddle.getState().status`);
        const x = { moveTaken: taken, status, before: rest?.file, frames: shots, card: card?.file, clip: clipFile, cameraPositions: camL.length, camera: camL.slice(0, 20) };
        log(`level ${L} ${kind}: ${JSON.stringify({ moveTaken: taken, status: status?.kind, cameraPositions: camL.length, frames: shots.length })}`);
        return x;
      };

      const loss = lossPath(await levelRules(level.dir));
      if (loss && [1, 7, 12, 22].includes(n)) {
        r.loss = await playOut('loss', loss);
        save();
      }
      if ([1, 4].includes(n)) {
        if (r.loss) {
          // A fresh start of the level for the win.
          await b.exec(`() => { location.hash = '#/'; return true; }`);
          await sleep(4000);
          await b.exec(`(id) => { location.hash = '#/level/' + id; return true; }`, level.id);
          await page.waitForFunction((want) => (window as any).__riddle?.getState().level.id === want, level.id, { timeout: 120_000 });
          const go2 = page.getByRole('button', { name: "Let's go!" });
          await go2.waitFor({ state: 'visible', timeout: 120_000 });
          await sleep(1000);
          await go2.tap();
          await page.waitForFunction(() => !document.querySelector('[role="status"][aria-label="Loading level"]'), undefined, { timeout: 120_000 }).catch(() => undefined);
          await sleep(3000);
        }
        r.win = await playOut('win', level.moves);
        save();
      }
    } catch (e) {
      r.error = String(e).slice(0, 600);
      log(`level ${L}: ERROR ${r.error}`);
      await simShot(`${L}-9-error`);
      await b.toWebview().catch(() => undefined);
    }
    save();
    await b.exec(`() => { location.hash = '#/'; return true; }`).catch(() => undefined);
    await sleep(3000);
  }
  result.settingAtEnd = await b.exec<any>(SETTING).catch((e) => String(e));
  save();
  await b.end();
  log('pass done');
}

main().catch((e) => {
  log(`FAILED: ${e?.stack ?? e}`);
  process.exit(1);
});
