import type { Page } from '@playwright/test';
import { LEVELS } from '../levels';
import { lossCases } from '../loss-paths';
import { expect, passRulesCard, playMove, test, waitForSession } from './fixtures';

/**
 * Leaving the game and coming back: another app, the lock screen, a call. Every level is left five times:
 * at rest in both orders of leaving (below), in the middle of a move, in the middle of a loss, and in the
 * middle of the winning move; and then a call comes in during a loss.
 *
 * There is no iPhone here, and a test browser's page cannot really be sent away. So the test stands in for
 * the system, inside the page, and does to the game what a hidden app has done to it (`phone`, below):
 *
 * - the page is told that it is hidden, and a moment later everything stops: no timer runs and no frame is
 *   drawn, while the clock goes on. The sound engines are stopped from outside, as the system does;
 * - after AWAY_MS all of it starts again at once: every timer whose time has passed runs, the next frame
 *   sees a clock that jumped, and the page is told that it is shown. Nobody resumes the sound engines but
 *   the game: after an interruption WebKit leaves an engine "suspended", or, in the other variant played
 *   here, still "interrupted" until the page asks it to resume.
 * - the order of leaving is played both ways. "Hidden first": the page hears that it is hidden, and the sound
 *   stops a moment later. "Interrupted first", the usual order on an iPhone: the system interrupts the sound
 *   as the app goes, then the page is hidden. Only that order leaves an engine "interrupted" that the game
 *   had not suspended itself, so only it shows whether the game wakes such an engine.
 *
 * Nobody listens. The test watches the browser's own function that starts a sound, and whether that sound
 * is still connected to anything: one that is not is never heard. After each return:
 *
 * 1. nothing may be heard of what the game asked for while it was away or while it caught up (the timers
 *    that were due, and everything before the first frame after the return was done), and no sound that
 *    was sounding or waiting when the engine stopped may still be waiting to go on;
 * 2. the level must not be stuck: the scene is drawn again, the move is finished and kept, a loss shows its
 *    card, Undo works by touch;
 * 3. the next tap must sound, on an engine that is running, with its clock going;
 * 4. a win that comes in the first moment after the return is heard: its card comes, and its fanfare is
 *    played once the game has caught up, not dropped with the late sounds.
 *
 * Every move here is played through the game's own store, and every tap with Playwright's touch (a real
 * touch event from the browser, not a click made by script in the page).
 *
 * What this cannot show is in docs/play-through-tests.md: how iOS itself stops and restarts sound.
 */

/** How long the game is away: longer than any move or loss scene. */
const AWAY_MS = 5000;

type SoundState = 'suspended' | 'interrupted';

interface Sound {
  at: number;
  name: string;
  /** Asked for while the page was hidden. */
  hidden: boolean;
  /** Asked for by a timer whose time passed while the game was away. */
  late: boolean;
  /** Asked for after a return, before the first frame after it was done. */
  catchingUp: boolean;
  /** The engine's state when the sound was asked for, as the game sees it. */
  state: string;
}
interface Phone {
  sounds: (Sound & { node: AudioNode & { __outs?: number; __over?: boolean }; context: BaseAudioContext })[];
  awayAt: number;
  backAt: number;
  hide(): void;
  /** The system stops everything: timers, frames and sound. */
  stop(sound: SoundState): void;
  /** The system stops timers and frames, and leaves the sound as it is. */
  freeze(): void;
  /** Everything starts again. `eventFirst`: the page hears that it is shown before its late timers run. */
  comeBack(eventFirst: boolean): void;
  /** A call comes in: the sound engines are interrupted, and the page stays shown and running. */
  interrupt(): void;
  endInterruption(): void;
  /** What a return, or a call, left to be heard that should not be. */
  report(from: number, to: number): { asked: number; heardLate: string[]; heardInterrupted: string[]; leftover: string[] };
  /** The first sound asked for since `from` that reaches a speaker, and its engine. */
  heardSince(from: number): { name: string; state: string; clock: number } | null;
  /** The engines' true states. */
  engines(): string[];
}
declare global {
  interface Window {
    __phone: Phone;
  }
}

/** Runs in the page before the game starts. */
function phone() {
  const realSetTimeout = window.setTimeout.bind(window) as (fn: () => void, ms?: number) => number;
  const realSetInterval = window.setInterval.bind(window) as (fn: () => void, ms?: number) => number;
  const realRaf = window.requestAnimationFrame.bind(window);
  const realState = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'state')!.get as (this: BaseAudioContext) => string;
  const realResume = AudioContext.prototype.resume;
  const realSuspend = AudioContext.prototype.suspend;

  let stopped = false;
  let hidden = false;
  let lateTimer = false;
  let framesSinceBack = 99;
  const waitingTimers: { due: number; fn: () => void }[] = [];
  const waitingFrames: FrameRequestCallback[] = [];
  const contexts: AudioContext[] = [];
  const interrupted = new Set<BaseAudioContext>();

  // ---- Timers and frames that can be stopped ----
  window.setTimeout = function (fn: TimerHandler, ms?: number, ...args: unknown[]) {
    if (typeof fn !== 'function') return realSetTimeout(fn as unknown as () => void, ms);
    const due = performance.now() + (ms ?? 0);
    return realSetTimeout(() => (stopped ? void waitingTimers.push({ due, fn: () => fn(...args) }) : fn(...args)), ms);
  } as typeof window.setTimeout;
  window.setInterval = function (fn: TimerHandler, ms?: number, ...args: unknown[]) {
    if (typeof fn !== 'function') return realSetInterval(fn as unknown as () => void, ms);
    let missed = false;
    return realSetInterval(() => {
      if (!stopped) return fn(...args);
      // However many turns were missed, one is made up for.
      if (!missed) waitingTimers.push({ due: performance.now(), fn: () => ((missed = false), fn(...args)) });
      missed = true;
    }, ms);
  } as typeof window.setInterval;
  let frameStamp = -1;
  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    realRaf((stamp) => {
      if (stopped) return void waitingFrames.push(cb);
      if (stamp !== frameStamp) {
        frameStamp = stamp;
        // Counted when all of this frame's callbacks have run.
        realSetTimeout(() => framesSinceBack++, 0);
      }
      cb(stamp);
    });

  // ---- The page's view of itself ----
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  const tell = () => document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

  // ---- The sound engines ----
  const Real = window.AudioContext;
  window.AudioContext = class extends Real {
    constructor(options?: AudioContextOptions) {
      super(options);
      contexts.push(this);
    }
  };
  // An interrupted engine says so, until the page asks it to resume: that ends the interruption (WebKit's
  // LayoutTests/webaudio/audiocontext-state-interrupted.html, "resume() while interrupted").
  Object.defineProperty(AudioContext.prototype, 'state', {
    configurable: true,
    get(this: AudioContext) {
      return interrupted.has(this) ? 'interrupted' : realState.call(this);
    },
  });
  AudioContext.prototype.resume = function (this: AudioContext) {
    interrupted.delete(this);
    return realResume.call(this);
  };
  const systemStopsSound = (as: SoundState) => {
    // Each time away is judged by itself: an engine that an earlier return left interrupted is only suspended.
    interrupted.clear();
    for (const c of contexts) {
      // An engine that the page has already suspended is not interrupted (the standard says so).
      if (realState.call(c) !== 'running') continue;
      if (as === 'interrupted') interrupted.add(c);
      void realSuspend.call(c);
    }
  };

  // ---- What is asked for, and whether it can be heard ----
  type Node = AudioNode & { __outs?: number; __over?: boolean };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (this: Node, ...args: unknown[]) {
    this.__outs = (this.__outs ?? 0) + 1;
    return (connect as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof AudioNode.prototype.connect;
  const disconnect = AudioNode.prototype.disconnect;
  AudioNode.prototype.disconnect = function (this: Node, ...args: unknown[]) {
    if (args.length === 0) this.__outs = 0;
    return (disconnect as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof AudioNode.prototype.disconnect;

  const lines = (from: number, to: number) => (new Error().stack ?? '').split('\n').slice(from, to);
  for (const proto of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype, OscillatorNode.prototype]) {
    if (!Object.prototype.hasOwnProperty.call(proto, 'start')) continue;
    const start = proto.start as (this: AudioScheduledSourceNode, ...args: number[]) => void;
    proto.start = function (this: AudioScheduledSourceNode & Node, ...args: number[]) {
      // The game's functions that asked for the sound, nearest first. Names of two letters are the build's own.
      const name = lines(2, 12)
        .map((l) => l.match(/at (?:async )?(?:Object\.)?([\w$.<>]+)(?: \[as \w+\])? \(/)?.[1])
        .filter((n): n is string => !!n && n.length > 2 && !/start$|^fn$|^fire$/.test(n) && !n.includes('<anonymous>'))
        .slice(0, 2)
        .join('<');
      this.addEventListener('ended', () => (this.__over = true), { once: true });
      P.sounds.push({ at: performance.now(), name: name || '?', hidden, late: lateTimer, catchingUp: framesSinceBack < 1, state: this.context.state, node: this, context: this.context });
      return start.apply(this, args);
    };
  }

  const P: Phone = (window.__phone = {
    sounds: [],
    awayAt: 0,
    backAt: 0,
    hide() {
      P.awayAt = performance.now();
      hidden = true;
      tell();
    },
    stop(sound) {
      stopped = true;
      systemStopsSound(sound);
    },
    freeze() {
      stopped = true;
    },
    comeBack(eventFirst) {
      const show = () => {
        hidden = false;
        tell();
      };
      stopped = false;
      P.backAt = performance.now();
      framesSinceBack = 0;
      if (eventFirst) show();
      for (const t of waitingTimers.splice(0).sort((a, b) => a.due - b.due)) {
        realSetTimeout(() => {
          lateTimer = true;
          try {
            t.fn();
          } finally {
            lateTimer = false;
          }
        }, 0);
      }
      if (!eventFirst) realSetTimeout(show, 0);
      for (const cb of waitingFrames.splice(0)) window.requestAnimationFrame(cb);
    },
    interrupt() {
      P.awayAt = performance.now();
      systemStopsSound('interrupted');
    },
    endInterruption() {
      // Nobody asked for more: the engines are left suspended ("running AudioContexts will not resume after an
      // interruption ends", the same WebKit test).
      interrupted.clear();
      P.backAt = performance.now();
    },
    report(from, to) {
      const heard = (s: (typeof P.sounds)[number]) => (s.node.__outs ?? 0) > 0;
      const asked = P.sounds.filter((s) => s.at >= from && s.at < to);
      const names = (list: typeof P.sounds) => list.map((s) => s.name);
      return {
        asked: asked.length,
        heardLate: names(asked.filter((s) => heard(s) && (s.hidden || s.late || s.catchingUp))),
        heardInterrupted: names(asked.filter((s) => heard(s) && s.state === 'interrupted')),
        leftover: names(P.sounds.filter((s) => s.at < from && heard(s) && !s.node.__over)),
      };
    },
    heardSince(from) {
      const s = P.sounds.find((x) => x.at >= from && (x.node.__outs ?? 0) > 0);
      return s ? { name: s.name, state: realState.call(s.context), clock: s.context.currentTime } : null;
    },
    engines: () => contexts.map((c) => realState.call(c)),
  });
}

const state = (page: Page) =>
  page.evaluate(() => {
    const s = window.__riddle!.getState();
    return { moves: s.moves.length as number, kind: s.status.kind as string, busy: s.busy as boolean, ended: s.ended as boolean };
  });

/**
 * The scene is being drawn: a frame that has just been drawn holds a picture, not one flat colour. Read from
 * the canvas itself, right after the scene's own drawing in the same frame (a screenshot may miss a frame).
 */
async function expectSceneDrawn(page: Page, what: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<number>((done) => {
              requestAnimationFrame(() => {
                const canvas = document.querySelector('canvas');
                const gl = (canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')) as WebGL2RenderingContext | null | undefined;
                if (!canvas || !gl || gl.isContextLost()) return done(0);
                const colours = new Set<number>();
                const px = new Uint8Array(4);
                for (let x = 1; x < 12; x++) {
                  for (let y = 1; y < 8; y++) {
                    gl.readPixels(Math.floor((canvas.width * x) / 12), Math.floor((canvas.height * y) / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                    colours.add((px[0] << 16) | (px[1] << 8) | px[2]);
                  }
                }
                done(colours.size);
              });
            }),
        ),
      { message: `${what}: the scene is drawn (colours found at 77 points of a fresh frame)`, timeout: 15_000 },
    )
    .toBeGreaterThan(8);
}

type Order = 'hidden first' | 'interrupted first';

/** Away and back. "Interrupted first" always leaves the engines "interrupted", whatever `sound` says. */
async function awayAndBack(page: Page, sound: SoundState, eventFirst: boolean, order: Order = 'hidden first') {
  if (order === 'interrupted first') {
    // The app goes: its sound is interrupted, then the page hears that it is hidden.
    const at = await page.evaluate(() => (window.__phone.interrupt(), window.__phone.awayAt));
    await page.waitForTimeout(100);
    await page.evaluate((t) => (window.__phone.hide(), (window.__phone.awayAt = t)), at);
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__phone.freeze());
  } else {
    await page.evaluate(() => window.__phone.hide());
    // The system gives a hidden app a moment before it stops it.
    await page.waitForTimeout(150);
    await page.evaluate((s) => window.__phone.stop(s), sound);
  }
  await page.waitForTimeout(AWAY_MS);
  await page.evaluate((first) => window.__phone.comeBack(first), eventFirst);
}

/** After a return or a call: nothing late is heard, then a tap on `button` sounds on a running engine. */
async function expectCleanSound(page: Page, what: string, tapOn: ReturnType<Page['locator']>, log: Record<string, unknown>) {
  const now = await page.evaluate(() => performance.now());
  const report = await page.evaluate(([from, to]) => window.__phone.report(from, to), [await page.evaluate(() => window.__phone.awayAt), now]);
  log[what] = report;
  expect.soft(report.heardLate, `${what}: sounds heard that the game asked for while away or while catching up`).toEqual([]);
  expect.soft(report.heardInterrupted, `${what}: sounds asked of an interrupted engine, which wait there and burst out later`).toEqual([]);
  expect.soft(report.leftover, `${what}: sounds cut short or still to come when the engine stopped, which go on when it starts`).toEqual([]);

  await tapOn.tap();
  await expect
    .configure({ soft: true })
    .poll(
      async () => {
        const heard = await page.evaluate((from) => window.__phone.heardSince(from), now);
        if (!heard || heard.state !== 'running') return heard ?? 'no sound';
        // The engine's clock must be going, not only its state.
        await page.waitForTimeout(150);
        const later = await page.evaluate((from) => window.__phone.heardSince(from), now);
        return later && later.clock > heard.clock ? 'heard' : `${heard.name}: the engine's clock stands still`;
      },
      { message: `${what}: the next tap sounds, on a running engine`, timeout: 8000 },
    )
    .toBe('heard');
}

const LOSSES = new Map((await lossCases()).map((c) => [c.level.id, c.path]));
/** Moves played one by one, with their animations. A longer way to the loss is set in one step. */
const PLAYED_MOVES = 4;

test('there are levels to leave, and most of them can be lost', () => {
  expect(LEVELS.length).toBeGreaterThanOrEqual(30);
  expect(LOSSES.size).toBeGreaterThanOrEqual(20);
});

for (const level of LEVELS) {
  const nn = String(level.number).padStart(2, '0');
  test(`level ${nn} ${level.id}: away and back at rest, mid-move and mid-loss`, async ({ page }, testInfo) => {
    // Nothing here depends on the size of the screen.
    test.skip(testInfo.project.name !== 'iphone-landscape', 'played at one size');
    const log: Record<string, unknown> = { level: level.id };
    await page.addInitScript(phone);
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    await passRulesCard(page, level.title);
    // The camera's opening glide, and the scene's first frames.
    await page.waitForTimeout(3000);
    const { move: moveMs, end: endMs } = await page.evaluate(() => {
      const l = window.__riddle!.getState().level;
      return { move: l.moveDurationMs as number, end: (l.endDelayMs ?? 400) as number };
    });
    const barUndo = page.getByRole('button', { name: 'Undo', exact: true }).first();
    const first = level.moves[0];

    // ---- At rest, one move in. The engines come back "interrupted". ----
    await playMove(page, first, 1);
    await page.waitForTimeout(1500);
    await awayAndBack(page, 'interrupted', true);
    await page.waitForTimeout(1500);
    expect(await state(page), 'at rest: the position is kept').toEqual({ moves: 1, kind: 'playing', busy: false, ended: false });
    await expectSceneDrawn(page, 'at rest');
    await expectCleanSound(page, 'at rest', barUndo, log);
    await expect.poll(async () => (await state(page)).moves, { message: 'at rest: Undo works' }).toBe(0);
    await page.waitForTimeout(moveMs + 500);

    // ---- At rest again, in the usual order on an iPhone: the sound is interrupted first, then the page is hidden. ----
    await playMove(page, first, 1);
    await page.waitForTimeout(1500);
    await awayAndBack(page, 'interrupted', true, 'interrupted first');
    await page.waitForTimeout(1500);
    expect(await state(page), 'interrupted first: the position is kept').toEqual({ moves: 1, kind: 'playing', busy: false, ended: false });
    await expectSceneDrawn(page, 'interrupted first');
    await expectCleanSound(page, 'interrupted first', barUndo, log);
    await expect.poll(async () => (await state(page)).moves, { message: 'interrupted first: Undo works' }).toBe(0);
    await page.waitForTimeout(moveMs + 500);

    // ---- In the middle of a move. The engines come back "suspended", and the late timers run first. ----
    await page.evaluate((m) => window.__riddle!.getState().play(m), first);
    await page.waitForTimeout(Math.round(moveMs * 0.4));
    await awayAndBack(page, 'suspended', false);
    await expect.poll(() => state(page), { message: 'mid-move: the move is finished and kept', timeout: 15_000 }).toEqual({ moves: 1, kind: 'playing', busy: false, ended: false });
    await page.waitForTimeout(1500);
    // For the eye: this picture and the last one show the same position, one after a return and one without.
    await page.screenshot({ path: testInfo.outputPath('after-return-mid-move.png') });
    await expectSceneDrawn(page, 'mid-move');
    await expectCleanSound(page, 'mid-move', barUndo, log);
    await expect.poll(async () => (await state(page)).moves, { message: 'mid-move: Undo works' }).toBe(0);
    await page.waitForTimeout(moveMs + 500);

    const path = LOSSES.get(level.id);
    if (path) {
      const before = path.slice(0, -1);
      const losing = path[path.length - 1];
      if (before.length <= PLAYED_MOVES) {
        for (const [i, move] of before.entries()) await playMove(page, move, i + 1);
      } else {
        // Many moves (a level lost by running out of them): set the position at once, as an undo would show it.
        await page.evaluate((moves) => {
          const store = window.__riddle as any;
          const rules = store.getState().level.rules;
          const history = [rules.initialState];
          for (const m of moves) history.push(rules.apply(history[history.length - 1], m));
          store.setState({ history, moves, future: [], status: rules.status(history[history.length - 1]), hint: null });
        }, before);
      }
      await page.waitForTimeout(2000);
      const card = page.getByRole('dialog', { name: 'Oh no!' });
      const lossSceneBegun = () => window.__riddle!.getState().status.kind === 'lost' && !window.__riddle!.getState().busy;

      // ---- In the middle of a loss. ----
      await page.evaluate((m) => window.__riddle!.getState().play(m), losing);
      await page.waitForFunction(lossSceneBegun, undefined, { polling: 50 });
      await page.waitForTimeout(Math.round(endMs * 0.35));
      await awayAndBack(page, 'interrupted', false);
      await expect(card, 'mid-loss: the card comes').toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1500);
      await expectSceneDrawn(page, 'mid-loss');
      await expectCleanSound(page, 'mid-loss', card.getByRole('button', { name: 'Undo' }), log);
      await expect.poll(() => state(page), { message: 'mid-loss: Undo takes the loss back' }).toEqual({ moves: before.length, kind: 'playing', busy: false, ended: false });
      await page.waitForTimeout(moveMs + 1500);

      // ---- A call during a loss: the engines are interrupted, the page stays shown and goes on. ----
      await page.evaluate((m) => window.__riddle!.getState().play(m), losing);
      await page.waitForFunction(lossSceneBegun, undefined, { polling: 50 });
      await page.waitForTimeout(Math.round(endMs * 0.35));
      await page.evaluate(() => window.__phone.interrupt());
      await expect(card, 'a call: the card comes').toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.__phone.endInterruption());
      await expectCleanSound(page, 'after a call', card.getByRole('button', { name: 'Undo' }), log);
      await expect.poll(() => state(page), { message: 'after a call: Undo takes the loss back' }).toEqual({ moves: before.length, kind: 'playing', busy: false, ended: false });
      await page.waitForTimeout(moveMs + 1500);
    }

    // ---- A win in the first moment after a return: away 40% into the winning move, interrupted first. ----
    await page.evaluate(() => window.__riddle!.getState().restart());
    await page.waitForTimeout(moveMs + 500);
    await page.evaluate((moves) => {
      const store = window.__riddle as any;
      const rules = store.getState().level.rules;
      const history = [rules.initialState];
      for (const m of moves) history.push(rules.apply(history[history.length - 1], m));
      store.setState({ history, moves, future: [], status: rules.status(history[history.length - 1]), hint: null });
    }, level.moves.slice(0, -1));
    await page.waitForTimeout(1500);
    await page.evaluate((m) => window.__riddle!.getState().play(m), level.moves[level.moves.length - 1]);
    await page.waitForTimeout(Math.round(moveMs * 0.4));
    await awayAndBack(page, 'interrupted', false, 'interrupted first');
    await expect(page.getByRole('dialog', { name: 'Solved!' }), 'a win after a return: the card comes').toBeVisible({ timeout: 15_000 });
    const fanfare = () =>
      page.evaluate(() => {
        const P = window.__phone;
        const notes = P.sounds.filter((s) => s.at >= P.backAt && /(^|<)win$/.test(s.name));
        return { asked: notes.length, heard: notes.filter((s) => (s.node.__outs ?? 0) > 0 && !s.late && !s.catchingUp && s.state !== 'interrupted').length };
      });
    await expect.poll(fanfare, { message: 'a win after a return: its four notes are heard', timeout: 10_000 }).toEqual({ asked: 4, heard: 4 });
    await page.waitForTimeout(1500);
    const won = await page.evaluate(([from, to]) => window.__phone.report(from, to), await page.evaluate(() => [window.__phone.awayAt, performance.now()]));
    log['a win after a return'] = { ...won, fanfare: await fanfare() };
    expect.soft(won.heardLate, 'a win after a return: sounds heard that the game asked for while away or while catching up').toEqual([]);
    expect.soft(won.leftover, 'a win after a return: sounds cut short or still to come when the engine stopped').toEqual([]);

    // ---- The level goes on: from a fresh start, a move is played to its end. ----
    await page.evaluate(() => window.__riddle!.getState().restart());
    await page.waitForTimeout(moveMs + 500);
    await playMove(page, first, 1);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: testInfo.outputPath('same-move-never-away.png') });
    await expectSceneDrawn(page, 'at the end');
    log.engines = await page.evaluate(() => window.__phone.engines());
    await testInfo.attach('away-and-back', { body: JSON.stringify(log, null, 1), contentType: 'application/json' });
  });
}
