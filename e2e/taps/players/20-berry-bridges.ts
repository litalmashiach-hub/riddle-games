import type { TapPlayer } from '../harness';
import { ISLAND_NAMES, type Move, type State } from '../../../levels/20-berry-bridges/src/rules';

/** Islet centres on the water (x, z) and the height of their mossy top. From levels/20-berry-bridges/src/layout.ts. */
const ISLET_XZ: [number, number][] = [
  [-4.2, -1.8], [-1.0, -2.0], [2.25, -1.95], [5.45, -1.75],
  [-4.25, 1.55], [-1.05, 1.45], [2.2, 1.6], [5.4, 1.5],
];
const TOP = 0.2;

/**
 * Level 20: one tap on an islet sends Bramble there (the first tap picks where he starts). What listens
 * on an islet is an unseen cylinder that draws nothing, so the tap goes to the middle of the islet's
 * mossy top, where its ring glows: the place a person sees as "the islet".
 */
const berryBridges: TapPlayer<State, Move> = {
  async move(taps, move) {
    const [x, z] = ISLET_XZ[move.to];
    await taps.tapWorld([x, TOP, z], `the ${ISLAND_NAMES[move.to]} islet`);
  },
};

export const players: Record<string, TapPlayer> = { 'berry-bridges': berryBridges };
