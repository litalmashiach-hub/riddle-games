/**
 * Keeps the game's sound right when the player leaves and comes back: another app, a call, the lock screen,
 * another browser tab.
 *
 * What goes wrong without it. A hidden page stops drawing and its timers stop or slow down, and the system
 * may stop the sound engine: iOS puts an AudioContext into a state called "interrupted" (it is in the Web
 * Audio standard, and Chromium has it too). On the way back, every timer whose time passed runs at once and
 * every animation jumps to where it should be by now, so all their sounds are asked for in the same instant.
 * A sound that was still to be played when the engine stopped is played when it starts again. And the game's
 * sound code wakes an engine only from "suspended", so one left "interrupted" stays silent.
 *
 * The game has a dozen sound engines (packages/fx/src/sfx.ts and one in most level folders), each private
 * to its file. So this works on the browser's own functions, and holds for every engine, also a new level's:
 *
 * - Hidden: what is sounding or still to sound is cut off, the engines are suspended, and from then on
 *   a sound that is asked for is not heard.
 * - Shown again: the engines that ran, or that the system left "interrupted", are resumed. Sounds stay
 *   unheard until the game has caught up (two frames drawn and a short moment), or until the player touches
 *   the screen. A win or a loss that lands in that moment is not dropped with the rest: the game asks for it
 *   through playWhenHeard, which keeps it until the moment is over.
 * - Any touch or key: an engine that is not running is resumed. A touch counts as the player's own act,
 *   which iOS may ask for before it lets an engine start again.
 * - While an engine is "interrupted" with the page still shown (a call comes in), what it was playing is cut
 *   off and sounds asked of it are not heard: they would all wait for the engine's stopped clock and burst
 *   out together at the end of the call.
 *
 * Only real devices can show how iOS itself behaves here: see docs/play-through-tests.md and
 * e2e/tests/back-from-background.spec.ts, which plays this through with a stand-in for the system.
 */

/** After the page is shown again, sounds stay unheard for at least this long (and two drawn frames). */
export const SOUND_SETTLE_MS = 300;
/** After a touch asked an interrupted engine to resume, sounds are let through to it for this long. */
const WAKE_MS = 1000;

const contexts = new Set<AudioContext>();
/** Sounds started and not yet over: what would go on, or still begin, after a return. */
const sounding = new Set<AudioScheduledSourceNode>();
const wakingUntil = new WeakMap<BaseAudioContext, number>();
/** The engines that this suspended when the page was hidden. */
const toResume = new Set<AudioContext>();
/** True while the page is hidden, and for a moment after it is shown again. */
let quiet = false;
/** The end-of-level sound asked for while sounds were unheard: played when they are heard again. */
let held: (() => void) | null = null;
/** Counts the returns, so that an older return's wait ends nothing after the page was hidden again. */
let visit = 0;
let started = false;

const stateOf = (c: BaseAudioContext) => c.state as string;

function wake(c: AudioContext) {
  const state = stateOf(c);
  if (state === 'running' || state === 'closed') return;
  wakingUntil.set(c, performance.now() + WAKE_MS);
  void c.resume().catch(() => {});
}

function unheard(c: BaseAudioContext) {
  if (quiet) return true;
  return stateOf(c) === 'interrupted' && !((wakingUntil.get(c) ?? 0) > performance.now());
}

/** Cuts off what is sounding or still to sound: on every engine, or on one. */
function cutOff(only?: BaseAudioContext) {
  for (const node of sounding) {
    if (only && node.context !== only) continue;
    sounding.delete(node);
    try {
      node.disconnect();
    } catch {
      // Already disconnected.
    }
  }
}

function onHidden() {
  quiet = true;
  visit++;
  cutOff();
  for (const c of contexts) {
    if (stateOf(c) !== 'running') continue;
    toResume.add(c);
    void c.suspend().catch(() => {});
  }
}

/** The quiet spell is over: from here on every sound is wanted, and a held one is played now. */
function endQuiet() {
  quiet = false;
  const play = held;
  held = null;
  play?.();
}

function onShown() {
  for (const c of toResume) wake(c);
  toResume.clear();
  // The usual order on an iPhone: the system interrupts the sound as the app goes, before the page hears
  // that it is hidden. Such an engine was not running when this suspended the rest, and stays "interrupted"
  // until the page asks it to resume.
  for (const c of contexts) if (stateOf(c) === 'interrupted') wake(c);
  if (!quiet) return;
  const mine = ++visit;
  const since = performance.now();
  let frames = 0;
  const step = () => {
    if (mine !== visit) return;
    if (++frames > 2 && performance.now() - since >= SOUND_SETTLE_MS) endQuiet();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function onTouch() {
  if (document.visibilityState === 'hidden') return;
  for (const c of contexts) wake(c);
  if (quiet) {
    // The player is back and playing: from here on every sound is wanted.
    visit++;
    endQuiet();
  }
}

/**
 * Plays a sound that must not be lost: the end of a level, whose card stays on the screen. While sounds are
 * unheard after a return (the burst of late sounds is dropped), it is kept and played when that moment ends;
 * if several are asked for, the last one. At any other time it is played at once.
 */
export function playWhenHeard(play: () => void) {
  if (quiet) held = play;
  else play();
}

/** Call once, before the first sound. Safe to call again, and where there is no sound engine at all. */
export function startSoundLife() {
  if (started || typeof window === 'undefined' || typeof document === 'undefined') return;
  started = true;
  const w = window as unknown as Record<string, unknown>;

  // Every engine the game makes from here on is known.
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Real = w[name] as typeof AudioContext | undefined;
    if (typeof Real !== 'function') continue;
    w[name] = class extends Real {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.add(this);
        // A call comes in while the game is shown: what this engine was playing must not go on after the call.
        this.addEventListener('statechange', () => stateOf(this) === 'interrupted' && cutOff(this));
      }
    };
  }

  // Every sound of the game is an oscillator or a buffer, and begins with start().
  for (const name of ['AudioScheduledSourceNode', 'AudioBufferSourceNode', 'OscillatorNode', 'ConstantSourceNode']) {
    const proto = (w[name] as { prototype?: AudioScheduledSourceNode } | undefined)?.prototype;
    if (!proto || !Object.prototype.hasOwnProperty.call(proto, 'start')) continue;
    const realStart = proto.start as (this: AudioScheduledSourceNode, ...args: number[]) => void;
    proto.start = function (this: AudioScheduledSourceNode, ...args: number[]) {
      if (unheard(this.context)) {
        // Started all the same, so that the game's later stop() is in order; it only reaches no speaker.
        this.disconnect();
      } else {
        sounding.add(this);
        this.addEventListener('ended', () => sounding.delete(this), { once: true });
      }
      return realStart.apply(this, args);
    };
  }

  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? onHidden() : onShown()));
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, onTouch, { capture: true, passive: true });
  }
}
