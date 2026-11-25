import type { Move, State } from '../../../levels/10-four-pillar-tower/src/rules';
import type { TapPlayer, Taps, Vec3 } from '../harness';

/** From levels/10-four-pillar-tower/src/Scene.tsx: pillar places (PX) and where a lifted cog hovers (LIFT = BASE + COGS * T + 0.62). */
const PX = [-3.75, -1.25, 1.25, 3.75];
const LIFT = 0.46 + 6 * 0.24 + 0.62;
const NAME = ['the first pillar', 'the second pillar', 'the third pillar', 'the fourth pillar'];

async function tapPillar(taps: Taps, p: number) {
  const place: Vec3 = [PX[p], 0, 0];
  const pillar = await taps.targetNear(place, { handler: 'onClick', within: 0.3 });
  if (!pillar) return taps.fault('no-response', `nothing that listens stands at the place of ${NAME[p]}`);
  await taps.tapTarget(pillar, NAME[p]);
}

/**
 * Level 10: tap a pillar to lift its top cog, then tap the pillar it goes to. Each tap goes to the
 * middle of the pillar as drawn (socket, rod and lamp); a cog in front of that spot listens too and
 * stands for its own pillar. The sign that the first tap took: a cog hovers over the pillar.
 */
const fourPillars: TapPlayer<State, Move> = {
  async move(taps, move) {
    await tapPillar(taps, move.from);
    const over: Vec3 = [PX[move.from], LIFT, 0];
    const end = Date.now() + 10_000;
    while (!(await taps.targetNear(over, { handler: 'onClick', within: 0.25 }))) {
      if (Date.now() > end) return taps.fault('no-response', `no cog rose over ${NAME[move.from]}: ${taps.lastTouch()}`);
      await taps.page.waitForTimeout(100);
    }
    await tapPillar(taps, move.to);
  },
};

export const players: Record<string, TapPlayer> = { 'four-pillar-tower': fourPillars };
