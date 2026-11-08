import type { RiddleRules } from '@riddle/engine';

export type Side = 'L' | 'R';
export type Person = 'father' | 'mother' | 'sonA' | 'sonB' | 'daughterA' | 'daughterB' | 'guard' | 'thief';
export const PEOPLE: Person[] = ['father', 'mother', 'sonA', 'sonB', 'daughterA', 'daughterB', 'guard', 'thief'];
export type Role = 'father' | 'mother' | 'son' | 'daughter' | 'guard' | 'thief';

export const roleOf = (p: Person): Role =>
  p === 'sonA' || p === 'sonB' ? 'son' : p === 'daughterA' || p === 'daughterB' ? 'daughter' : p;

/** Only these three know how to steer the raft. */
export const DRIVERS: Person[] = ['father', 'mother', 'guard'];
export const canSteer = (p: Person) => DRIVERS.includes(p);
const FAMILY: Role[] = ['father', 'mother', 'son', 'daughter'];

/** Which side of the canal everyone is on, plus the raft. */
export type State = Record<Person, Side> & { raft: Side };

/** One crossing: one or two riders, at least one of whom can steer. */
export interface Move {
  riders: Person[];
}

export const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

export const NAMES: Record<Role, string> = {
  father: 'Dad',
  mother: 'Mom',
  son: 'a son',
  daughter: 'a daughter',
  guard: 'the guard',
  thief: 'the thief',
};

export type Trouble = 'thief' | 'dad' | 'mom';

export interface Problem {
  kind: Trouble;
  /** The characters in trouble: the one causing it first, then the ones it happens to. */
  who: Person[];
}

/** What goes wrong when this group of people is left together, or null if they are fine. */
export function groupProblem(group: Person[]): Problem | null {
  const has = (r: Role) => group.some((p) => roleOf(p) === r);
  const of = (r: Role) => group.filter((p) => roleOf(p) === r);
  if (has('thief') && !has('guard') && group.some((p) => FAMILY.includes(roleOf(p)))) {
    return { kind: 'thief', who: ['thief', ...group.filter((p) => FAMILY.includes(roleOf(p)))] };
  }
  if (has('father') && !has('mother') && has('daughter')) return { kind: 'dad', who: ['father', ...of('daughter')] };
  if (has('mother') && !has('father') && has('son')) return { kind: 'mom', who: ['mother', ...of('son')] };
  return null;
}

export const onBank = (s: State, side: Side) => PEOPLE.filter((p) => s[p] === side);

/** The bank where a rule is broken, and what went wrong there. */
export function trouble(s: State): (Problem & { side: Side }) | null {
  for (const side of ['L', 'R'] as Side[]) {
    const p = groupProblem(onBank(s, side));
    if (p) return { ...p, side };
  }
  return null;
}

/** Why these riders can't set off together, or null if they can. */
export function raftProblem(riders: Person[]): string | null {
  if (riders.length === 0) return 'Someone has to steer the raft.';
  if (riders.length > 2) return 'The raft only holds two.';
  if (!riders.some(canSteer)) return 'Only Dad, Mom or the guard can steer.';
  const p = groupProblem(riders);
  if (p?.kind === 'thief') return 'The thief can only ride with the guard.';
  if (p?.kind === 'dad') return 'Dad can’t be with a daughter unless Mom is there.';
  if (p?.kind === 'mom') return 'Mom can’t be with a son unless Dad is there.';
  return null;
}

const REASONS: Record<Trouble, string> = {
  thief: 'The thief was left with the family and no guard. He pinched everything in their pockets!',
  dad: 'Dad was left with the girls without Mom. His terrible jokes made them cry!',
  mom: 'Mom was left with the boys without Dad. They ran wild and she lost her temper!',
};

export const rules: RiddleRules<State, Move> = {
  initialState: {
    father: 'L',
    mother: 'L',
    sonA: 'L',
    sonB: 'L',
    daughterA: 'L',
    daughterB: 'L',
    guard: 'L',
    thief: 'L',
    raft: 'L',
  },

  legalMoves(s) {
    const here = onBank(s, s.raft);
    const moves: Move[] = [];
    for (let i = 0; i < here.length; i++) {
      if (!raftProblem([here[i]])) moves.push({ riders: [here[i]] });
      for (let j = i + 1; j < here.length; j++) {
        const pair = [here[i], here[j]];
        if (!raftProblem(pair)) moves.push({ riders: pair });
      }
    }
    return moves;
  },

  apply(s, m) {
    const next = { ...s, raft: other(s.raft) };
    for (const p of m.riders) next[p] = other(s[p]);
    return next;
  },

  status(s) {
    const t = trouble(s);
    if (t) return { kind: 'lost', reason: REASONS[t.kind] };
    if (s.raft === 'R' && PEOPLE.every((p) => s[p] === 'R')) return { kind: 'won' };
    return { kind: 'playing' };
  },

  // The two sons are interchangeable, and so are the two daughters.
  key: (s) => {
    const n = (a: Person, b: Person) => (s[a] === 'R' ? 1 : 0) + (s[b] === 'R' ? 1 : 0);
    return `${s.raft}${s.father}${s.mother}${s.guard}${s.thief}${n('sonA', 'sonB')}${n('daughterA', 'daughterB')}`;
  },

  describeMove(m, s) {
    const dir = s.raft === 'L' ? 'across' : 'back';
    const names = m.riders.map((p) => NAMES[roleOf(p)]);
    // Name the one who steers first.
    const sorted = [...m.riders].sort((a, b) => Number(canSteer(b)) - Number(canSteer(a))).map((p) => NAMES[roleOf(p)]);
    const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
    if (names.length === 1) return `${cap(names[0])} crosses ${dir} alone`;
    return `${cap(sorted[0])} takes ${sorted[1]} ${dir}`;
  },
};
