/**
 * TEST ONLY. The two backends of the runner: Appium (the app in an iOS simulator) and Chromium (the
 * same app content in a local browser, to try the runner without a Mac).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Backend, Point } from './fake-page';
import { sleep } from './fake-page';

const wrap = (src: string) =>
  `var __name = function (f) { return f; }; try { var v = (${src})(arguments[0]); return { ok: true, v: v === undefined ? null : v }; } catch (e) { return { ok: false, e: String(e && e.message ? e.name + ': ' + e.message + ' | ' + e.stack : e) }; }`;

/** Maps a point of the page to the point XCTest must touch, found by calibration (see Appium.calibrate). */
type Transform = { name: string; toDevice(p: Point): Point; toPage(p: Point): Point };

export class AppiumBackend implements Backend {
  driver: any;
  webview = '';
  transform: Transform | null = null;
  private w = 0;
  private h = 0;
  /** Every script call's time, for the report. */
  execTimes: number[] = [];
  constructor(
    readonly caps: Record<string, unknown>,
    readonly log: (s: string) => void,
  ) {}

  async start() {
    const { remote } = await import('webdriverio');
    this.driver = await remote({
      hostname: '127.0.0.1',
      port: 4723,
      path: '/',
      logLevel: 'warn',
      connectionRetryTimeout: 30 * 60_000,
      connectionRetryCount: 1,
      capabilities: this.caps as any,
    });
    // The game draws all the time: XCTest must not wait for the app to go idle before each touch.
    await this.driver.updateSettings({ waitForIdleTimeout: 0, animationCoolOffTimeout: 0, snapshotMaxDepth: 30 }).catch((e: unknown) => this.log(`settings: ${e}`));
    try {
      await this.toWebview();
    } catch (e) {
      const state = await this.driver.execute('mobile: queryAppState', { bundleId: (this.caps as any)['appium:bundleId'] }).catch((x: unknown) => `? ${x}`);
      this.log(`app state: ${state}`);
      const full = await this.driver.execute('mobile: getContexts', { waitForWebviewMs: 20000 }).catch((x: unknown) => `? ${x}`);
      this.log(`contexts in full: ${JSON.stringify(full).slice(0, 1500)}`);
      const shot = (globalThis as any).__outDir;
      if (shot) await this.screenshot(`${shot}/no-webview.png`).catch(() => undefined);
      throw e;
    }
  }

  /** Finds the app's web view and makes it the place where scripts run. */
  async toWebview(timeout = 180_000) {
    const end = Date.now() + timeout;
    for (;;) {
      const contexts: any[] = await this.driver.getContexts().catch((x: unknown) => { this.log(`getContexts: ${String(x).slice(0, 200)}`); return []; });
      const names = contexts.map((c) => (typeof c === 'string' ? c : c.id));
      const web = names.find((n) => n.startsWith('WEBVIEW'));
      if (web) {
        await this.driver.switchContext(web);
        this.webview = web;
        try {
          const ok = await this.exec<boolean>('() => !!document.body');
          if (ok) {
            this.log(`page: ${JSON.stringify(await this.exec('() => ({ href: location.href, hooks: typeof window.__appq, scene: typeof window.__taps, title: document.title })'))}`);
            await this.measure();
            return;
          }
        } catch (e) {
          this.log(`web view not ready: ${String(e).slice(0, 200)}`);
        }
      }
      if (Date.now() > end) throw new Error(`no web view found in ${timeout / 1000} s; contexts: ${names.join(', ')}`);
      await sleep(2000);
    }
  }

  async measure() {
    const s = await this.exec<{ w: number; h: number }>('() => ({ w: innerWidth, h: innerHeight })');
    this.w = s.w;
    this.h = s.h;
  }

  size() {
    return { width: this.w, height: this.h };
  }

  async exec<T>(src: string, arg?: unknown): Promise<T> {
    const t0 = Date.now();
    let r: any;
    try {
      r = await this.driver.execute(wrap(src), arg === undefined ? null : arg);
    } catch (e) {
      // A reload or a return from the background can cut the web view's link: find it again, once.
      const msg = String(e);
      if (/disconnect|No such context|context|target|page/i.test(msg)) {
        this.log(`script link lost (${msg.slice(0, 160)}); finding the web view again`);
        await this.toWebview();
        r = await this.driver.execute(wrap(src), arg === undefined ? null : arg);
      } else throw e;
    } finally {
      this.execTimes.push(Date.now() - t0);
    }
    if (!r || typeof r !== 'object' || !('ok' in r)) return r as T;
    if (!r.ok) throw new Error(`in the page: ${r.e}`);
    return r.v as T;
  }

  private device(p: Point): Point {
    return this.transform ? this.transform.toDevice(p) : p;
  }

  async tap(x: number, y: number) {
    const d = this.device({ x, y });
    await this.driver.execute('mobile: tap', { x: Math.round(d.x), y: Math.round(d.y) });
  }

  async drag(from: Point, to: Point, opts: { holdMs: number }) {
    const a = this.device(from);
    const b = this.device(to);
    await this.driver.execute('mobile: dragFromToForDuration', { duration: Math.max(0.5, opts.holdMs / 1000), fromX: a.x, fromY: a.y, toX: b.x, toY: b.y });
  }

  async screenshot(file: string) {
    const b64 = await this.driver.takeScreenshot();
    writeFileSync(file, Buffer.from(b64, 'base64'));
  }

  /**
   * XCTest's touch points and the page's points may differ by the screen's turn. A clear sheet is laid
   * over the page for a moment (so the touches press nothing), touched at two points, and the turn that
   * puts both touches where the page saw them is kept.
   */
  async calibrate(): Promise<string> {
    await this.measure();
    await this.exec(`() => { const d = document.createElement('div'); d.id = '__calib'; d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:transparent'; document.body.appendChild(d); window.__appTouches.length = 0; return true; }`);
    const W = this.w;
    const H = this.h;
    const shots: Point[] = [
      { x: Math.round(W * 0.3), y: Math.round(H * 0.4) },
      { x: Math.round(W * 0.7), y: Math.round(H * 0.75) },
    ];
    const seen: Point[] = [];
    for (const p of shots) {
      await this.driver.execute('mobile: tap', { x: p.x, y: p.y });
      await sleep(800);
      const t = await this.exec<Point[]>('() => window.__appTouches.map((t) => ({ x: t.x, y: t.y }))');
      seen.push(t[t.length - 1] ?? { x: NaN, y: NaN });
    }
    await this.exec(`() => { document.getElementById('__calib')?.remove(); window.__appTouches.length = 0; return true; }`);
    const cands: Transform[] = [
      { name: 'same', toDevice: (p) => p, toPage: (p) => p },
      { name: 'turned right', toDevice: (p) => ({ x: H - p.y, y: p.x }), toPage: (d) => ({ x: d.y, y: H - d.x }) },
      { name: 'turned left', toDevice: (p) => ({ x: p.y, y: W - p.x }), toPage: (d) => ({ x: W - d.y, y: d.x }) },
      { name: 'upside down', toDevice: (p) => ({ x: W - p.x, y: H - p.y }), toPage: (d) => ({ x: W - d.x, y: H - d.y }) },
    ];
    let best: Transform | null = null;
    let bestErr = Infinity;
    for (const c of cands) {
      const err = shots.reduce((s, p, i) => s + Math.hypot(c.toPage(p).x - seen[i].x, c.toPage(p).y - seen[i].y), 0);
      if (err < bestErr) {
        bestErr = err;
        best = c;
      }
    }
    this.transform = best && bestErr < 12 ? best : { name: 'same (calibration failed)', toDevice: (p) => p, toPage: (p) => p };
    return `touched ${JSON.stringify(shots)}, the page saw ${JSON.stringify(seen)}: ${this.transform.name} (error ${bestErr.toFixed(1)} pt)`;
  }

  /** Sends the app to the background for `seconds`, then brings it back (XCTest presses Home). */
  async background(seconds: number) {
    await this.driver.execute('mobile: backgroundApp', { seconds });
  }
  async terminate(bundleId: string) {
    await this.driver.execute('mobile: terminateApp', { bundleId });
  }
  async activate(bundleId: string) {
    await this.driver.execute('mobile: activateApp', { bundleId });
  }
  async setOrientation(o: 'PORTRAIT' | 'LANDSCAPE') {
    const ctx = this.webview;
    await this.driver.switchContext('NATIVE_APP');
    await this.driver.setOrientation(o);
    await this.driver.switchContext(ctx).catch(() => undefined);
    await sleep(2500);
    await this.measure();
  }
  async end() {
    await this.driver?.deleteSession().catch(() => undefined);
  }
}

/** Serves a folder over http on a free port. */
export function serve(dir: string): Promise<{ url: string; close(): void }> {
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
  const server = createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(dir, p);
    if (!f.startsWith(dir) || !existsSync(f) || !statSync(f).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ url: `http://127.0.0.1:${(server.address() as any).port}/`, close: () => server.close() })));
}

export class ChromiumBackend implements Backend {
  page: any;
  browser: any;
  constructor(readonly url: string, readonly vp: { width: number; height: number }) {}
  async start() {
    const { chromium } = await import('playwright-core');
    this.browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    const ctx = await this.browser.newContext({ viewport: this.vp, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    this.page = await ctx.newPage();
    await this.page.goto(this.url);
  }
  size() {
    return this.vp;
  }
  async exec<T>(src: string, arg?: unknown): Promise<T> {
    const r = await this.page.evaluate(([s, a]: [string, unknown]) => new Function(s).call(null, a), [wrap(src), arg ?? null]);
    if (!r.ok) throw new Error(`in the page: ${r.e}`);
    return r.v as T;
  }
  async tap(x: number, y: number) {
    await this.page.touchscreen.tap(x, y);
  }
  async drag(from: Point, to: Point, opts: { steps: number; stepMs: number; holdMs: number }) {
    const cdp = await this.page.context().newCDPSession(this.page);
    const touch = (type: string, p?: Point) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }] : [] });
    await touch('touchStart', from);
    await sleep(opts.holdMs);
    for (let i = 1; i <= opts.steps; i++) {
      await touch('touchMove', { x: from.x + ((to.x - from.x) * i) / opts.steps, y: from.y + ((to.y - from.y) * i) / opts.steps });
      await sleep(opts.stepMs);
    }
    await touch('touchEnd');
    await cdp.detach();
  }
  async screenshot(file: string) {
    await this.page.screenshot({ path: file });
  }
  async reload() {
    await this.page.reload();
  }
  async end() {
    await this.browser?.close();
  }
}
