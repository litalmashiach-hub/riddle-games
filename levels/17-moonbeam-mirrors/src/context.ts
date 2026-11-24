import { createContext, useContext } from 'react';
import { LAYOUT, type Layout } from './rules';

/** The layout being played. Level 17 uses its own; a level that reuses this scene provides another. */
export const LayoutContext = createContext<Layout>(LAYOUT);
export const useLayout = () => useContext(LayoutContext);
