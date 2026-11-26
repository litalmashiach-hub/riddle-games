/**
 * TEST ONLY, not committed. The end of the game in a browser at iPhone size, on the app build:
 * levels 1 to 29 are set as won in the stored progress, level 30 is won by play, and the run looks at
 * the win card, the map at 30 of 30, and About.
 *   tsx e2e/app/endgame.ts --size 852x393 --out <dir> --port 4601
 */
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LEVELS } from '../levels';
import { PLAYERS } from '../taps/players';
import { TapFault, Taps } from '../taps/harness';
import { serve } from './backends';
import { FakePage, sleep, type Backend } from './fake-page';

const args = Object.fromEntries(process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? 'true']] : acc), []));
const [W, H] = (args.size ?? '852x393').split('x').map(Number);
const tag = `${W}x${H}`;
const out = resolve(args.out ?? 'out/endgame');
mkdirSync(out, { recursive: true });
const log = (s: string) => { const l = `${new Date().toISOString().slice(11, 19)} [${tag}] ${s}`; console.log(l); appendFileSync(join(out, `log-${tag}.txt`), l + '\n'); };
const wrap = (src: string) => `var __name = function (f) { return f; }; try { var v = (${src})(arguments[0]); return { ok: true, v: v === undefined ? null : v }; } catch (e) { return { ok: false, e: String(e && e.message ? e.name + ': ' + e.message + ' | ' + e.stack : e) }; }`;

async function main() {
  const { chromium } = await import('playwright-core');
  const srv = await serve(resolve(join(import.meta.dirname, '..', '..', 'apps', 'web', 'dist-app')), Number(args.port ?? 4601));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const consoleErrors: string[] = [];
  pg.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 400)));
  pg.on('pageerror', (e) => consoleErrors.push('page error: ' + String(e.stack ?? e).slice(0, 600)));
  const requests: string[] = [];
  pg.on('request', (r) => { if (!r.url().startsWith(srv.url) && !/^(data|blob):/.test(r.url())) requests.push(r.url()); });
  await pg.goto(srv.url);
  const backend: Backend = {
    exec: async (src, arg) => { const r = await pg.evaluate(([s, a]: [string, unknown]) => new Function(s).call(null, a), [wrap(src), arg ?? null] as [string, unknown]); if (!r.ok) throw new Error(`in the page: ${r.e}`); return r.v; },
    tap: (x, y) => pg.touchscreen.tap(x, y),
    drag: async (from, to, opts) => {
      const cdp = await ctx.newCDPSession(pg);
      const touch = (type: string, p?: { x: number; y: number }) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }] : [] });
      await touch('touchStart', from); await sleep(opts.holdMs);
      for (let i = 1; i <= opts.steps; i++) { await touch('touchMove', { x: from.x + ((to.x - from.x) * i) / opts.steps, y: from.y + ((to.y - from.y) * i) / opts.steps }); await sleep(opts.stepMs); }
      await touch('touchEnd'); await cdp.detach();
    },
    screenshot: async (file) => { await pg.screenshot({ path: file }); },
    size: () => ({ width: W, height: H }),
  };
  const page = new FakePage(backend);
  let n = 0;
  const shot = async (what: string) => { const f = `end-${tag}-${String(++n).padStart(2, '0')}-${what}.png`; await pg.screenshot({ path: join(out, f) }); return f; };
  const waitMap = () => page.waitForFunction(() => !!document.querySelector('[aria-label="About and settings"]') && !!document.querySelector('button[aria-label^="Level 1:"]'), undefined, { timeout: 60_000 });
  const mapState = () => pg.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('button[aria-label^="Level "]')) as HTMLElement[];
    const inView = cards.filter((c) => { const r = c.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; }).map((c) => c.getAttribute('aria-label'));
    const ringed = cards.filter((c) => /ring-amber-200/.test(c.className)).map((c) => c.getAttribute('aria-label'));
    return {
      header: Array.from(document.querySelectorAll('span')).map((s) => s.textContent?.trim()).find((t) => /^\d+ \/ \d+$/.test(t ?? '')) ?? null,
      spokenTotal: document.querySelector('[role=img][aria-label*="star"]')?.getAttribute('aria-label') ?? null,
      cards: cards.length,
      solved: cards.filter((c) => /3 of 3 stars|of 3 stars/.test(c.getAttribute('aria-label') ?? '')).length,
      locked: cards.filter((c) => /locked/.test(c.getAttribute('aria-label') ?? '')).length,
      comingSoon: /Coming soon/.test(document.body.innerText),
      cardsInView: inView,
      ringedCard: ringed,
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
      hash: location.hash,
    };
  });
  const result: Record<string, unknown> = { size: tag };
  const save = () => writeFileSync(join(out, `end-${tag}.json`), JSON.stringify(result, null, 1));

  await waitMap();
  // Levels 1 to 29 set as won, straight into the stored progress (the one thing this run writes by script).
  const seeded = Object.fromEntries(LEVELS.filter((l) => l.number < 30).map((l) => [l.id, 3]));
  await pg.evaluate((stars) => localStorage.setItem('riddle-games:progress:v1', JSON.stringify({ stars, guidesSeen: ['wolf-two-sheep'] })), seeded);
  await pg.reload();
  await waitMap();
  await sleep(1500);
  result.mapAt29 = await mapState();
  result.mapAt29Shot = await shot('map-29-of-30');
  log(`map before: ${JSON.stringify(result.mapAt29)}`);

  const level = LEVELS.find((l) => l.number === 30)!;
  const card = page.getByRole('button', { name: /^Level 30: / });
  await card.tap();
  const go = page.getByRole('button', { name: "Let's go!" });
  await go.waitFor({ state: 'visible', timeout: 120_000 });
  await page.waitForFunction((id) => !!(window as any).__taps?.ready() && (window as any).__riddle?.getState().level.id === id, level.id, { timeout: 120_000 });
  await sleep(1500);
  result.rulesShot = await shot('L30-rules-card');
  await go.tap();
  await go.waitFor({ state: 'hidden', timeout: 30_000 });
  const taps = new Taps(pg as any, level, { width: W, height: H });
  const idle = () => page.waitForFunction(() => { const s = (window as any).__riddle.getState(); return s.status.kind !== 'playing' || !s.busy; }, undefined, { timeout: 90_000 });
  await sleep(3000);
  await idle();
  const player = PLAYERS[level.id];
  let byTaps = 0;
  let fault: TapFault | null = null;
  try {
    await player.setup?.(taps);
    for (const [i, move] of level.moves.entries()) {
      taps.step = i + 1;
      const before = await taps.snapshot();
      await player.move(taps, move, before.state, i);
      try { await page.waitForFunction((k) => (window as any).__riddle.getState().moves.length >= k, i + 1, { timeout: 30_000 }); } catch { throw new TapFault('no-move', i + 1, `no move followed. Last touch: ${taps.lastTouch()}`); }
      byTaps = i + 1;
      if (i === Math.floor(level.moves.length / 2)) await shot('L30-in-play');
      await idle();
    }
  } catch (e) { if (!(e instanceof TapFault)) throw e; fault = e; }
  if (fault) {
    log(`tap fault at step ${fault.step}: ${fault.kind}: ${fault.detail}`);
    await shot(`L30-fault-step-${fault.step}`);
    for (let i = byTaps; i < level.moves.length; i++) { await idle(); await pg.evaluate((m) => (window as any).__riddle.getState().play(m), level.moves[i]); await page.waitForFunction((k) => (window as any).__riddle.getState().moves.length >= k, i + 1, { timeout: 30_000 }); }
  }
  await page.getByRole('heading', { name: 'Solved!' }).waitFor({ state: 'visible', timeout: 120_000 });
  await sleep(3000);
  result.level30 = { moves: level.moves.length, movesByTaps: byTaps, fault: fault ? { kind: fault.kind, step: fault.step, detail: fault.detail } : null };
  result.winCard = await pg.evaluate(() => {
    const h = Array.from(document.querySelectorAll('h2')).find((x) => /Solved!/.test(x.textContent ?? ''))!;
    let box: HTMLElement = h;
    while (box.parentElement && box.querySelectorAll('button').length === 0) box = box.parentElement;
    const r = box.getBoundingClientRect();
    return {
      text: box.innerText.replace(/\s+/g, ' ').trim(),
      buttons: Array.from(box.querySelectorAll('button')).map((b) => { const q = b.getBoundingClientRect(); return { text: b.textContent?.trim(), x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height), inScreen: q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight }; }),
      allButtonsOnScreen: Array.from(document.querySelectorAll('button')).filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.getAttribute('aria-label') || b.textContent?.trim()),
      box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      stored: localStorage.getItem('riddle-games:progress:v1'),
      nextLevelButton: !!Array.from(document.querySelectorAll('button')).find((b) => /Next/.test(b.textContent ?? '')),
    };
  });
  result.winShot = await shot('L30-win-card');
  log(`win card: ${JSON.stringify(result.winCard)}`);
  save();

  // "Play again": does it start the level over, and does the card come back on a second win? (Only the first is tried.)
  await page.getByRole('button', { name: 'Play again', exact: true }).tap();
  await sleep(2500);
  result.afterPlayAgain = await pg.evaluate(() => ({ moves: (window as any).__riddle.getState().moves.length, status: (window as any).__riddle.getState().status.kind, solvedShown: !!Array.from(document.querySelectorAll('h2')).find((x) => /Solved!/.test(x.textContent ?? '') && x.getBoundingClientRect().width > 0), hash: location.hash }));
  result.playAgainShot = await shot('L30-after-play-again');
  log(`after Play again: ${JSON.stringify(result.afterPlayAgain)}`);
  // Win it again through the debug hook, to come back to the card, then leave by "All levels".
  for (let i = 0; i < level.moves.length; i++) { await idle(); await pg.evaluate((m) => (window as any).__riddle.getState().play(m), level.moves[i]); await page.waitForFunction((k) => (window as any).__riddle.getState().moves.length >= k, i + 1, { timeout: 30_000 }); }
  await page.getByRole('heading', { name: 'Solved!' }).waitFor({ state: 'visible', timeout: 120_000 });
  await sleep(2500);
  result.secondWinShot = await shot('L30-second-win-card');
  await page.getByRole('button', { name: 'All levels', exact: true }).tap();
  await waitMap();
  await sleep(2500);
  result.mapAt30 = await mapState();
  result.mapAt30Shot = await shot('map-30-of-30-as-it-opens');
  log(`map at 30 of 30: ${JSON.stringify(result.mapAt30)}`);
  // The far end of the map, by the page's own scroll (a look, not a touch).
  await pg.evaluate(() => { const c = document.querySelector('button[aria-label^="Level 30:"]'); c?.scrollIntoView({ inline: 'center', block: 'center' }); });
  await sleep(1200);
  result.mapEndShot = await shot('map-30-of-30-far-end');
  // A fresh start of the app at 30 of 30.
  await pg.goto('about:blank');
  await pg.goto(srv.url);
  await waitMap();
  await sleep(2000);
  result.mapAfterRestart = await mapState();
  result.mapAfterRestartShot = await shot('map-30-of-30-after-a-fresh-start');
  await page.getByRole('button', { name: 'About and settings' }).tap();
  await page.getByRole('switch', { name: 'Sound' }).waitFor({ state: 'visible', timeout: 30_000 });
  await sleep(1200);
  result.aboutProgressLine = await pg.evaluate(() => document.querySelector('[data-testid="progress-line"]')?.textContent?.trim());
  result.aboutShot = await shot('about-30-of-30');
  await page.getByRole('button', { name: 'Back to levels' }).tap();
  await waitMap();
  // Level 30 opened again from the map: does it open, and what does a won level show?
  await pg.evaluate(() => document.querySelector('button[aria-label^="Level 30:"]')?.scrollIntoView({ inline: 'center', block: 'center' }));
  await sleep(1000);
  await page.getByRole('button', { name: /^Level 30: / }).tap();
  await go.waitFor({ state: 'visible', timeout: 120_000 });
  await sleep(2000);
  result.reopenShot = await shot('L30-opened-again');
  result.consoleErrors = consoleErrors;
  result.requestsToOtherHosts = requests;
  log(`console errors ${consoleErrors.length}; requests to other hosts ${requests.length}`);
  save();
  await browser.close();
  srv.close();
}
main().catch((e) => { log(`stopped: ${e?.stack ?? e}`); process.exit(1); });
