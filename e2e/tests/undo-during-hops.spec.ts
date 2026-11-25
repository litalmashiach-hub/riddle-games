import type { Page } from '@playwright/test';
import { expect, passRulesCard, test, waitForSession } from './fixtures';

/**
 * Undo while the duck is still hopping. In Log Jam and Timber Tangle (one scene, levels/18-log-jam) a loss
 * plays out as a short scene: Dottie quacks, hops along the logs with a boing at each hop, slips and splashes.
 * A player who takes the loss back with Undo during the hops must hear no boing of that loss afterwards.
 *
 * The undo is made in two ways, because the game redraws the scene differently for each:
 *  - a press of Z on a keyboard, a real input. React redraws the scene inside the event itself;
 *  - a click made by a script at a set moment of the scene. To React that is no input, so the scene is redrawn
 *    a moment later, and its effects are cleaned up only after the next drawn frame. On a slow device that
 *    frame can take a second. This is the way that shows a sound which waits on an effect's cleanup.
 *
 * Each undo is tried at several moments of the hops, since one try can fall between two boings by luck.
 * The page listens to what the game starts to play (nobody hears it): a boing is a sine tone from 180 to 720 Hz.
 *
 * It runs at the phone's size and on a very small page. Drawn in software, the phone's size gives about six
 * frames a second and the small page about twenty; the faults of a late cleanup differ between the two.
 */

const LEVELS = [
  { id: 'log-jam', number: 18, title: 'Log Jam' },
  { id: 'timber-tangle', number: 27, title: 'Timber Tangle' },
];

/** The hops take 1.4 s of the scene, from 0.9 s after its first quack (PHASES and HOPS_MS in the scene). */
const HOPS_FROM_MS = 900;
const HOPS_MS = 1400;

/**
 * A boing that starts this soon after the undo is not counted. An undo that is no real input reaches the scene
 * one redraw late (see above), and a frame drawn in between can start a hop: measured, such a boing starts 1 or
 * 2 ms after the undo, in the same instant to the ear. A real tap or key press leaves no such gap. Every fault
 * this test is for starts later: 140 ms and more after the undo, most of them about a second.
 */
const SAME_INSTANT_MS = 40;

/** Listens to every tone the page starts, and marks the first quack of a loss scene. */
function listen() {
  const q = ((window as any).__hops = { tones: [] as { at: number; sig: string }[], sceneAt: 0, undoAt: 0, onScene: null as null | (() => void) });
  const param = AudioParam.prototype as any;
  for (const fn of ['setValueAtTime', 'exponentialRampToValueAtTime']) {
    const real = param[fn];
    param[fn] = function (this: any, v: number, t: number) {
      (this.__set ||= []).push(v);
      return real.call(this, v, t);
    };
  }
  const start = AudioScheduledSourceNode.prototype.start;
  AudioScheduledSourceNode.prototype.start = function (this: any, ...a: any[]) {
    if (this instanceof OscillatorNode) {
      const sig = `${this.type} ${(((this.frequency as any).__set as number[]) || []).map((x) => Math.round(x)).join('>')}`;
      const now = performance.now();
      const s = window.__riddle?.getState();
      // The scene's first quack: a sawtooth from 416 Hz, once the losing move has finished.
      if (!q.sceneAt && s && s.status.kind === 'lost' && !s.busy && /^sawtooth 416/.test(sig)) {
        q.sceneAt = now;
        q.onScene?.();
      }
      q.tones.push({ at: now, sig });
    }
    return start.apply(this, a as any);
  };
  // The page's own timer, kept apart from anything a test might do to the clock.
  (q as any).later = window.setTimeout.bind(window);
}

/** Sets the position one move before a loss, at once, and returns the losing move. */
async function oneMoveFromLoss(page: Page) {
  const move = await page.evaluate(() => {
    const store = window.__riddle as any;
    const rules = store.getState().level.rules;
    // These levels are lost by running out of moves: a fixed walk that never wins, until a move would lose.
    let state = rules.initialState;
    const path: unknown[] = [];
    let seed = 11;
    const pick = (n: number) => ((seed = (seed * 48271) % 2147483647), seed % n);
    for (let i = 0; i < 2000; i++) {
      const moves = rules.legalMoves(state).map((m: unknown) => ({ m, after: rules.apply(state, m) }));
      const losing = moves.find((x: any) => rules.status(x.after).kind === 'lost');
      if (losing) {
        const history = [rules.initialState];
        for (const m of path) history.push(rules.apply(history[history.length - 1], m));
        store.setState({ history, moves: path, future: [], status: rules.status(state), hint: null });
        store.subscribe((now: any, was: any) => {
          if (now.moves.length < was.moves.length) (window as any).__hops.undoAt = performance.now();
        });
        return losing.m;
      }
      const going = moves.filter((x: any) => rules.status(x.after).kind === 'playing');
      const next = going[pick(going.length)];
      path.push(next.m);
      state = next.after;
    }
    return null;
  });
  expect(move, 'a move that loses the level').not.toBeNull();
  return move;
}

/** Starts listening afresh. `clickUndoAtMs`: the page itself clicks the bar's Undo this long after the scene's first quack. */
async function arm(page: Page, clickUndoAtMs?: number) {
  await page.evaluate((ms) => {
    const q = (window as any).__hops;
    q.tones = [];
    q.sceneAt = 0;
    q.undoAt = 0;
    q.onScene =
      ms == null
        ? null
        : () =>
            q.later(() => {
              const undo = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Undo')!;
              undo.click();
            }, ms);
  }, clickUndoAtMs);
}

const sceneBegun = (page: Page) => page.waitForFunction(() => (window as any).__hops.sceneAt > 0, undefined, { polling: 50, timeout: 60_000 });

/** The boings of the loss scene, in ms from the undo (or from the scene's first quack, if there was no undo). */
async function boings(page: Page) {
  return page.evaluate(() => {
    const q = (window as any).__hops;
    const from = q.undoAt || q.sceneAt;
    const all = q.tones.filter((t: any) => t.sig === 'sine 180>720' && t.at >= q.sceneAt).map((t: any) => Math.round(t.at - from));
    return { undoMs: q.undoAt ? Math.round(q.undoAt - q.sceneAt) : null, before: all.filter((ms: number) => ms <= 0).length, after: all.filter((ms: number) => ms > 0) as number[], all: all as number[] };
  });
}

/** Two boings that start together are one fault: timers that fell due during one slow frame. */
const together = (times: number[]) => times.some((t, i) => i > 0 && t - times[i - 1] <= 5);

function undoDuringTheHops(level: (typeof LEVELS)[number]) {
  return async ({ page }: { page: Page }) => {
    await page.addInitScript(listen);
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    await passRulesCard(page, level.title);
    // The camera's opening glide, and the scene's first frames.
    await page.waitForTimeout(3000);
    const losing = await oneMoveFromLoss(page);
    await page.waitForTimeout(2500);

    // 1. A loss left alone: its boings, one a hop, and the loss card. This is what an undo must not cut short later.
    await arm(page);
    await page.evaluate((m) => (window.__riddle as any).getState().play(m), losing);
    await sceneBegun(page);
    await expect(page.getByRole('heading', { name: 'Oh no!' })).toBeVisible({ timeout: 60_000 });
    const whole = await boings(page);
    expect(whole.all.length, 'the loss has at least one hop, each with a boing').toBeGreaterThanOrEqual(1);
    expect(together(whole.all), `a loss left alone: no two boings at once (${whole.all} ms)`).toBe(false);
    const hops = whole.all.length;
    await page.evaluate(() => (window.__riddle as any).getState().undo());
    await page.waitForTimeout(2000);

    // 2. The loss again and again (Redo), each time undone at another moment of the hops.
    const share = HOPS_MS / hops;
    const moments: { ms: number; by: 'click' | 'key' }[] = [];
    // Just into the hops, before the first boing; then a little after each hop has begun, while a later one is due.
    for (const into of hops === 1 ? [40, 90, 140, 180] : [40, 140, share + 120, share + 250, 2 * share + 120, 2 * share + 250].filter((x) => x < HOPS_MS - share / 2)) {
      moments.push({ ms: HOPS_FROM_MS + Math.round(into), by: 'click' });
    }
    moments.push({ ms: HOPS_FROM_MS + 60, by: 'key' }, { ms: HOPS_FROM_MS + Math.round(hops === 1 ? 150 : share + 150), by: 'key' });

    const tries: { ms: number; by: string; undoMs: number | null; before: number; after: number[] }[] = [];
    for (const { ms, by } of moments) {
      await arm(page, by === 'click' ? ms : undefined);
      await page.evaluate(() => (window.__riddle as any).getState().redo());
      await sceneBegun(page);
      if (by === 'key') {
        const waited = await page.evaluate(() => performance.now() - (window as any).__hops.sceneAt);
        if (ms > waited) await page.waitForTimeout(ms - waited);
        await page.keyboard.press('z');
      }
      await page.waitForFunction(() => (window as any).__hops.undoAt > 0, undefined, { timeout: 60_000 });
      // Past the rest of the hops, and past a slow frame or two.
      await page.waitForTimeout(3500);
      const heard = await boings(page);
      expect(await page.evaluate(() => (window.__riddle as any).getState().status.kind), 'the loss is taken back').toBe('playing');
      tries.push({ ms, by, undoMs: heard.undoMs, before: heard.before, after: heard.after });
    }

    const said = tries.map((t) => `${t.by} at ${t.undoMs} ms, ${t.before} of ${hops} boings before it, after it: [${t.after}] ms`).join('\n');
    const stillDue = tries.filter((t) => t.before < hops);
    expect(stillDue.length, `tries where a hop was still due at the undo\n${said}`).toBeGreaterThanOrEqual(3);
    const faults: string[] = [];
    for (const t of tries) {
      const late = t.after.filter((x) => x > SAME_INSTANT_MS);
      if (late.length) faults.push(`a boing ${late.join(' and ')} ms after the undo (${t.by} at ${t.undoMs} ms into the scene)`);
      else if (t.after.length > 1) faults.push(`${t.after.length} boings in the undo's own instant (${t.by} at ${t.undoMs} ms into the scene)`);
    }
    expect(faults, `no boing follows an undo\n${said}`).toEqual([]);

    // 3. The loss once more, left alone: it sounds whole again, and its card comes.
    await arm(page);
    await page.evaluate(() => (window.__riddle as any).getState().redo());
    await sceneBegun(page);
    await expect(page.getByRole('heading', { name: 'Oh no!' })).toBeVisible({ timeout: 60_000 });
    const again = await boings(page);
    expect(again.all.length, `a loss after the undos has all its boings (${again.all} ms)`).toBe(hops);
    expect(together(again.all), `and no two at once (${again.all} ms)`).toBe(false);
  };
}

for (const level of LEVELS) {
  const nn = String(level.number).padStart(2, '0');
  test(`level ${nn} ${level.id}: Undo during the hops leaves no boing to come`, undoDuringTheHops(level));
}

test.describe('on a small page, which draws faster', () => {
  // No phone is this small. Drawn in software it gives about twenty frames a second instead of six, and a
  // cleanup that comes a frame late then shows as late and doubled boings, not as early ones.
  test.use({ viewport: { width: 200, height: 112 } });
  for (const level of LEVELS) {
    const nn = String(level.number).padStart(2, '0');
    test(`level ${nn} ${level.id}: Undo during the hops leaves no boing to come`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'iphone-landscape', 'one run at this size is enough');
      await undoDuringTheHops(level)({ page });
    });
  }
});
