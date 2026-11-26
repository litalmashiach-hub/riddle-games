import { cellPos } from '../../../levels/15-slippery-pond/src/layout';
import { STEP, type Move, type State } from '../../../levels/15-slippery-pond/src/rules';
import type { TapPlayer, Vec3 } from '../harness';

/**
 * Levels 15 and 24: a tap on the glowing arrow that lies on the ice beside the otter, on the side to
 * slide to. The arrows come back after each slide and grow to full size; the player waits until the
 * arrow is drawn at (nearly) its full width, then taps the middle of what it draws. Only the otter's
 * place from the state is used, so any pond works.
 */
const pond: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const [dx, dy] = STEP[move.dir];
    const here = cellPos(state.x, state.y);
    // The arrow floats 0.72 to 0.80 from the otter, 0.06 over the ice (ArrowPad in levels/15-slippery-pond/src/Scene.tsx).
    const place: Vec3 = [here[0] + dx * 0.76, 0.06, here[2] + dy * 0.76];
    // The arrow's shape is 0.44 wide and 0.46 long: on the screen it is at least as wide as 0.4 of the world there.
    const a = await taps.screenOf([place[0] - 0.2, place[1], place[2]]);
    const b = await taps.screenOf([place[0] + 0.2, place[1], place[2]]);
    const full = Math.abs(b.x - a.x);
    const end = Date.now() + 10_000;
    for (;;) {
      const arrow = await taps.targetNear(place, { handler: 'onClick', within: 0.3 });
      if (arrow?.drawn && arrow.drawn.x1 - arrow.drawn.x0 >= full * 0.9) {
        await taps.tapTarget(arrow, `the ${move.dir} arrow`);
        return;
      }
      if (Date.now() > end) return taps.fault('no-response', `the ${move.dir} arrow did not show at full size beside the otter at column ${state.x}, row ${state.y}`);
      await taps.page.waitForTimeout(150);
    }
  },
};

export const players: Record<string, TapPlayer> = { 'slippery-pond': pond, 'frosty-maze': pond };
