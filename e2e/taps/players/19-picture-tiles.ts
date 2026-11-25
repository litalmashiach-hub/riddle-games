import type { TapPlayer, Vec3 } from '../harness';
import type { Move, State } from '../../../levels/19-picture-tiles/src/rules';

/**
 * Where the stone of a cell lies. From levels/19-picture-tiles/src/Scene.tsx (PITCH, TILE_Y = ISLAND_TOP
 * 0.12 + 0.36 + half a stone's height 0.12). The table is three by three in both levels.
 */
const SIZE = 3;
const PITCH = 1.06;
const TILE_Y = 0.6;
const cellPos = (cell: number): Vec3 => [((cell % SIZE) - 1) * PITCH, TILE_Y, (Math.floor(cell / SIZE) - 1) * PITCH];

/**
 * Levels 19 and 28: one tap on a stone next to the gap slides it in. The stone is found as the
 * listening object that lies on the move's cell, and tapped in the middle of what it draws.
 */
const tiles: TapPlayer<State, Move> = {
  async move(taps, move, state) {
    const stone = await taps.targetNear(cellPos(move.cell), { handler: 'onClick', within: 0.4 });
    if (!stone) return taps.fault('no-response', `no stone that listens lies on cell ${move.cell}`);
    await taps.tapTarget(stone, `stone ${state.tiles[move.cell]} on cell ${move.cell}`);
  },
};

export const players: Record<string, TapPlayer> = { 'picture-tiles': tiles, 'family-portrait': tiles };
