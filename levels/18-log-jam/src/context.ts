import { createContext, useContext } from 'react';
import { JAM, type Jam } from './rules';

/** The jam being played. Level 18 uses its own; a level that reuses this scene provides another. */
export const JamContext = createContext<Jam>(JAM);
export const useJam = () => useContext(JamContext);
