import type { TapPlayer } from '../harness';
import type { Move, State } from '../../../levels/22-pancake-stack/src/rules';

/** Heights and widths of the stack. From levels/22-pancake-stack/src/layout.ts. */
const PLATE_TOP = 0.62;
const SLOT = 0.36;
const radiusOf = (size: number) => 0.46 + size * 0.115;

/**
 * Level 22: one tap on a pancake flips it with all the pancakes above it. What listens is an unseen
 * slice per pancake that draws nothing, and the camera looks at the stack from the side, so a pancake
 * is seen as its rim. The tap goes to the middle of that rim: the front of the pancake, at half its height.
 */
const pancakes: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const pos = move.count - 1;
    const size = state.stack[pos];
    const y = PLATE_TOP + SLOT / 2 + (state.stack.length - 1 - pos) * SLOT;
    await taps.tapWorld([0, y, radiusOf(size)], `pancake ${pos + 1} from the top (size ${size})`);
  },
};

export const players: Record<string, TapPlayer> = { 'pancake-stack': pancakes };
