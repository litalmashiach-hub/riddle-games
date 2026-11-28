import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { LAYOUT, rules, trace, turnPreviews, type State } from './rules';


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

  it('previews the first tap: the one crystal in the beam would send it into the toad', () => {
    const p = turnPreviews(rules.initialState);
    expect(p.map((x) => LAYOUT.mirrors[x.mirror])).toEqual([{ c: 1, r: 2, start: '/' }]);
    expect(p[0].toad).toBe(true);
    expect(p[0].trace.end).toBe('toad');
  });

  it('previews exactly what each turn of a crystal in the beam does, and only those crystals', () => {
    // Walk the solution and a few decoy turns; at every step the preview must agree with the rules.
    const sol = solve(rules)!.moves;
    let s = rules.initialState;
    const steps = [...sol.slice(0, 3), { mirror: 6 }, { mirror: 6 }, ...sol.slice(3)];
    for (const m of steps) {
      if (rules.status(s).kind !== 'playing') break;
      const inBeam = new Set(trace(s).bounced);
      const previews = turnPreviews(s);
      expect(new Set(previews.map((p) => p.mirror))).toEqual(inBeam);
      for (const p of previews) {
        const after = rules.apply(s, { mirror: p.mirror });
        expect(p.trace).toEqual(trace(after));
        const st = rules.status(after);
        expect(p.toad).toBe(st.kind === 'lost' && /toad/.test(st.reason));
      }
      s = rules.apply(s, m);
    }
  });
});
