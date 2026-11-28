import { solve } from '@riddle/engine';
import { describe, expect, it } from 'vitest';
import level from './index';
import { ALL_USED, BRIDGES, ISLANDS, ON_RAFT, badStart, bridgeBetween, noWinLeft, reachable, rules, startOf, type State } from './rules';

const startOn = (to: number) => rules.apply(rules.initialState, { to });

describe('Berry Bridges', () => {
  it('is solvable in the advertised number of moves: one to start, then every bridge once', () => {
    const sol = solve(rules);
    expect(sol).not.toBeNull();
    expect(sol!.moves.length).toBe(level.bestMoves);
    expect(level.bestMoves).toBe(BRIDGES.length + 1);
    // Replaying the solution really wins.
    const end = sol!.moves.reduce((s, m) => rules.apply(s, m), rules.initialState);
    expect(rules.status(end).kind).toBe('won');
    expect(end.used).toBe(ALL_USED);
  });

  it('can only be solved from the two islets with an odd number of bridges', () => {
    const degree = Array.from({ length: ISLANDS }, (_, i) => BRIDGES.filter(([a, b]) => a === i || b === i).length);
    const odd = degree.map((d, i) => (d % 2 ? i : -1)).filter((i) => i >= 0);
    expect(odd).toEqual([0, 6]);
    for (let i = 0; i < ISLANDS; i++) {
      const sol = solve(rules, startOn(i));
      if (odd.includes(i)) expect(sol!.moves.length).toBe(BRIDGES.length);
      else expect(sol).toBeNull();
    }
  });

  it('has no islet joined twice and every islet has at least two bridges', () => {
    const seen = new Set(BRIDGES.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
    expect(seen.size).toBe(BRIDGES.length);
    for (let i = 0; i < ISLANDS; i++) expect(BRIDGES.filter(([a, b]) => a === i || b === i).length).toBeGreaterThanOrEqual(2);
  });

  it('lets Bramble start anywhere, then only cross bridges that still stand', () => {
    expect(rules.legalMoves(rules.initialState).length).toBe(ISLANDS);
    const s = startOn(0);
    expect(s.used).toBe(0);
    expect(reachable(s).sort()).toEqual([1, 4, 5]);
    const t = rules.apply(s, { to: 1 });
    expect(t.used).toBe(1 << bridgeBetween(0, 1));
    expect(reachable(t).sort()).toEqual([2, 5, 6]);
    expect(rules.initialState.at).toBe(ON_RAFT);
  });

  it('loses when Bramble is stranded with berries left', () => {
    // Start on the shell islet (two bridges), leave, come back: no bridge is left there.
    let s: State = startOn(7);
    for (const to of [3, 2, 7]) s = rules.apply(s, { to });
    expect(reachable(s)).toEqual([]);
    const st = rules.status(s);
    expect(st.kind).toBe('lost');
    expect(st.kind === 'lost' && st.reason).toContain('9 berries');
  });

  it('gives a hint a player can follow', () => {
    expect(rules.describeMove({ to: 6 }, rules.initialState)).toBe('Start on the reed islet');
    expect(rules.describeMove({ to: 5 }, startOn(6))).toBe('Cross the bridge to the lotus islet');
  });

  it('knows the start from the sunk bridges alone, on any walk', () => {
    let seed = 7;
    const rand = (n: number) => ((seed = (seed * 16807) % 2147483647), seed % n);
    for (let run = 0; run < 300; run++) {
      const start = rand(ISLANDS);
      let s = startOn(start);
      expect(startOf(s)).toBe(start);
      while (rules.status(s).kind === 'playing') {
        const moves = rules.legalMoves(s);
        s = rules.apply(s, moves[rand(moves.length)]);
        expect(startOf(s)).toBe(start);
      }
    }
    expect(startOf(rules.initialState)).toBe(ON_RAFT);
  });

  it('says at once, after the first move, when the start can never win', () => {
    for (let i = 0; i < ISLANDS; i++) {
      const s = startOn(i);
      const winnable = solve(rules, s) !== null;
      expect(badStart(s)).toBe(!winnable);
      expect(noWinLeft(s)).toBe(!winnable);
    }
    expect(badStart(rules.initialState)).toBe(false);
    expect(noWinLeft(rules.initialState)).toBe(false);
    // A bad start stays bad after more moves; a good start with a wrong turn later is not a bad start.
    const bad = rules.apply(startOn(7), { to: 3 });
    expect(badStart(bad)).toBe(true);
    let good = startOn(0);
    for (const to of [1, 2, 3, 7]) good = rules.apply(good, { to });
    expect(badStart(good)).toBe(false);
    expect(noWinLeft(good)).toBe(solve(rules, good) === null);
  });

  it('asks the loss card to lead with Restart', () => {
    expect(level.restartWhenStuck).toBe(true);
  });
});
