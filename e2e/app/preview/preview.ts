/**
 * TEST ONLY (branch test/app-preview-video, never for main). Films the store's preview video inside the
 * built app, one picture per 1/30 s of the game's own (virtual) clock: see vclock.ts.
 *
 *   tsx e2e/app/preview/preview.ts --out out/preview --caps '<json>'          (the app in a simulator, Appium)
 *   tsx e2e/app/preview/preview.ts --out out/preview --backend chromium      (a dry run on the app build here)
 *
 * Each scene: the level is opened and "Let's go!" pressed by a real touch, with the clock running. The
 * level is set to the scene's first position through the game's debug hook (as the play-through tests do),
 * then the clock is frozen and the scene's moves are played through the game's own move function on a
 * timetable, one picture per frame. The sound is the game's own (vclock.ts) and is written to sound.wav.
 * Written: out/frames/<scene>/f0000.png ..., out/sound.wav, out/scenes.json (frames and sound offsets).
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LEVELS } from '../../levels';
import { AppiumBackend, ChromiumBackend, serve } from '../backends';
import { FakePage, sleep } from '../fake-page';
import { PNG } from 'pngjs';

/** True if the middle of a picture is one flat colour: the 3D view was not in it (seen in Chromium's pictures). */
function flat(file: string): boolean {
  const p = PNG.sync.read(readFileSync(file));
  const count = new Map<number, number>();
  let n = 0;
  for (let gy = 1; gy < 20; gy++) for (let gx = 2; gx < 38; gx++) {
    const x = Math.floor((p.width * gx) / 40), y = Math.floor((p.height * gy) / 20);
    const i = (y * p.width + x) * 4;
    const k = ((p.data[i] >> 3) << 10) | ((p.data[i + 1] >> 3) << 5) | (p.data[i + 2] >> 3);
    count.set(k, (count.get(k) ?? 0) + 1);
    n++;
  }
  return Math.max(...count.values()) / n > 0.8;
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []),
);
const out = resolve(args.out ?? 'out/preview');
mkdirSync(out, { recursive: true });
(globalThis as any).__outDir = out;
const FPS = 30;
const DT = 1000 / FPS;
const t0 = Date.now();
const log = (s: string) => {
  const line = `${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}s ${s}`;
  console.log(line);
  appendFileSync(join(out, 'run-log.txt'), line + '\n');
};

/** A scene: a level, the moves played before filming (not filmed), and the filmed moves at their frame. */
export interface Scene {
  name: string;
  level: number;
  /** How many of the level's shortest solution's moves are set before filming. */
  before: number;
  /** The filmed moves, each the next move of the shortest solution, at this frame of the scene. */
  at: number[];
  /** At least this many frames between a move the game took and the next (a player's pause). */
  gap?: number;
  frames: number;
}
const SCENES: Scene[] = JSON.parse(args.scenes ? readFileSync(args.scenes, 'utf8') : readFileSync(join(import.meta.dirname, 'scenes.json'), 'utf8'));
const only = args.only ? String(args.only).split(',') : null;
const maxFrames = args['max-frames'] ? Number(args['max-frames']) : Infinity;

async function main() {
  let b: any;
  let local: ChromiumBackend | null = null;
  if (args.backend === 'chromium') {
    const srv = await serve(resolve(join(import.meta.dirname, '..', '..', '..', 'apps', 'web', 'dist-app')));
    local = new ChromiumBackend(srv.url, { width: Number(args.w ?? 956), height: Number(args.h ?? 440) });
    await local.start();
    await local.page.addInitScript(() => { (window as any).__appTouches = []; });
    b = Object.assign(local, { toWebview: async () => undefined, webview: 'chromium' });
  } else {
    b = new AppiumBackend(JSON.parse(args.caps ?? '{}'), log);
    await b.start();
    await b.setOrientation('LANDSCAPE');
    log(`web view ${b.webview}, ${b.size().width} by ${b.size().height}`);
    log(`calibration: ${await b.calibrate()}`);
    // The highest quality XCTest gives (lossless PNG of the whole screen, no Dynamic Island drawn in).
    await b.driver.updateSettings({ screenshotQuality: 0 }).catch((e: unknown) => log(`screenshotQuality: ${e}`));
  }
  const page = new FakePage(b);
  const reload = async () => {
    await b.exec('() => { setTimeout(() => location.reload(), 50); return true; }');
    await sleep(6000);
    await b.toWebview();
  };
  // The recorder on, HD graphics (the game's own HD setting), sound on, every level open (as after playing them).
  const quality = args.quality ?? 'high';
  const allStars = Object.fromEntries(LEVELS.map((l) => [l.id, 3]));
  await b.exec(
    `(a) => { localStorage.setItem('app-test:vclock', '1'); localStorage.setItem('app-test:vclock-run-fps', a.runFps); localStorage.removeItem('app-test:fps');
      localStorage.setItem('riddle-games:settings:v1', JSON.stringify({ quality: a.quality, sound: true }));
      localStorage.setItem('riddle-games:progress:v1', JSON.stringify({ stars: a.stars })); history.replaceState(null, '', location.pathname); return true; }`,
    { quality, stars: allStars, runFps: String(args['run-fps'] ?? 8) },
  );
  await reload();
  await page.waitForFunction(() => !!(window as any).__vclock && !!document.querySelector('[aria-label="About and settings"]'), undefined, { timeout: 180_000 });
  log(`recorder in the page: ${await b.exec('() => typeof window.__vclock')}; quality ${quality}`);
  const done: any[] = [];
  const save = () => writeFileSync(join(out, 'scenes.json'), JSON.stringify(done, null, 1));

  for (const sc of SCENES) {
    if (only && !only.includes(sc.name)) continue;
    const level = LEVELS.find((l) => l.number === sc.level)!;
    const dir = join(out, 'frames', sc.name);
    mkdirSync(dir, { recursive: true });
    const rec: any = { ...sc, id: level.id, title: level.title, shots: 0, ms: [] as number[] };
    done.push(rec);
    log(`scene ${sc.name}: level ${sc.level} ${level.id}`);
    await b.exec(`(id) => { location.hash = '#/level/' + id; return true; }`, level.id);
    await page.waitForFunction((want) => (window as any).__riddle?.getState().level.id === want, level.id, { timeout: 180_000 });
    const go = page.getByRole('button', { name: "Let's go!" });
    await go.waitFor({ state: 'visible', timeout: 180_000 });
    await sleep(1500);
    await go.tap();
    await page.waitForFunction(() => !document.querySelector('[role="status"][aria-label="Loading level"]'), undefined, { timeout: 180_000 }).catch((e) => log(`loading curtain: ${e}`));
    await sleep(Number(args.settle ?? 6000));
    // The first position: the first `before` moves of the shortest solution, set at once.
    const moves = level.moves;
    await page.evaluate((mv) => {
      const store = (window as any).__riddle;
      const s = store.getState();
      const rules = s.level.rules;
      const history = [rules.initialState];
      for (const m of mv) history.push(rules.apply(history[history.length - 1], m));
      store.setState({ history, moves: mv, future: [], status: rules.status(history[history.length - 1]), hint: null });
      return true;
    }, moves.slice(0, sc.before) as any);
    await sleep(Number(args.settle ?? 6000));
    await b.exec('() => { window.__vclock.freeze(); window.__vclock.record(true); return true; }');
    rec.audioStartMs = await b.exec<number>('() => window.__vclock.audioMs()');
    // A move is played at its frame, or, if the game is still showing the last one and does not take it yet,
    // at the first frame after that where it does (a player's next tap would wait for the same).
    let next = sc.before;
    let due = 0;
    rec.played = [] as { move: unknown; frame: number }[];
    const n = Math.min(sc.frames, maxFrames);
    for (let f = 0; f < n; f++) {
      const wanted = sc.at.filter((a) => a <= f).length;
      const lastAt = rec.played.length ? rec.played[rec.played.length - 1].frame : -Infinity;
      const mv = next - sc.before < wanted && next < moves.length && f - lastAt >= (sc.gap ?? 0) ? moves[next] : undefined;
      const st = Date.now();
      const r = await b.exec<any>(
        `(mv) => { const s = window.__riddle; let took = null; if (mv) { const k = s.getState().moves.length; s.getState().play(mv.m); took = s.getState().moves.length === k + 1; } const st = window.__vclock.step(${DT}); return { took, st, status: s.getState().status && s.getState().status.kind }; }`,
        mv === undefined ? null : { m: mv },
      );
      if (mv !== undefined) {
        due++;
        if (r.took) { log(`scene ${sc.name} frame ${f}: move ${JSON.stringify(mv)} played (${due - 1} frames late); status ${r.status}`); rec.played.push({ move: mv, frame: f }); next++; due = 0; }
      }
      await sleep(Number(args['draw-wait'] ?? 120));
      const file = join(dir, `f${String(f).padStart(4, '0')}.png`);
      await b.screenshot(file);
      // If the 3D view is missing from the picture, the same instant is drawn again (no time passes) and retaken.
      for (let tries = 0; tries < 6 && flat(file); tries++) {
        rec.redrawn = (rec.redrawn ?? 0) + 1;
        await b.exec('() => window.__vclock.step(0)');
        await sleep(Number(args['draw-wait'] ?? 120) * (tries + 2));
        await b.screenshot(file);
      }
      if (flat(file)) { rec.flatLeft = [...(rec.flatLeft ?? []), f]; log(`scene ${sc.name} frame ${f}: still no 3D view in the picture`); }
      rec.shots++;
      rec.ms.push(Date.now() - st);
      if (f % 30 === 0) log(`scene ${sc.name}: frame ${f}/${n}, ${Date.now() - st} ms a frame; status ${r.status}; t ${Math.round(r.st.t)}`);
    }
    rec.status = await b.exec<any>('() => window.__riddle.getState().status');
    rec.audioEndMs = await b.exec<number>('() => { window.__vclock.record(false); const a = window.__vclock.audioMs(); window.__vclock.gap(3000); window.__vclock.resume(); return a; }');
    rec.faults = await b.exec<any>('() => window.__appFaults').catch(() => null);
    log(`scene ${sc.name} done: ${rec.shots} pictures, sound ${rec.audioStartMs}-${rec.audioEndMs} ms, status ${JSON.stringify(rec.status)}`);
    delete rec.ms;
    save();
    await b.exec(`() => { location.hash = '#/'; return true; }`);
    await sleep(4000);
  }
  // The sound: render the shared offline engine and fetch it.
  const events = await b.exec<any[]>('() => window.__vclock.events()');
  writeFileSync(join(out, 'sound-events.json'), JSON.stringify(events));
  log(`sound starts while filming: ${events.length}`);
  await b.exec('() => window.__vclock.render()');
  let info: any = null;
  for (let i = 0; i < 300 && !info; i++) {
    await sleep(1000);
    info = await b.exec<any>('() => window.__vclock.rendered()');
  }
  log(`sound rendered: ${JSON.stringify(info)}`);
  if (info && !info.error) {
    const last = Math.max(...done.map((d) => d.audioEndMs ?? 0)) + 3000;
    const total = Math.min(info.len, Math.ceil((last / 1000) * info.sr));
    const parts: Buffer[] = [];
    for (let at = 0; at < total; at += info.sr) parts.push(Buffer.from(await b.exec<string>(`() => window.__vclock.chunk(${at}, ${info.sr})`), 'base64'));
    const pcm = Buffer.concat(parts);
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(info.sr, 24);
    h.writeUInt32LE(info.sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    writeFileSync(join(out, 'sound.wav'), Buffer.concat([h, pcm]));
    let peak = 0;
    for (let i = 0; i < pcm.length; i += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i)));
    log(`sound.wav: ${(pcm.length / 4 / info.sr).toFixed(2)} s, peak ${peak}`);
  }
  save();
  await b.end();
  log('done');
}

main().then(() => process.exit(0), (e) => {
  log(`FAILED: ${e?.stack ?? e}`);
  process.exit(1);
});
