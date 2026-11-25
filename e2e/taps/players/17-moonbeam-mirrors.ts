import type { TapPlayer, Vec3 } from '../harness';
import { LAYOUT as MIRRORS_17, type Layout, type Move, type State } from '../../../levels/17-moonbeam-mirrors/src/rules';
import { LAYOUT as MIRRORS_26 } from '../../../levels/26-moonbeam-maze/src/rules';

/** Distance between lily pad centres, and the grid's size. From levels/17-moonbeam-mirrors/src/layout.ts and rules.ts. */
const S = 1.3;
const COLS = 5;
const ROWS = 5;
const cellPos = (c: number, r: number): Vec3 => [(c - (COLS - 1) / 2) * S, 0, (r - (ROWS - 1) / 2) * S];

/**
 * Levels 17 and 26: one tap on a crystal turns it. The crystal is found as the listening object that
 * stands on the mirror's lily pad (the level's own layout says which pad), and tapped in the middle
 * of what it draws: its turn track, pedestal and shard.
 */
const mirrors = (layout: Layout): TapPlayer<State, Move> => ({
  async move(taps, move) {
    const m = layout.mirrors[move.mirror];
    const crystal = await taps.targetNear(cellPos(m.c, m.r), { handler: 'onClick', within: 0.6 });
    if (!crystal) return taps.fault('no-response', `no crystal that listens stands on row ${m.r + 1}, column ${m.c + 1}`);
    await taps.tapTarget(crystal, `the crystal on row ${m.r + 1}, column ${m.c + 1}`);
  },
});

export const players: Record<string, TapPlayer> = { 'moonbeam-mirrors': mirrors(MIRRORS_17), 'moonbeam-maze': mirrors(MIRRORS_26) };
