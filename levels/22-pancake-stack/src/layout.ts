import type { Vec3 } from '@riddle/fx';
import { PANCAKES } from './rules';

/** Height of the mossy islet. */
export const GROUND = 0.12;
/** Top of the plate the stack stands on. */
export const PLATE_TOP = 0.5;
/**
 * Height of one pancake's slot in the stack, and of a pancake. Big enough that each pancake is a band of 44 points
 * or more to tap on an iPhone held sideways (Apple's smallest comfortable touch target).
 */
export const SLOT = 0.53;
export const THICK = 0.5;

/**
 * A pancake's shape: soft batter, a little narrower underneath, with a ring of crust around its upper half.
 * The camera looks at the stack nearly from the side (see the level's camera), so a wide pancake's rim hides
 * little of a small pancake below it; tucked in underneath, its underside hides less still.
 */
export const BATTER_TOP = 0.95;
export const BATTER_BOTTOM = 0.8;
export const CRUST_THICK = THICK * 0.5;
/** How far above the pancake's middle the crust ring sits. */
export const CRUST_LIFT = THICK * 0.22;

/** Middle of the pancake at `pos` (0 = top of the stack). */
export const slotY = (pos: number) => PLATE_TOP + SLOT / 2 + (PANCAKES - 1 - pos) * SLOT;
/** Sizes a clear step apart, with the smallest wide enough to tap well near its sides too. */
export const radiusOf = (size: number) => 0.7 + size * 0.065;

export const CHEF: Vec3 = [-2.15, GROUND, 0.2];
/** Top of the chef's hat, where a runaway pancake lands. */
export const CHEF_HAT: Vec3 = [CHEF[0], GROUND + 1.72 * 1.3, CHEF[2]];
