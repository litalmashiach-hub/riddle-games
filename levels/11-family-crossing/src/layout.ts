import type { Vec3 } from '@riddle/fx';
import { QUAY_Y } from './Canal';
import type { Person, Side } from './rules';

export const sign = (s: Side) => (s === 'L' ? -1 : 1);

/** Where each person waits on a bank (distance from the canal centre, z). */
export const SLOTS: Record<Person, { x: number; z: number }> = {
  guard: { x: 3.25, z: -1.55 },
  thief: { x: 4.5, z: -1.7 },
  father: { x: 3.3, z: -0.4 },
  mother: { x: 4.45, z: -0.45 },
  sonA: { x: 3.2, z: 0.75 },
  sonB: { x: 4.15, z: 0.85 },
  daughterA: { x: 3.3, z: 1.9 },
  daughterB: { x: 4.3, z: 1.95 },
};

export const slot = (p: Person, side: Side): Vec3 => [sign(side) * SLOTS[p].x, QUAY_Y, SLOTS[p].z];

/** Where the thief ends up after sneaking over to his first victim. */
export function thiefSpot(victim: Person, side: Side): { near: Vec3; end: Vec3 } {
  const home = slot('thief', side);
  const target = slot(victim, side);
  const near: Vec3 = [(target[0] * 3 + home[0]) / 4, QUAY_Y, (target[2] * 3 + home[2]) / 4 - 0.25];
  return { near, end: [near[0] - 0.15, QUAY_Y, near[2] + 0.4] };
}

/** An open spot on the quay where the thief shows off his loot. */
export const thiefGetaway = (side: Side): Vec3 => [sign(side) * 5.5, QUAY_Y, 0.7];
