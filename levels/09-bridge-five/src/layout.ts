import type { Vec3 } from '@riddle/fx';
import type { Side, Traveller } from './rules';

/** Island centres sit at x = ±ISLAND_X. Island tops are at y = 0. */
export const ISLAND_X = 4.45;
export const ISLAND_R = 2.45;
/** The bridge spans the gap between the island edges, |x| < GAP_HALF. */
export const GAP_HALF = ISLAND_X - ISLAND_R;
/** Planks run a little onto each island. */
export const BRIDGE_HALF = GAP_HALF + 0.45;
export const SAG = 0.42;

export const sign = (s: Side) => (s === 'L' ? -1 : 1);

/** Deck height at x: flat on the islands, sagging in the middle. */
export function deckY(x: number) {
  const u = Math.min(1, Math.abs(x) / GAP_HALF);
  return -SAG * (1 - u * u) + 0.04;
}

/**
 * A point on an island in local coordinates: `lx` is distance towards the bridge from the island centre,
 * `z` is towards the camera.
 */
export const onIsland = (side: Side, lx: number, z: number, y = 0): Vec3 => [sign(side) * (ISLAND_X - lx), y, z];

/** Where each traveller waits on an island. */
const SLOTS: Record<Traveller, [number, number]> = {
  zip: [1.15, 1.3],
  mira: [0.25, 1.65],
  bo: [-0.7, 0.95],
  elm: [-0.75, -0.3],
  tuk: [0.5, -0.85],
};
export const slot = (t: Traveller, side: Side) => onIsland(side, SLOTS[t][0], SLOTS[t][1]);

/** Lanes on the bridge for the first and second walker. */
export const LANES = [0.17, -0.19];
/** Where picked travellers wait at the bridge head. */
export const waitSpot = (side: Side, i: number) => onIsland(side, i === 0 ? 1.95 : 1.4, i === 0 ? 0.45 : -0.2);
/** Start of the bridge deck on a side. */
export const entry = (side: Side, i: number): Vec3 => [sign(side) * (GAP_HALF + 0.2), deckY(GAP_HALF + 0.2), LANES[i]];
/** Lantern hook on each island. */
export const lanternPost = (side: Side): Vec3 => onIsland(side, 1.5, -1.4);
export const LANTERN_HOOK_Y = 1.15;
