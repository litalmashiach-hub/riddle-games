import type { TapPlayer } from '../harness';
import type { Move, State } from '../../../levels/22-pancake-stack/src/rules';

/** Heights and widths of the stack. From levels/22-pancake-stack/src/layout.ts. */
const PLATE_TOP = 0.5;
const SLOT = 0.53;
/** The crust ring, the widest part of a pancake, sits this far above the pancake's middle (CRUST_LIFT). */
const CRUST_LIFT = 0.5 * 0.22;
const radiusOf = (size: number) => 0.66 + size * 0.075;

/**
 * Level 22: one tap on a pancake flips it with all the pancakes above it. What listens is an unseen
 * slice per pancake that draws nothing, and the camera looks at the stack from the side, so a pancake
 * is seen as its rim. The tap goes to the middle of that rim: the front of the pancake's crust ring.
 */
const pancakes: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const pos = move.count - 1;
    const size = state.stack[pos];
    const y = PLATE_TOP + SLOT / 2 + (state.stack.length - 1 - pos) * SLOT + CRUST_LIFT;
    await taps.tapWorld([0, y, radiusOf(size)], `pancake ${pos + 1} from the top (size ${size})`);
  },
};

export const players: Record<string, TapPlayer> = { 'pancake-stack': pancakes };
