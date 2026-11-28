import { test, type CDPSession, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../levels';

/**
 * Measures what the game holds while levels are entered, left and played.
 * Settings come from the environment:
 *   MEM_LEVELS   level ids, comma separated (default: 17, 26, 27 and a few ordinary levels)
 *   MEM_ENTRIES  entries and exits of each level (default 10)
 *   MEM_SOAK     seconds of continuous play, then of idle, in each of 17, 26 and 27 (default 300; 0 skips)
 *   MEM_QUALITY  low (SD) or high (HD) (default low)
 *   MEM_OUT      where the samples go (default test-results/memory/<quality>.jsonl)
 *   MEM_APP      1 when the server serves the app build (dist-app): it has no test switches, so
 *                levels are opened by address with every level unlocked, and only entered and left
 */
const here = dirname(fileURLToPath(import.meta.url));
const LEDGER = readFileSync(join(here, 'gl-ledger.js'), 'utf8');
const QUALITY = process.env.MEM_QUALITY ?? 'low';
const ENTRIES = Number(process.env.MEM_ENTRIES ?? 10);
const SOAK = Number(process.env.MEM_SOAK ?? 300);
const IDS = (process.env.MEM_LEVELS ?? 'moonbeam-mirrors,moonbeam-maze,timber-tangle,wolf-two-sheep,tower-of-hanoi,log-jam,pancake-stack').split(',');
const SOAK_IDS = (process.env.MEM_SOAK_LEVELS ?? 'moonbeam-mirrors,moonbeam-maze,timber-tangle').split(',');
const APP = process.env.MEM_APP === '1';
const OUT = process.env.MEM_OUT ?? join(here, '..', '..', 'test-results', 'memory', `${QUALITY}.jsonl`);

/** Resident memory (MB) of the browser's drawing process and of the page's process, from the system. */
function processMb() {
  const rows = execSync('ps -eo pid,rss,args', { maxBuffer: 1 << 24 }).toString().split('\n');
  let gpu = 0, renderer = 0;
  for (const r of rows) {
    if (!/chrom/i.test(r)) continue;
    const rss = Number(r.trim().split(/\s+/)[1]) / 1024;
    if (r.includes('--type=gpu-process')) gpu += rss;
    else if (r.includes('--type=renderer') && !r.includes('--extension-process')) renderer = Math.max(renderer, rss);
  }
  return { gpuProcessMb: Math.round(gpu), rendererMb: Math.round(renderer) };
}

async function sample(page: Page, cdp: CDPSession, row: Record<string, unknown>) {
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage');
  const gl = await page.evaluate(() => (window as any).__glLedger.read());
  const out = { t: new Date().toISOString(), quality: QUALITY, ...row, gl, heapMb: +(heap.usedSize / 1048576).toFixed(1), ...processMb() };
  appendFileSync(OUT, JSON.stringify(out) + '\n');
  console.log(JSON.stringify(out));
  return out;
}

async function enter(page: Page, id: string) {
  await page.evaluate((h) => (location.hash = h), `#/level/${id}`);
  if (!APP) await page.waitForFunction((want) => (window as any).__riddle?.getState().level.id === want, id, { timeout: 120_000 });
  const go = page.getByRole('button', { name: "Let's go!" });
  await go.waitFor({ timeout: 120_000 });
  // The scene is ready once the loading curtain has gone (its number disappears).
  await page.waitForTimeout(1500);
  await go.tap();
  await go.waitFor({ state: 'hidden' });
}

async function leave(page: Page) {
  await page.evaluate(() => (location.hash = '#/'));
  await page.getByText(/\d+ \/ \d+/).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
}

async function play(page: Page, move: unknown) {
  const ok = await page.evaluate((m) => {
    const s = (window as any).__riddle.getState();
    const before = s.moves.length;
    s.play(m);
    return (window as any).__riddle.getState().moves.length === before + 1;
  }, move);
  if (!ok) throw new Error(`move ${JSON.stringify(move)} was refused`);
  await page.waitForFunction(() => { const s = (window as any).__riddle.getState(); return s.status.kind !== 'playing' || !s.busy; }, null, { timeout: 60_000 });
}

test.beforeAll(() => mkdirSync(dirname(OUT), { recursive: true }));

test(`memory: ${QUALITY}`, async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await page.addInitScript(LEDGER);
  await page.addInitScript((q) => {
    localStorage.setItem('riddle-games:settings:v1', JSON.stringify({ quality: q, sound: false }));
  }, QUALITY);
  if (APP) {
    await page.addInitScript((ids) => {
      localStorage.setItem('riddle-games:progress:v1', JSON.stringify({ stars: Object.fromEntries(ids.map((i: string) => [i, 3])) }));
    }, LEVELS.map((l) => l.id));
  }
  writeFileSync(OUT, '');
  await page.goto(APP ? '#/' : `?all&debug&quality=${QUALITY}#/`);
  await page.getByText(/\d+ \/ \d+/).first().waitFor();
  await sample(page, cdp, { phase: 'start' });

  for (const id of IDS) {
    const level = LEVELS.find((l) => l.id === id);
    if (!level) throw new Error(`no level ${id}`);
    const some = APP ? [] : level.moves.slice(0, Math.min(3, level.moves.length - 1));
    for (let i = 1; i <= ENTRIES; i++) {
      await enter(page, id);
      for (const m of some) await play(page, m);
      await sample(page, cdp, { phase: 'in-level', level: level.number, id, entry: i });
      await leave(page);
      await sample(page, cdp, { phase: 'after-exit', level: level.number, id, entry: i });
    }
  }

  if (SOAK > 0 && !APP) {
    for (const id of SOAK_IDS) {
      const level = LEVELS.find((l) => l.id === id)!;
      // Continuous play: every move of the solution but the last, then restart, over and over.
      await enter(page, id);
      let start = Date.now(), next = 0, rounds = 0;
      while (Date.now() - start < SOAK * 1000) {
        for (const m of level.moves.slice(0, -1)) {
          await play(page, m);
          if (Date.now() - start >= next * 1000) {
            await sample(page, cdp, { phase: 'play', level: level.number, id, sec: Math.round((Date.now() - start) / 1000), rounds });
            next += 30;
          }
          if (Date.now() - start >= SOAK * 1000) break;
        }
        await page.evaluate(() => (window as any).__riddle.getState().restart());
        await page.waitForTimeout(500);
        rounds++;
      }
      await sample(page, cdp, { phase: 'play', level: level.number, id, sec: Math.round((Date.now() - start) / 1000), rounds });
      // Idle: the level open, nothing touched.
      start = Date.now();
      for (let s = 0; s <= SOAK; s += 30) {
        await sample(page, cdp, { phase: 'idle', level: level.number, id, sec: Math.round((Date.now() - start) / 1000) });
        if (s < SOAK) await page.waitForTimeout(30_000);
      }
      await leave(page);
      await sample(page, cdp, { phase: 'after-soak', level: level.number, id });
    }
  }
});
