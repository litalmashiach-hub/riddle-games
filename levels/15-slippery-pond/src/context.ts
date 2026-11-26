import { createContext, useContext } from 'react';
import { POND, type PondPuzzle } from './rules';

/** The pond being played. Level 15 uses its own; a level that reuses this scene provides another. */
export const PondContext = createContext<PondPuzzle>(POND);
export const usePond = () => useContext(PondContext);
