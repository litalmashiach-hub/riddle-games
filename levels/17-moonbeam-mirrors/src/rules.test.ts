import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { LAYOUT, rules, trace, type State } from './rules';


describe('Moonbeam Mirrors', () => {
  it('is solvable in the advertised number of turns', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(6);
  });

  it('starts calm: the beam misses the toad and some flowers are dark', () => {
    expect(rules.status(rules.initialState).kind).toBe('playing');
    expect(trace(rules.initialState).lit.length).toBeLessThan(LAYOUT.flowers.length);
  });

  it('has exactly one way to light every flower', () => {
    const n = LAYOUT.mirrors.length;
    let wins = 0;
    for (let b = 0; b < 1 << n; b++) {
      const s: State = { tilts: LAYOUT.mirrors.map((_, i) => ((b >> i) & 1 ? '\\' : '/')), turns: 0 };
      const t = trace(s);
      if (t.end !== 'toad' && t.lit.length === LAYOUT.flowers.length) wins++;
    }
    expect(wins).toBe(1);
  });

  it('wakes the toad if the right turns come in the wrong order', () => {
    const sol = solve(rules)!.moves.map((m) => m.mirror);
    // Some order of the right turns must hit the toad, so the order matters.
    const perms = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
    const firstLoss = (order: number[]) => {
      let s = rules.initialState;
      for (const m of order) {
        s = rules.apply(s, { mirror: m });
        if (rules.status(s).kind === 'lost') return s;
      }
      return null;
    };
    const losses = perms(sol).map(firstLoss).filter((s): s is State => s != null);
    expect(losses.length).toBeGreaterThan(0);
    const st = rules.status(losses[0]);
    expect(st.kind === 'lost' && st.reason).toMatch(/toad/);
    expect(trace(losses[0]).end).toBe('toad');
  });

  it('loses when the moon sets', () => {
    let s = rules.initialState;
    // Spin one decoy crystal back and forth until the turns run out.
    const decoy = 1;
    for (let i = 0; i < LAYOUT.maxTurns; i++) s = rules.apply(s, { mirror: decoy });
    const st = rules.status(s);
    expect(st.kind).toBe('lost');
    expect(st.kind === 'lost' && st.reason).toMatch(/moon/);
  });
});
