import { jarRow } from '../../../levels/16-firefly-jars/src/layout';
import type { Move, State } from '../../../levels/16-firefly-jars/src/rules';
import type { TapPlayer, Taps } from '../harness';

/**
 * Levels 16 and 25: a tap on a jar lifts out its top firefly, a tap on another jar sends it there.
 * The jars stand where the scene's own jarRow() puts a row of as many jars as the state holds (six in
 * level 16, seven in level 25). A jar is tapped in the middle of what it draws (the glass).
 */
async function tapJar(taps: Taps, jar: number, count: number, why: string) {
  const row = jarRow(count);
  const t = await taps.targetNear(row[jar], { handler: 'onClick', within: 0.3 });
  if (!t) return taps.fault('no-response', `no jar that listens stands at place ${jar + 1} of ${count}`);
  await taps.tapTarget(t, `jar ${jar + 1} (${why})`);
}

const jars: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    await tapJar(taps, move.from, state.jars.length, 'to lift its top firefly');
    // The lift shows only in the picture (the firefly hovers, a ring lights up): nothing of it can be read
    // from the page or from the listening objects, so a short settle stands in for a sign here.
    await taps.page.waitForTimeout(350);
    await tapJar(taps, move.to, state.jars.length, 'to send the firefly there');
  },
};

export const players: Record<string, TapPlayer> = { 'firefly-jars': jars, 'firefly-rainbow': jars };
