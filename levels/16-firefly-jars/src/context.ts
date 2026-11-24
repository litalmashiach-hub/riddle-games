import type { Vec3 } from '@riddle/fx';
import { createContext, useContext } from 'react';
import { JAR_POS } from './layout';
import { PATIENCE, START, type Jar } from './rules';

/** The puzzle being played. Level 16 uses its own; a level that reuses this scene provides another. */
export interface JarsPuzzle {
  start: Jar[];
  patience: number;
  /** Where each jar stands on the raft. */
  row: Vec3[];
}
export const JarsContext = createContext<JarsPuzzle>({ start: START, patience: PATIENCE, row: JAR_POS });
export const useJars = () => useContext(JarsContext);
