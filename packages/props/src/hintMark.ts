/**
 * The sizes and shapes of Hint's marks in the scene. No React and no Three.js in here, so that a
 * level's unit tests can read the very numbers the scene draws.
 *
 * A hint mark is gold with a dark edge all round: the gold shows on dim ground, the dark edge on pale
 * or yellow ground, so the mark never rests on its colour alone.
 */
export const HINT_GOLD = '#ffd166';
/** The dark edge round a mark, whatever the mark's own colour. */
export const HINT_EDGE = '#3a2108';

export interface RingBands {
  /** The coloured band runs from `inner` to `outer`. */
  inner: number;
  outer: number;
  /** A dark edge this wide lies inside `inner` and outside `outer`. */
  edge: number;
}

/**
 * The band of a ring that is asked for with this radius.
 *
 * The band's inside stays where it always was (78% of the radius), so a ring covers no more of the
 * thing it is drawn around. A wide ring keeps its old width. A small one, round a figure that is a
 * few points wide on an iPhone, gets a band of at least 0.15, which is about twice as wide as before,
 * and grows outward.
 */
export function ringBands(radius: number): RingBands {
  const inner = radius * 0.78;
  const band = Math.max(0.15, radius * 0.22);
  const edge = Math.min(0.06, Math.max(0.035, radius * 0.05));
  return { inner, outer: inner + band, edge };
}

/** The ring's opacity swings between these, about once in 1.3 seconds: it never fades away. */
export const RING_OPACITY = { low: 0.82, high: 1 };

/**
 * The band of a halo: a ring that stands upright round a figure and faces the camera. It is drawn over
 * the figure, so it is thinner than a ring on the ground and hides little of what it circles.
 */
export function haloBands(radius: number): RingBands {
  return { inner: radius - 0.09, outer: radius, edge: 0.035 };
}

/**
 * For a name label drawn over the scene (a `<div>` in drei's `<Html>`): spread these over the label's
 * own style while Hint points at its figure. The label gets the ring's look, a gold band with a dark
 * edge inside and outside, and swells a little in the ring's own rhythm. It takes up no more room in
 * the page, so labels that step aside for each other stay where they are.
 * A filled gold or green label means "picked" in some levels: this is a band round the label, not a fill.
 */
export const HINT_LABEL_STYLE = {
  boxShadow: `0 0 0 1.5px ${HINT_EDGE}, 0 0 0 5px ${HINT_GOLD}, 0 0 0 6.5px ${HINT_EDGE}, 0 3px 10px 6px rgba(0,0,0,.3)`,
  animation: 'riddle-hint-label 1.26s ease-in-out infinite',
} as const;

// The label's swell. Someone who asked their device for less motion gets the band alone.
if (typeof document !== 'undefined' && !document.getElementById('riddle-hint-label')) {
  const style = document.createElement('style');
  style.id = 'riddle-hint-label';
  style.textContent = '@media (prefers-reduced-motion: no-preference) { @keyframes riddle-hint-label { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } } }';
  document.head.appendChild(style);
}
