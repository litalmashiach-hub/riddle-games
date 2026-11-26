/**
 * TEST ONLY. Looks that are not a level: stars kept over a restart, the launch, the About screen's
 * pages, the card when a scene can't be drawn, a return from the background mid-level, and the
 * level map's measures. Every press is a real touch; the run's scripts only read, apart from the one
 * that takes the 3D context away (the way iOS can), which is said where it happens.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEVELS } from '../levels';
import { AppiumBackend } from './backends';
import { sleep, type Backend, type FakePage } from './fake-page';

interface Ctx {
  page: FakePage;
  backend: Backend;
  run: { reload(): Promise<void>; relaunch(): Promise<void> };
  device: string;
  out: string;
  shot(name: string): Promise<string>;
  log(s: string): void;
  bundleId: string;
  waitMap(timeout?: number): Promise<void>;
}

export async function extras(c: Ctx) {
  const found: Record<string, unknown> = {};
  const save = () => writeFileSync(join(c.out, 'extras.json'), JSON.stringify(found, null, 1));
  const step = async (name: string, fn: () => Promise<unknown>) => {
    c.log(`extras: ${name}`);
    try {
      found[name] = await fn();
    } catch (e) {
      found[name] = { error: String(e instanceof Error ? e.message : e).slice(0, 800) };
      c.log(`extras: ${name} failed: ${e}`);
      await c.shot(`extra-${name}-error`);
      try {
        await c.run.relaunch();
        await c.waitMap();
      } catch {
        /* the next step will say */
      }
    }
    save();
  };
  const toMap = async () => {
    const all = c.page.getByRole('button', { name: 'All levels', exact: true });
    if (await all.isVisible()) {
      await all.tap();
      await sleep(2000);
    }
    const back = c.page.getByRole('button', { name: 'Back to levels' });
    for (let i = 0; i < 3 && (await back.isVisible()); i++) {
      await back.tap();
      await sleep(2000);
    }
    await c.waitMap();
  };
  const appium = c.backend instanceof AppiumBackend ? c.backend : null;

  await step('stars-over-restart', async () => {
    await toMap();
    const read = () =>
      c.page.evaluate(() => ({
        header: Array.from(document.querySelectorAll('header span')).map((s) => s.textContent?.trim()).find((t) => /^\d+ \/ \d+$/.test(t ?? '')) ?? null,
        saved: localStorage.getItem('riddle-games:progress:v1'),
      }));
    const before = await read();
    const s1 = await c.shot('extra-map-before-restart');
    await c.run.relaunch();
    await c.waitMap();
    await sleep(1500);
    const after = await read();
    const s2 = await c.shot('extra-map-after-restart');
    return { before: before.header, after: after.header, savedSame: before.saved === after.saved, shots: [s1, s2] };
  });

  await step('launch', async () => {
    if (!appium) return 'not on this backend';
    // From a cold start: pictures every second or so, before the web view is even asked for.
    await appium.terminate(c.bundleId);
    await sleep(2000);
    const t0 = Date.now();
    await appium.driver.execute('mobile: launchApp', { bundleId: c.bundleId }).catch(() => appium.activate(c.bundleId));
    const shots: { at: number; file: string }[] = [];
    for (let i = 0; i < 10; i++) {
      shots.push({ at: (Date.now() - t0) / 1000, file: await c.shot(`extra-launch-${String(i).padStart(2, '0')}`) });
      await sleep(700);
    }
    await appium.toWebview();
    await c.waitMap();
    return { mapAfter: (Date.now() - t0) / 1000, shots };
  });

  await step('level-map', async () => {
    await toMap();
    await sleep(1000);
    const m = await c.page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('button[aria-label^="Level "]')).map((b) => {
        const r = b.getBoundingClientRect();
        return { label: b.getAttribute('aria-label'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      });
      const inView = cards.filter((k) => k.x >= 0 && k.y >= 0 && k.x + k.w <= innerWidth && k.y + k.h <= innerHeight);
      const cols = new Set(cards.map((k) => k.x)).size;
      const rows = new Set(cards.map((k) => k.y)).size;
      const scrollers = Array.from(document.querySelectorAll('*')).filter((e) => {
        const cs = getComputedStyle(e);
        return (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth) || (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight);
      }).map((e) => ({ tag: e.tagName, cls: (e.className as any)?.toString().slice(0, 60), scrollW: e.scrollWidth, clientW: e.clientWidth, scrollH: e.scrollHeight, clientH: e.clientHeight }));
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const safe = { top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft };
      probe.remove();
      const widths = cards.map((k) => k.w).sort((a, b) => a - b);
      return { screen: { w: innerWidth, h: innerHeight }, safe, cards: cards.length, cardsFullyInView: inView.length, distinctColumns: cols, distinctRows: rows, cardWidth: { min: widths[0], max: widths[widths.length - 1] }, cardHeight: cards[0]?.h, scrollers, first: cards[0], last: cards[cards.length - 1] };
    });
    m['shot'] = await c.shot('extra-level-map');
    return m;
  });

  await step('about', async () => {
    await toMap();
    await c.page.getByRole('button', { name: 'About and settings' }).tap();
    await c.page.getByRole('tab', { name: 'Settings' }).waitFor({ state: 'visible', timeout: 20_000 });
    await sleep(1200);
    const pages: Record<string, unknown> = {};
    const tabs = (await c.page.evaluate(() => Array.from(document.querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim() ?? ''))) as string[];
    for (const t of tabs) {
      await c.page.getByRole('tab', { name: t, exact: true }).tap();
      await sleep(1200);
      const measure = () =>
        c.page.evaluate(() => {
          const p = document.querySelector('[role=tabpanel]') as HTMLElement;
          const r = p.getBoundingClientRect();
          const all = Array.from(document.querySelectorAll('button, a, [role=tab], [role=switch], h1')).map((e) => {
            const b = e.getBoundingClientRect();
            return { what: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), x0: Math.round(b.x), y0: Math.round(b.y), x1: Math.round(b.right), y1: Math.round(b.bottom) };
          }).filter((b) => b.x1 > b.x0);
          const out = all.filter((b) => b.x0 < 0 || b.y0 < 0 || b.x1 > innerWidth || b.y1 > innerHeight);
          return { panel: { x0: Math.round(r.x), y0: Math.round(r.y), x1: Math.round(r.right), y1: Math.round(r.bottom) }, screen: { w: innerWidth, h: innerHeight }, scrollTop: p.scrollTop, scrollHeight: p.scrollHeight, clientHeight: p.clientHeight, offScreen: out };
        });
      const m1 = await measure();
      const shotTop = await c.shot(`extra-about-${t.toLowerCase()}`);
      let scrolled: unknown = 'nothing to scroll';
      if ((m1 as any).scrollHeight > (m1 as any).clientHeight + 4) {
        // A finger's swipe up inside the page.
        const pr = (m1 as any).panel;
        const x = (pr.x0 + pr.x1) / 2;
        await c.backend.drag({ x, y: pr.y1 - 30 }, { x, y: pr.y0 + 30 }, { steps: 10, stepMs: 30, holdMs: 100 });
        await sleep(1500);
        const m2 = await measure();
        scrolled = { before: (m1 as any).scrollTop, after: (m2 as any).scrollTop, of: (m1 as any).scrollHeight - (m1 as any).clientHeight };
        await c.shot(`extra-about-${t.toLowerCase()}-after-swipe`);
      }
      const entry: Record<string, unknown> = { measure: m1, scrolled, shot: shotTop };
      if (t === 'Contact') {
        const mail = c.page.getByRole('link', { name: 'Write an email' });
        if (await mail.isVisible()) {
          await mail.tap();
          await sleep(4000);
          entry['emailTap'] = { shot: await c.shot('extra-about-contact-after-email-tap'), appStillAnswers: await c.page.evaluate(() => !!document.querySelector('[role=tablist]')).catch((e) => `no: ${e}`) };
          if (appium) {
            const state = await appium.driver.execute('mobile: queryAppState', { bundleId: c.bundleId }).catch(() => null);
            entry['appStateAfterEmailTap'] = state;
            if (state !== 4) {
              await appium.activate(c.bundleId);
              await appium.toWebview();
            }
          }
        } else entry['emailTap'] = 'no "Write an email" button on this build';
      }
      pages[t] = entry;
    }
    await c.page.getByRole('button', { name: 'Back to levels' }).tap();
    await c.waitMap();
    return pages;
  });

  /** Opens level 1 from the map by touch and passes its rules card. */
  const openLevel1 = async () => {
    await toMap();
    const card = c.page.getByRole('button', { name: 'Level 1: Wolf and Two Sheep', exact: true });
    const b = await card.boundingBox();
    const { width, height } = c.backend.size();
    if (!b || b.x < 0 || b.y < 0 || b.x + b.width > width || b.y + b.height > height) {
      // Brought into view by a finger's swipes along the map, as a player would.
      for (let i = 0; i < 12; i++) {
        const now = await card.boundingBox();
        if (now && now.x >= 0 && now.y >= 0 && now.x + now.width <= width && now.y + now.height <= height) break;
        const left = now ? now.x < 0 : false;
        const up = now ? now.y < 0 : false;
        const sideways = width > height;
        const from = { x: width / 2, y: height / 2 };
        const to = sideways ? { x: width / 2 + (left ? 1 : -1) * width * 0.35, y: height / 2 } : { x: width / 2, y: height / 2 + (up ? 1 : -1) * height * 0.3 };
        await c.backend.drag(from, to, { steps: 10, stepMs: 25, holdMs: 80 });
        await sleep(900);
      }
    }
    await card.tap();
    const go = c.page.getByRole('button', { name: "Let's go!" });
    await go.waitFor({ state: 'visible', timeout: 120_000 });
    await sleep(1000);
    await go.tap();
    await c.page.waitForFunction(() => (window as any).__taps?.ready(), undefined, { timeout: 120_000 });
    await sleep(2500);
  };

  await step('background-mid-level', async () => {
    if (!appium) return 'not on this backend';
    await openLevel1();
    // One move through the debug hook, so there is a state to keep: it is read before and after.
    await c.page.evaluate((m) => (window as any).__riddle.getState().play(m), LEVELS[0].moves[0]);
    await sleep(4000);
    const before = await c.page.evaluate(() => ({ moves: (window as any).__riddle.getState().moves.length }));
    const s1 = await c.shot('extra-background-before');
    await appium.background(6);
    await sleep(1500);
    const s2 = await c.shot('extra-background-back-1s');
    await appium.toWebview();
    await sleep(5000);
    const after = await c.page.evaluate(() => ({
      moves: (window as any).__riddle.getState().moves.length,
      ready: !!(window as any).__taps.ready(),
      card: /didn't draw the 3D scene/.test(document.body.innerText),
      lost: (() => {
        const cv = document.querySelector('canvas') as HTMLCanvasElement | null;
        const gl = (cv?.getContext('webgl2') || cv?.getContext('webgl')) as WebGLRenderingContext | null;
        return gl ? gl.isContextLost() : 'no context';
      })(),
    }));
    const s3 = await c.shot('extra-background-back-6s');
    const faults = await c.page.evaluate(() => ({ ...(window as any).__appFaults }));
    return { before, after, shots: [s1, s2, s3], consoleErrors: (faults as any).consoleErrors, pageErrors: (faults as any).pageErrors };
  });

  await step('scene-error-card', async () => {
    await toMap();
    await openLevel1();
    const s0 = await c.shot('extra-error-card-before');
    // The one thing the run does to the page: it takes the 3D context away, as iOS can under memory pressure.
    const lost = await c.page.evaluate(() => {
      const cv = document.querySelector('canvas') as HTMLCanvasElement;
      const gl = (cv.getContext('webgl2') || cv.getContext('webgl')) as WebGLRenderingContext | null;
      const ext = gl?.getExtension('WEBGL_lose_context');
      if (!ext) return 'no WEBGL_lose_context';
      ext.loseContext();
      return 'lost';
    });
    const t0 = Date.now();
    const card = c.page.getByRole('button', { name: 'Try again' });
    await card.waitFor({ state: 'visible', timeout: 30_000 });
    const shownAfter = (Date.now() - t0) / 1000;
    await sleep(1000);
    const s1 = await c.shot('extra-error-card');
    const text = await c.page.evaluate(() => document.body.innerText.split('\n').filter((l) => /draw|Try again|Back/.test(l)).slice(0, 6));
    await card.tap();
    const t1 = Date.now();
    await c.page.waitForFunction(() => (window as any).__taps?.ready() && !document.querySelector('[role=status][aria-label="Loading level"]'), undefined, { timeout: 120_000 });
    const redrawnAfter = (Date.now() - t1) / 1000;
    await sleep(2500);
    const s2 = await c.shot('extra-error-card-after-try-again');
    const moves = await c.page.evaluate(() => (window as any).__riddle.getState().moves.length);
    return { lost, cardShownAfterSeconds: shownAfter, text, redrawnAfterSeconds: redrawnAfter, movesKept: moves, shots: [s0, s1, s2] };
  });

  await step('back-to-map', async () => {
    await toMap();
    return 'ok';
  });
  return found;
}
