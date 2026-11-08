import { createStore, type StoreApi } from 'zustand/vanilla';
import { nextHint } from './solver';
import type { RiddleLevel, RiddleStatus } from './types';

/** The live state of one play-through of a level. */
export interface SessionState<S = any, M = any> {
  level: RiddleLevel<S, M>;
  /** history[0] is the start; the last entry is the current state. */
  history: S[];
  moves: M[];
  /** Undone entries that redo() can bring back. */
  future: { state: S; move: M }[];
  status: RiddleStatus;
  busy: boolean;
  hint: M | null;
  hintsUsed: number;
  resetCount: number;
  /** True once the end screen should show (after endDelayMs). */
  ended: boolean;

  play(move: M): void;
  undo(): void;
  redo(): void;
  restart(): void;
  askHint(): string | null;
}

/** Creates the store for one play of a level. Plain zustand, testable without React. */
export function createSession<S, M>(level: RiddleLevel<S, M>): StoreApi<SessionState<S, M>> {
  const { rules } = level;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  return createStore<SessionState<S, M>>((set, get) => ({
    level,
    history: [rules.initialState],
    moves: [],
    future: [],
    status: rules.status(rules.initialState),
    busy: false,
    hint: null,
    hintsUsed: 0,
    resetCount: 0,
    ended: false,

    play(move) {
      const s = get();
      if (s.busy || s.status.kind !== 'playing') return;
      const current = s.history[s.history.length - 1];
      const next = rules.apply(current, move);
      const status = rules.status(next);
      set({
        history: [...s.history, next],
        moves: [...s.moves, move],
        future: [],
        status,
        busy: true,
        hint: null,
      });
      timers.push(setTimeout(() => set({ busy: false }), level.moveDurationMs));
      if (status.kind !== 'playing') {
        timers.push(
          setTimeout(() => set({ ended: true }), level.moveDurationMs + (level.endDelayMs ?? 400)),
        );
      }
    },

    undo() {
      const s = get();
      if (s.history.length <= 1) return;
      clearTimers();
      const state = s.history[s.history.length - 1];
      const move = s.moves[s.moves.length - 1];
      const history = s.history.slice(0, -1);
      set({
        history,
        moves: s.moves.slice(0, -1),
        future: [{ state, move }, ...s.future],
        status: rules.status(history[history.length - 1]),
        busy: false,
        ended: false,
        hint: null,
      });
    },

    redo() {
      const s = get();
      if (s.future.length === 0 || s.busy || s.status.kind !== 'playing') return;
      const [{ state, move }, ...future] = s.future;
      const status = rules.status(state);
      set({ history: [...s.history, state], moves: [...s.moves, move], future, status, hint: null, busy: true });
      timers.push(setTimeout(() => set({ busy: false }), level.moveDurationMs));
      if (status.kind !== 'playing') {
        timers.push(setTimeout(() => set({ ended: true }), level.moveDurationMs + (level.endDelayMs ?? 400)));
      }
    },

    restart() {
      clearTimers();
      set((s) => ({
        history: [rules.initialState],
        moves: [],
        future: [],
        status: rules.status(rules.initialState),
        busy: false,
        hint: null,
        ended: false,
        resetCount: s.resetCount + 1,
      }));
    },

    askHint() {
      const s = get();
      if (s.status.kind !== 'playing') return null;
      const current = s.history[s.history.length - 1];
      const move = nextHint(rules, current);
      if (move == null) return null;
      set({ hint: move, hintsUsed: s.hintsUsed + 1 });
      return rules.describeMove(move, current);
    },
  }));
}
