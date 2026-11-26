import type { Page } from '@playwright/test';
import { lastResortLossPaths, levelRules, lossCases, type LossCase } from '../loss-paths';
import { expect, passRulesCard, playMove, test, waitForSession } from './fixtures';

/**
 * What is heard after a loss is undone. A player who sees the mistake taps Undo while the loss scene plays.
 * From that tap on, nothing of the loss may sound: no bonk, shiver or sad trombone that was still to come.
 *
 * Nobody listens here. The test watches the browser's own function that starts a sound, and the page's
 * timers, in every level that can be lost (and in both kinds of loss, where a level has two):
 *
 * 1. The loss is played once and left alone. Each timer that then starts a sound is noted by the place in
 *    the game's code that set it.
 * 2. The loss is taken back and played again. This time the timers set in those places are held, as if each
 *    were still a moment short of its time, and when the scene is under way every other timer waits too:
 *    the instant of the tap, stretched.
 * 3. Undo is tapped through the touch screen. Once the scene has been drawn again, time goes on: every timer
 *    that the game did not cancel runs.
 *
 * Then no sound may start from a timer that was set during the loss. And no other sound may start either,
 * but the ones that pieces make on their way back (PIECES_GOING_BACK).
 *
 * Without step 2 the result would hang on where in a 180 ms gap a tap happens to land.
 */

/** Sounds of an undo itself: pieces going back to where they were. Named by the game's function that plays them. */
const PIECES_GOING_BACK: Record<string, RegExp> = {
  'twelve-coins': /^clink\b/,
  'firefly-jars': /<onLand\b/,
  'firefly-rainbow': /<onLand\b/,
  'picture-tiles': /^click<onEnd\b/,
  'family-portrait': /^(click|select)<onEnd\b/,
};
/**
 * Known and left alone: in Log Jam and Timber Tangle the duck's hop off the logs can boing once after the undo.
 * Its scene files are being changed elsewhere; when that is done, fix it there and take this out.
 */
const KNOWN_LEFTOVER: Record<string, RegExp> = {
  'log-jam': /^boing<current\b/,
  'timber-tangle': /^boing<current\b/,
};

const CASES: LossCase[] = await lossCases();
// A level may have a second kind of loss, with a scene of its own: one that comes only when the moves run out.
for (const first of [...CASES]) {
  const rules = await levelRules(first.level.dir);
  const kindOf = (reason: string) => reason.replace(/\d+/g, 'N');
  const status = rules.status(first.path.reduce((state, m) => rules.apply(state, m), rules.initialState));
  const other = lastResortLossPaths(rules).find((l) => status.kind === 'lost' && kindOf(l.reason) !== kindOf(status.reason));
  if (other) CASES.push({ level: first.level, path: other.path, kind: 'out of moves' });
}

/** What the page keeps about its sounds and timers (see `listen`). */
interface Heard {
  /** Every sound started: when, the game's functions that asked for it, and the timer it came from, if any. */
  sounds: { at: number; name: string; site: string | null; armedAt: number | null }[];
  /** Every timer set: when, and from where in the game's code. */
  armed: { at: number; site: string }[];
  /** Timers set from these places are held: they do not run until `release`. */
  hold: string[] | null;
  held: number;
  /** While true, a timer whose time has come waits for `release`. */
  frozen: boolean;
  undoAt: number;
  /** Runs every held or waiting timer that the game has not cancelled, and lets time go on. */
  release(): void;
  /** Resolves when the scene has been drawn `n` more times. */
  frames(n: number): Promise<void>;
}
declare global {
  interface Window {
    __heard: Heard;
  }
}

/** Runs in the page before the game starts. */
function listen() {
  const realSet = window.setTimeout as (handler: TimerHandler, ms?: number) => number;
  const realClear = window.clearTimeout;
  interface Timer {
    site: string;
    armedAt: number;
    fn: () => void;
    cancelled: boolean;
  }
  let current: Timer | null = null;
  let nextHeld = -1;
  const timers = new Map<number, Timer>();
  const waiting: Timer[] = [];
  const H: Heard = (window.__heard = {
    sounds: [],
    armed: [],
    hold: null,
    held: 0,
    frozen: false,
    undoAt: 0,
    release() {
      H.hold = null;
      H.held = 0;
      H.frozen = false;
      for (const t of waiting.splice(0)) realSet(() => fire(t), 0);
    },
    frames: (n) =>
      new Promise((done) => {
        const next = () => (n-- > 0 ? requestAnimationFrame(next) : realSet(() => done(), 50));
        next();
      }),
  });
  const fire = (t: Timer) => {
    if (t.cancelled) return;
    if (H.frozen) return void waiting.push(t);
    const was = current;
    current = t;
    try {
      t.fn();
    } finally {
      current = was;
    }
  };
  const lines = (from: number, to: number) => (new Error().stack ?? '').split('\n').slice(from, to);
  window.setTimeout = function (fn: TimerHandler, ms?: number, ...args: unknown[]) {
    if (typeof fn !== 'function') return realSet(fn, ms);
    const now = performance.now();
    // Where the timer was set: the caller and its caller, by their places in the built files.
    const site = lines(3, 5)
      .map((l) => l.match(/([^/\s(]+:\d+:\d+)\)?$/)?.[1] ?? '?')
      .join(' < ');
    // A timer set by a timer counts from when the first one was set.
    const t: Timer = { site, armedAt: current ? current.armedAt : now, fn: () => fn(...args), cancelled: false };
    H.armed.push({ at: now, site });
    let id: number;
    if (H.hold?.includes(site)) {
      id = nextHeld--;
      H.held++;
      waiting.push(t);
    } else {
      // It stays in `timers` after its time: the game may still cancel it while it waits for `release`.
      id = realSet(() => fire(t), ms);
    }
    timers.set(id, t);
    return id;
  } as typeof window.setTimeout;
  window.clearTimeout = function (id?: number) {
    const t = id == null ? undefined : timers.get(id);
    if (t) {
      t.cancelled = true;
      timers.delete(id!);
    }
    if (id == null || id >= 0) realClear.call(window, id);
  } as typeof window.clearTimeout;

  // The first pitch a sound is given tells two sounds of one function apart in a failure's message.
  const setValue = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (value: number, at: number) {
    const p = this as AudioParam & { __first?: number };
    if (p.__first === undefined) p.__first = value;
    return setValue.call(this, value, at);
  };
  // Every sound of the game is an oscillator or a buffer, started here. A sound asked for with a delay is
  // counted when it is asked for: from then on the browser plays it, whatever the game does.
  const start = AudioScheduledSourceNode.prototype.start as (this: AudioScheduledSourceNode, when?: number, ...rest: number[]) => void;
  AudioScheduledSourceNode.prototype.start = function (when?: number, ...rest: number[]) {
    // The game's functions that asked for the sound, nearest first. Names of two letters are the build's own.
    const names = lines(3, 10)
      .map((l) => l.match(/at (?:async )?(?:Object\.)?([\w$.<>]+)(?: \[as \w+\])? \(/)?.[1])
      // The game's own wrapper round start() (packages/fx/src/soundLife.ts) is no asker either.
      .filter((n): n is string => !!n && n.length > 2 && n !== 'fire' && !/\.start$/.test(n))
      .slice(0, 3)
      .join('<');
    const pitch = (this as unknown as { frequency?: { __first?: number } }).frequency?.__first;
    H.sounds.push({ at: performance.now(), name: `${names || '?'}${pitch ? ` ${Math.round(pitch)}Hz` : ''}`, site: current?.site ?? null, armedAt: current?.armedAt ?? null });
    return start.call(this, when, ...rest);
  };
}

/** Waits until no sound has started for `quiet` ms, and at least `least` ms have passed. */
async function untilQuiet(page: Page, least: number, quiet = 2500, most = 25_000) {
  const from = await page.evaluate(() => performance.now());
  await page.waitForFunction(
    ([from, least, quiet, most]) => {
      const now = performance.now();
      const last = window.__heard.sounds.at(-1)?.at ?? 0;
      return now - from >= most || (now - from >= least && now - last >= quiet);
    },
    [from, least, quiet, most],
    { polling: 100, timeout: most + 30_000 },
  );
}

test('the levels that can be lost are found, and the second kind of loss where there is one', () => {
  expect(CASES.filter((c) => !c.kind).length).toBeGreaterThanOrEqual(20);
  // Moonbeam Mirrors and Moonbeam Maze: the toad's sneeze, and the moon setting.
  expect(CASES.filter((c) => c.kind).length).toBeGreaterThanOrEqual(2);
});

/** Moves played one by one, with their animations. A longer way to the loss is set in one step. */
const PLAYED_MOVES = 4;

for (const { level, path, kind } of CASES) {
  const nn = String(level.number).padStart(2, '0');
  test(`level ${nn} ${level.id}${kind ? ` (${kind})` : ''}: no sound of the loss after Undo`, async ({ page }, testInfo) => {
    await page.addInitScript(listen);
    await page.goto(`?debug&quality=low#/level/${level.id}`);
    await waitForSession(page, level.id);
    await passRulesCard(page, level.title);
    // The camera's opening glide, and the scene's first frames.
    await page.waitForTimeout(3000);

    const before = path.slice(0, -1);
    if (before.length <= PLAYED_MOVES) {
      for (const [i, move] of before.entries()) await playMove(page, move, i + 1);
    } else {
      // Many moves (a level lost by running out of them): set the position at once, as an undo would show it.
      await page.evaluate((moves) => {
        const store = window.__riddle as any;
        const s = store.getState();
        const rules = s.level.rules;
        const history = [rules.initialState];
        for (const m of moves) history.push(rules.apply(history[history.length - 1], m));
        store.setState({ history, moves, future: [], status: rules.status(history[history.length - 1]), hint: null });
      }, before);
    }
    await untilQuiet(page, 2500);

    // The bottom bar's Undo, where a thumb finds it.
    const undo = page.getByRole('button', { name: 'Undo', exact: true }).first();
    const box = (await undo.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    const { move, end } = await page.evaluate(() => {
      const store = window.__riddle as any;
      const l = store.getState().level;
      const times = { move: l.moveDurationMs as number, end: (l.endDelayMs ?? 400) as number };
      // The "Oh no!" card waits 20 s longer than in the game, so that the whole loss scene can be heard first,
      // and so that the tap comes before the card however slowly the scene is drawn here.
      l.endDelayMs = times.end + 20_000;
      store.subscribe((now: any, was: any) => {
        if (now.moves.length < was.moves.length) window.__heard.undoAt = performance.now();
      });
      return times;
    });
    const losing = path[path.length - 1];
    const play = () =>
      page.evaluate((m) => {
        const at = performance.now();
        (window.__riddle as any).getState().play(m);
        return at;
      }, losing);
    const lossSceneBegun = () => window.__riddle!.getState().status.kind === 'lost' && !window.__riddle!.getState().busy;

    // ---- 1. The loss, left to play out ----
    const firstAt = await play();
    await page.waitForFunction(lossSceneBegun, undefined, { polling: 50 });
    await untilQuiet(page, end + 1500);
    const ref = await page.evaluate((from) => {
      const H = window.__heard;
      const sounds = H.sounds.filter((s) => s.at >= from);
      const sites = [...new Set(sounds.filter((s) => s.site && s.armedAt! >= from).map((s) => s.site!))];
      const arms = H.armed.filter((a) => a.at >= from && sites.includes(a.site));
      return { sounds: sounds.map((s) => s.name), sites, timers: arms.length, lastSetAfter: arms.length ? arms[arms.length - 1].at - from : 0 };
    }, firstAt);
    expect(ref.sounds.length, 'the loss is heard: the test can see the game start its sounds').toBeGreaterThan(0);

    // Back to before the loss, and quiet again.
    await page.evaluate(() => (window.__riddle as any).getState().undo());
    await untilQuiet(page, 3000);
    expect(await page.evaluate(() => window.__riddle!.getState().status.kind)).toBe('playing');

    // ---- 2. The loss again, with its sound timers held ----
    await page.evaluate((sites) => {
      window.__heard.hold = sites;
      window.__heard.undoAt = 0;
    }, ref.sites);
    const from = await play();
    // The tap comes when the loss scene has begun and has set as many sound timers as the first time. A scene
    // that waits on a held timer never gets that far: then the tap comes once it has had its time and half again.
    await page.waitForFunction(
      ([from, timers, lastSetAfter]) => {
        const s = window.__riddle!.getState();
        if (s.status.kind !== 'lost' || s.busy) return false;
        if (window.__heard.held < timers && performance.now() - from < lastSetAfter * 1.5 + 4000) return false;
        window.__heard.frozen = true;
        return true;
      },
      [from, ref.timers, ref.lastSetAfter],
      { polling: 50 },
    );
    const held = await page.evaluate(() => window.__heard.held);
    // Whatever the scene had begun in that instant ends here; what follows the tap is the undo's alone.
    await page.waitForTimeout(500);

    // ---- 3. Undo, by touch ----
    await page.touchscreen.tap(x, y);
    await expect.poll(() => page.evaluate(() => window.__heard.undoAt), 'the tap on Undo took the losing move back').toBeGreaterThan(0);
    await page.evaluate(async () => {
      await window.__heard.frames(3);
      window.__heard.release();
    });
    // Time for a late sound: the longest wait of any fail scene's timer is under a second.
    await page.waitForTimeout(Math.max(5000, move + 2500));

    const got = await page.evaluate((from) => {
      const H = window.__heard;
      const after = H.sounds.filter((s) => s.at > H.undoAt);
      return {
        after: after.map((s) => ({ name: s.name, msAfterUndo: Math.round(s.at - H.undoAt), fromTimerOfTheLoss: s.armedAt != null && s.armedAt >= from && s.armedAt <= H.undoAt })),
        kind: (window.__riddle as any).getState().status.kind as string,
      };
    }, from);
    await testInfo.attach('sounds', { body: JSON.stringify({ level: level.id, kind, ref, held, got }, null, 1), contentType: 'application/json' });

    expect(got.kind, 'the level goes on').toBe('playing');
    expect(
      got.after.filter((s) => s.fromTimerOfTheLoss).map((s) => s.name),
      'sounds after the undo that came from a timer set during the loss',
    ).toEqual([]);
    const allowed = [PIECES_GOING_BACK[level.id], KNOWN_LEFTOVER[level.id]].filter(Boolean);
    expect(
      got.after.filter((s) => !s.fromTimerOfTheLoss && !allowed.some((r) => r.test(s.name))).map((s) => `${s.name} (${s.msAfterUndo} ms after the undo)`),
      'other sounds after the undo',
    ).toEqual([]);
  });
}
