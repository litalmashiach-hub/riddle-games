import { createContext, useContext } from 'react';
import type { Painter } from './art';
import { MAX_SLIDES } from './rules';

/** What differs between puzzles that share this scene. Level 19 uses the defaults. */
export interface TilesPuzzle {
  /** Shelly's patience. */
  maxSlides: number;
  /** Paints the picture. Left out, it is level 19's portrait of Shelly. */
  painter?: Painter;
  /** The words on the plaque under the finished picture. */
  plaque: string;
}
export const TilesContext = createContext<TilesPuzzle>({ maxSlides: MAX_SLIDES, plaque: 'Shelly' });
export const useTiles = () => useContext(TilesContext);
