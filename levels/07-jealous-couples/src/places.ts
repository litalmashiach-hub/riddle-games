import { coupleOf, roleOf, type Bird, type Side } from './rules';

/**
 * Where everyone stands and sits. No React and no Three.js in here, so that the real-tap run
 * (e2e/taps/players/07-jealous-couples.ts) and the unit tests read the very places the scene draws.
 */
export type Vec3 = [number, number, number];

/** The gap is between x = -DOCK_X and +DOCK_X; the balloon moors at either end. */
export const DOCK_X = 1.95;
/** Height of the basket's floor in the balloon's own measure, and how much the scene enlarges the balloon. */
export const BASKET_FLOOR = 0.08;
export const BALLOON_SCALE = 1.15;
/** The level's camera (index.ts), kept here so that a test can look at the places through it. */
export const CAMERA = { position: [0, 4.5, 10.2] as Vec3, target: [0, 0.6, 0] as Vec3, fov: 44 };

export const sign = (s: Side) => (s === 'L' ? -1 : 1);

/** The rows of couples stand this far apart, front to back. */
const ROW_GAP = 1.5;
/** How far from the middle of the gap each row's gent and lady stand: the Corals' row (the back), the Teals', the Plums' (the front). */
const GENT_OUT = [3.0, 3.2, 3.4];
const LADY_OUT = [4.2, 4.45, 4.6];

/**
 * Each couple stands together in a row, the gent nearer the dock: the Corals at the back, the Plums
 * in front.
 *
 * The camera looks at an island from the side, so a row further back is drawn nearer the middle of
 * the screen. Each row therefore starts a little further from the dock than the row behind it, and
 * the three rows show as a slanted bunch in which no bird hides behind another: on a small iPhone
 * every bird shows a part of itself about 20 points across (places.test.ts keeps them apart).
 * Before, the Teals stood out of line the other way, the slant was lost, and Mrs Coral showed only
 * a sliver beside Mr Teal's hat.
 */
export const slot = (b: Bird, s: Side): Vec3 => {
  const c = coupleOf(b);
  return [sign(s) * (roleOf(b) === 'gent' ? GENT_OUT : LADY_OUT)[c], 0, (c - 1) * ROW_GAP];
};

/** Two spots in the basket, side by side so both riders face the camera. */
export const seat = (s: Side, i: number): Vec3 => [sign(s) * DOCK_X + (i === 0 ? -0.21 : 0.21), BASKET_FLOOR * BALLOON_SCALE, 0.03];
