import { createContext, useContext } from 'react';
import { BOARD, type Board } from './rules';

/** The board being played. Level 21 uses its own; a level that reuses this scene provides another. */
export const BoardContext = createContext<Board>(BOARD);
export const useBoard = () => useContext(BoardContext);
