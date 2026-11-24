import { solve } from '@riddle/engine';
import first, { trace, type State } from '@riddle/level-17-moonbeam-mirrors';
import { describe, expect, it } from 'vitest';
import level, { LAYOUT, rules } from './index';

const every = (): State[] => {
  const n = LAYOUT.mirrors.length;
  return Array.from({ length: 1 << n }, (_, b) => ({ tilts: LAYOUT.mirrors.map((_, i) => ((b >> i) & 1 ? '\\' : '/')), turns: 0 }));
};

describe('Moonbeam Maze', () => {
  it('is solvable in the advertised number of turns', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(9);
  });

  it('is bigger than level 17 and takes more turns', () => {
    expect(LAYOUT.mirrors.length).toBe(11);
    expect(LAYOUT.flowers.length).toBe(5);
    expect(level.bestMoves).toBeGreaterThan(first.bestMoves);
  });

  it('puts every piece on its own pad', () => {
    const cells = [...LAYOUT.mirrors, ...LAYOUT.flowers, ...LAYOUT.rocks, LAYOUT.toad].map((k) => `${k.c},${k.r}`);
    expect(new Set(cells).size).toBe(cells.length);
    for (const k of [...LAYOUT.mirrors, ...LAYOUT.flowers, ...LAYOUT.rocks, LAYOUT.toad]) {
      expect(k.c >= 0 && k.c < 5 && k.r >= 0 && k.r < 5).toBe(true);
    }
  });

  it('starts calm: the beam misses the toad and no flower is lit', () => {
    expect(rules.status(rules.initialState).kind).toBe('playing');
    expect(trace(rules.initialState, LAYOUT).lit.length).toBe(0);
  });

  it('has exactly one way to light every flower', () => {
    const wins = every().filter((s) => {
      const t = trace(s, LAYOUT);
      return t.end !== 'toad' && t.lit.length === LAYOUT.flowers.length;
    });
    expect(wins.length).toBe(1);
  });

  it('wakes the toad in more than half of all the ways the crystals can stand', () => {
    const woken = every().filter((s) => trace(s, LAYOUT).end === 'toad').length;
    expect(woken * 2).toBeGreaterThan(1 << LAYOUT.mirrors.length);
  });

  it('wakes the toad if the right turns come in the wrong order', () => {
    const sol = solve(rules)!.moves.map((m) => m.mirror);
    // Turn the right crystals back to front: somewhere on the way the beam finds the toad.
    let s = rules.initialState;
    let lost: State | null = null;
    for (const mirror of [...sol].reverse()) {
      s = rules.apply(s, { mirror });
      if (rules.status(s).kind === 'lost') {
        lost = s;
        break;
      }
    }
    expect(lost).not.toBeNull();
    expect(trace(lost!, LAYOUT).end).toBe('toad');
  });

  it('loses when the moon sets', () => {
    let s = rules.initialState;
    // Spin one harmless crystal back and forth until the turns run out.
    const harmless = LAYOUT.mirrors.findIndex((_, mirror) => trace(rules.apply(rules.initialState, { mirror }), LAYOUT).end !== 'toad' && trace(rules.apply(rules.initialState, { mirror }), LAYOUT).lit.length < LAYOUT.flowers.length);
    for (let i = 0; i < LAYOUT.maxTurns; i++) s = rules.apply(s, { mirror: harmless });
    const st = rules.status(s);
    expect(st.kind).toBe('lost');
    expect(st.kind === 'lost' && st.reason).toMatch(/moon/);
  });
});
