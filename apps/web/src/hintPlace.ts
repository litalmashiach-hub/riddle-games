import { useLayoutEffect, type RefObject } from 'react';

/**
 * Where the hint toast goes, so that it never lies over a button of the level's scene (docs/larger-text.md).
 *
 * The toast sits just above the bottom bar. Several levels pin their own button ("Row across", "Cross")
 * just above that bar too. At the standard text size the two keep apart, but grown words make the toast
 * taller, and on an iPad its top then reaches the scene's button and hides it while the hint shows.
 *
 * So, while the toast is up, it is lifted just as far as it takes to clear every button it would cover,
 * with a small gap. Nothing moves where nothing is covered, so the standard size is as it was.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The gap kept between the toast and a button it steps over, in CSS pixels. */
export const CLEAR_GAP = 8;

/** True when `a` lies over some of `b`. Only touching, or near, is no cover: then the toast keeps its place. */
const overlaps = (a: Box, b: Box) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;

const covered = (a: Box, buttons: Box[]) =>
  buttons.reduce((sum, b) => sum + Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)), 0);

/**
 * How far to lift the toast (pixels, upwards) from its own place `toast` so that it covers none of `buttons`.
 * It goes up past each button it covers, in turn, to `gap` above it; a toast that only comes near a button stays put. It never goes above `highest` (the top of the room it may
 * use, under the top bar): if clearing every button would take it there, it takes the place it reached on the
 * way, its own place included, that covers the least of them.
 */
export function liftClear(toast: Box, buttons: Box[], highest: number, gap = CLEAR_GAP): number {
  const at = (lift: number) => ({ ...toast, top: toast.top - lift, bottom: toast.bottom - lift });
  const tried = [0];
  let lift = 0;
  // Each pass clears at least one more button, so this ends.
  for (let pass = 0; pass <= buttons.length; pass++) {
    const hit = buttons.filter((b) => overlaps(at(lift), b));
    if (!hit.length) return lift;
    const next = lift + Math.max(...hit.map((b) => at(lift).bottom - b.top + gap));
    if (toast.top - next < highest) break;
    lift = next;
    tried.push(lift);
  }
  // No place clears them all: the least covered, and of equals the lowest.
  return tried.reduce((best, l) => (covered(at(l), buttons) < covered(at(best), buttons) ? l : best), 0);
}

const seen = (e: Element) => {
  const r = e.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  for (let p: Element | null = e; p; p = p.parentElement) {
    const c = getComputedStyle(p);
    if (c.visibility === 'hidden' || c.display === 'none' || Number(c.opacity) < 0.05) return false;
  }
  return true;
};

/** The box of `el` as laid out, leaving out every transform: the toast's spring in and out changes nothing here. */
function laidOut(el: HTMLElement): Box {
  let left = 0;
  let top = 0;
  // The play screen fills the window and never scrolls, so the offsets add up to the place in the window.
  for (let at: HTMLElement | null = el; at; at = at.offsetParent as HTMLElement | null) {
    left += at.offsetLeft;
    top += at.offsetTop;
  }
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight };
}

/**
 * Keeps the toast `pill` clear of the scene's own buttons: the page elements that a level lays over its canvas,
 * inside `root`'s canvas holder. It lifts the pill's holder by its bottom margin, and writes the lift in pixels to
 * the holder's `data-hint-lift` for the tests. Checked when the toast comes up, before it is first drawn, and then
 * once a frame while it is up, since a scene button can follow the camera and the window. The margin is set here,
 * not through React, so each check sees the place the last one gave. The toast rises no higher than just under
 * `topBar`.
 */
export function useLiftClear(shown: boolean, pill: RefObject<HTMLElement | null>, root: RefObject<HTMLElement | null>, topBar: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (!shown) return;
    let frame = 0;
    const check = () => {
      const el = pill.current;
      const holder = el?.parentElement;
      const scene = root.current?.querySelector('canvas')?.parentElement?.parentElement;
      if (el && holder && scene) {
        const now = Number(holder.dataset.hintLift) || 0;
        const box = laidOut(el);
        // Its own place: where it would be with no lift. The holder's margin is all that moves it here.
        const own = { ...box, top: box.top + now, bottom: box.bottom + now };
        const buttons = [...scene.querySelectorAll('button')].filter(seen).map((b) => b.getBoundingClientRect());
        const highest = (topBar.current?.getBoundingClientRect().bottom ?? 0) + CLEAR_GAP;
        const want = Math.round(liftClear(own, buttons, highest));
        if (want !== now) {
          holder.style.marginBottom = want ? `${want}px` : '';
          holder.dataset.hintLift = String(want);
        }
      }
      frame = requestAnimationFrame(check);
    };
    check();
    return () => cancelAnimationFrame(frame);
  }, [shown, pill, root, topBar]);
}
