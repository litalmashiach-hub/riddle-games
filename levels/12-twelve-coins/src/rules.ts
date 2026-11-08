import type { RiddleRules } from '@riddle/engine';

/**
 * The Twelve Coins.
 *
 * One of 12 coins is fake: a little heavier or a little lighter. You may use the balance 3 times,
 * then you must name the fake coin and say whether it is heavier or lighter.
 *
 * The vault is cunning: the fake coin is not fixed in advance. After every weighing it picks the
 * result that keeps you guessing the longest (always staying consistent with every result shown so
 * far). So a lucky guess never wins; only a strategy that works in every case does.
 */

export const COINS = 12;
export const MAX_WEIGHINGS = 3;

/** What the results so far tell us about a coin. */
export type Know =
  /** could be heavy or light */
  | '?'
  /** if it is the fake, it is heavy */
  | 'H'
  /** if it is the fake, it is light */
  | 'L'
  /** proven genuine */
  | 'G';

/** Which pan went down. */
export type Tilt = 'left' | 'right' | 'even';

export interface Weighing {
  left: number[];
  right: number[];
  tilt: Tilt;
}

export interface State {
  /** Knowledge about each coin, index 0..11 (shown to the player as 1..12). */
  know: Know[];
  log: Weighing[];
  accused: { coin: number; heavy: boolean } | null;
}

export type Move =
  | { kind: 'weigh'; left: number[]; right: number[] }
  | { kind: 'accuse'; coin: number; heavy: boolean };

/** Every (coin, heavy?) pair still possible. */
export function candidates(know: Know[]): { coin: number; heavy: boolean }[] {
  const out: { coin: number; heavy: boolean }[] = [];
  know.forEach((k, coin) => {
    if (k === '?' || k === 'H') out.push({ coin, heavy: true });
    if (k === '?' || k === 'L') out.push({ coin, heavy: false });
  });
  return out;
}

/** What each coin's knowledge becomes after a weighing with this result. */
export function learn(know: Know[], left: number[], right: number[], tilt: Tilt): Know[] {
  const L = new Set(left);
  const R = new Set(right);
  return know.map((k, i) => {
    const on = L.has(i) ? 'L' : R.has(i) ? 'R' : null;
    if (tilt === 'even') return on ? 'G' : k;
    if (!on) return 'G';
    // The coin is on the pan that went down: it can only be the fake if it is heavy.
    const down = (tilt === 'left') === (on === 'L');
    if (down) return k === '?' || k === 'H' ? 'H' : 'G';
    return k === '?' || k === 'L' ? 'L' : 'G';
  });
}

// ---------- Solvability by class counts (coins of the same knowledge are interchangeable) ----------

interface Counts {
  u: number;
  h: number;
  l: number;
  g: number;
}
interface Split {
  L: Counts;
  R: Counts;
}

const countsOf = (know: Know[]): Counts => ({
  u: know.filter((k) => k === '?').length,
  h: know.filter((k) => k === 'H').length,
  l: know.filter((k) => k === 'L').length,
  g: know.filter((k) => k === 'G').length,
});
const cands = (c: Counts) => 2 * c.u + c.h + c.l;
const ckey = (c: Counts) => `${c.u},${c.h},${c.l},${c.g}`;

/** All useful ways to put coins of each class on the two pans (same number of coins per pan). */
function splits(c: Counts): Split[] {
  const out: Split[] = [];
  for (let uL = 0; uL <= c.u; uL++)
    for (let uR = 0; uL + uR <= c.u; uR++)
      for (let hL = 0; hL <= c.h; hL++)
        for (let hR = 0; hL + hR <= c.h; hR++)
          for (let lL = 0; lL <= c.l; lL++)
            for (let lR = 0; lL + lR <= c.l; lR++) {
              const diff = uL + hL + lL - (uR + hR + lR);
              // Genuine coins only ever pad the lighter-count side.
              const gL = Math.max(0, -diff);
              const gR = Math.max(0, diff);
              if (gL + gR > c.g) continue;
              if (uL + hL + lL + gL === 0) continue;
              out.push({ L: { u: uL, h: hL, l: lL, g: gL }, R: { u: uR, h: hR, l: lR, g: gR } });
            }
  return out;
}

function outcome(c: Counts, s: Split, tilt: Tilt): Counts {
  if (tilt === 'even') {
    const u = c.u - s.L.u - s.R.u;
    const h = c.h - s.L.h - s.R.h;
    const l = c.l - s.L.l - s.R.l;
    return { u, h, l, g: COINS - u - h - l };
  }
  const down = tilt === 'left' ? s.L : s.R;
  const up = tilt === 'left' ? s.R : s.L;
  const h = down.u + down.h;
  const l = up.u + up.l;
  return { u: 0, h, l, g: COINS - h - l };
}

const memo = new Map<string, boolean>();
/** Can every case be pinned down to one (coin, heavy?) with `left` weighings? */
function solvable(c: Counts, left: number): boolean {
  const n = cands(c);
  if (n <= 1) return true;
  if (left === 0 || n > 3 ** left) return false;
  const k = `${ckey(c)}|${left}`;
  const hit = memo.get(k);
  if (hit !== undefined) return hit;
  let ok = false;
  for (const s of splits(c)) {
    if ((['left', 'right', 'even'] as Tilt[]).every((t) => solvable(outcome(c, s, t), left - 1))) {
      ok = true;
      break;
    }
  }
  memo.set(k, ok);
  return ok;
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The vault's answer to a weighing: the result that keeps the most doubt.
 * 1. a result you can no longer solve in time, if there is one;
 * 2. otherwise the result with the most possibilities left;
 * 3. ties broken by a fixed hash of the weighing, so it varies but replays the same.
 */
export function vaultTilt(s: State, left: number[], right: number[]): Tilt {
  const remaining = MAX_WEIGHINGS - s.log.length - 1;
  const seed = hash(`${s.log.length}|${left.join(',')}|${right.join(',')}`);
  const options = (['even', 'left', 'right'] as Tilt[])
    .map((tilt, i) => {
      const k = learn(s.know, left, right, tilt);
      const n = candidates(k).length;
      return { tilt, n, stuck: n > 0 && !solvable(countsOf(k), remaining), tie: (seed >> (i * 5)) & 31 };
    })
    .filter((o) => o.n > 0);
  options.sort((a, b) => Number(b.stuck) - Number(a.stuck) || b.n - a.n || b.tie - a.tie);
  return options[0].tilt;
}

/** For a lost game: the fake coin the vault reveals (any possibility other than the accusation). */
export function revealFake(s: State): { coin: number; heavy: boolean } | null {
  const acc = s.accused;
  const c = candidates(s.know);
  return c.find((x) => !acc || x.coin !== acc.coin || x.heavy !== acc.heavy) ?? null;
}

/** Coins of each class in index order, for building concrete weighings from class counts. */
function concrete(know: Know[], s: Split): { left: number[]; right: number[] } {
  const pool: Record<Know, number[]> = { '?': [], H: [], L: [], G: [] };
  know.forEach((k, i) => pool[k].push(i));
  const take = (k: Know, n: number) => pool[k].splice(0, n);
  const side = (c: Counts) => [...take('?', c.u), ...take('H', c.h), ...take('L', c.l), ...take('G', c.g)];
  const left = side(s.L);
  const right = side(s.R);
  return { left: left.sort((a, b) => a - b), right: right.sort((a, b) => a - b) };
}

export const coinName = (i: number) => `${i + 1}`;
const list = (xs: number[]) => xs.map(coinName).join(', ');

export const rules: RiddleRules<State, Move> = {
  initialState: { know: Array<Know>(COINS).fill('?'), log: [], accused: null },

  legalMoves(s) {
    if (s.accused) return [];
    const moves: Move[] = [];
    // One representative weighing per pattern; coins of the same knowledge are interchangeable.
    if (s.log.length < MAX_WEIGHINGS) for (const sp of splits(countsOf(s.know))) moves.push({ kind: 'weigh', ...concrete(s.know, sp) });
    for (let coin = 0; coin < COINS; coin++) for (const heavy of [true, false]) moves.push({ kind: 'accuse', coin, heavy });
    return moves;
  },

  apply(s, m) {
    if (m.kind === 'accuse') return { ...s, accused: { coin: m.coin, heavy: m.heavy } };
    const tilt = vaultTilt(s, m.left, m.right);
    return {
      know: learn(s.know, m.left, m.right, tilt),
      log: [...s.log, { left: [...m.left], right: [...m.right], tilt }],
      accused: null,
    };
  },

  status(s) {
    if (!s.accused) return { kind: 'playing' };
    const c = candidates(s.know);
    const { coin, heavy } = s.accused;
    if (c.length === 1 && c[0].coin === coin && c[0].heavy === heavy) return { kind: 'won' };
    const real = revealFake(s)!;
    const how = real.heavy ? 'heavier' : 'lighter';
    if (real.coin === coin) return { kind: 'lost', reason: `Right coin, wrong weight! Coin ${coinName(coin)} was ${how}.` };
    const guessed = c.some((x) => x.coin === coin && x.heavy === heavy);
    return {
      kind: 'lost',
      reason: guessed
        ? `A guess is not a proof! The fake was coin ${coinName(real.coin)}, and it was ${how}.`
        : `Wrong coin! The fake was coin ${coinName(real.coin)}, and it was ${how}.`,
    };
  },

  key(s) {
    const c = countsOf(s.know);
    const acc = s.accused ? (rules.status(s).kind === 'won' ? 'W' : 'X') : '-';
    return `${ckey(c)}|${s.log.length}|${acc}`;
  },

  describeMove(m) {
    if (m.kind === 'accuse') return `Coin ${coinName(m.coin)} is the fake, and it is ${m.heavy ? 'heavier' : 'lighter'}`;
    return `Weigh coins ${list(m.left)} against ${list(m.right)}`;
  },
};
