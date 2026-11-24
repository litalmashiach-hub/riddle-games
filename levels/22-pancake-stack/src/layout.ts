import type { Vec3 } from '@riddle/fx';
import { PANCAKES } from './rules';

/** Height of the mossy islet. */
export const GROUND = 0.12;
/** Top of the plate the stack stands on. */
export const PLATE_TOP = 0.62;
/** Height of one pancake's slot in the stack. */
export const SLOT = 0.36;
export const THICK = 0.3;

/** Middle of the pancake at `pos` (0 = top of the stack). */
export const slotY = (pos: number) => PLATE_TOP + SLOT / 2 + (PANCAKES - 1 - pos) * SLOT;
export const radiusOf = (size: number) => 0.46 + size * 0.115;

export const CHEF: Vec3 = [-2.15, GROUND, 0.2];
/** Top of the chef's hat, where a runaway pancake lands. */
export const CHEF_HAT: Vec3 = [CHEF[0], GROUND + 1.72 * 1.3, CHEF[2]];
