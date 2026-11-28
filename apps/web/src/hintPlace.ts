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

/**
 * Where to put the toast so that it covers none of `buttons`: `lift` pixels up, as `liftClear` gives, and `shift`
 * pixels to the side (right is positive). It moves sideways only when no lift alone clears every button, as on a
 * small phone at the largest text size, where the explorers' labels in level 5 fill the room above its Cross
 * button. Then it tries each place just beside a button, kept inside `room` (the left and right ends it may use),
 * and takes the one that clears them all with the shortest step aside, and of equals the smallest lift. If none
 * does, it stays in the middle, at the lift `liftClear` gives.
 */
export function placeClear(toast: Box, buttons: Box[], highest: number, room: { left: number; right: number }, gap = CLEAR_GAP): { lift: number; shift: number } {
  const at = (shift: number, lift: number) => ({ left: toast.left + shift, right: toast.right + shift, top: toast.top - lift, bottom: toast.bottom - lift });
  const clears = (shift: number, lift: number) => !buttons.some((b) => overlaps(at(shift, lift), b));
  const lift = liftClear(toast, buttons, highest, gap);
  if (clears(0, lift)) return { lift, shift: 0 };
  const shifts = new Set<number>();
  for (const b of buttons) {
    shifts.add(Math.round(b.right + gap - toast.left));
    shifts.add(Math.round(b.left - gap - toast.right));
  }
  let best: { lift: number; shift: number } | null = null;
  for (const shift of shifts) {
    if (shift === 0 || toast.left + shift < room.left || toast.right + shift > room.right) continue;
    const moved = at(shift, 0);
    const l = liftClear(moved, buttons, highest, gap);
    if (!clears(shift, l)) continue;
    if (!best || Math.abs(shift) < Math.abs(best.shift) || (Math.abs(shift) === Math.abs(best.shift) && l < best.lift)) best = { lift: l, shift };
  }
  return best ?? { lift, shift: 0 };
}

/** True when the toast `toast`, placed as `p` says, covers none of `buttons`. */
export const clearOf = (toast: Box, p: { lift: number; shift: number }, buttons: Box[]) =>
  !buttons.some((b) => overlaps({ left: toast.left + p.shift, right: toast.right + p.shift, top: toast.top - p.lift, bottom: toast.bottom - p.lift }, b));

/** How far the toast's words may shrink in one step, in CSS pixels, when it fits nowhere at its size. */
export const FIT_STEP = 2;

/**
 * Where to put the toast, and at what size of words, so that it covers none of `buttons`. Grown words make the
 * toast so big on a small phone held sideways that no place clears every button: in level 5 at 667 by 375, the
 * explorers' name labels above and the "Pick" button below leave no room for it. Then its words shrink, `FIT_STEP`
 * at a time, from `size` down to no less than `floor`, the standard size, until a place clears them all. `measure`
 * lays the toast out at a size and gives its own place there. If none clears them all, it keeps the floor, where it
 * covers least. Nothing changes where the toast fits at its own size.
 */
export function fitClear(
  measure: (size: number) => Box,
  size: number,
  floor: number,
  buttons: Box[],
  highest: number,
  room: { left: number; right: number },
  gap = CLEAR_GAP,
): { size: number; own: Box; lift: number; shift: number } {
  for (let s = size; ; s = Math.max(floor, s - FIT_STEP)) {
    const own = measure(s);
    const p = placeClear(own, buttons, highest, room, gap);
    if (clearOf(own, p, buttons) || s <= floor) return { size: s, own, ...p };
  }
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
 * once a frame while it is up, since a scene button can follow the camera and the window. Where no lift clears
 * them all, it steps the holder aside (its left and right), and writes that to `data-hint-shift`. Where no place
 * clears them all at the toast's size of words, the words shrink until one does, never below the standard size
 * (`fitClear`): the pill's font size is set, and `data-hint-fit` on the holder holds it in pixels. While the toast is
 * up the words only ever shrink, so it does not flicker between two sizes as the camera moves; each new hint starts
 * at full size. The margin is set here, not through React, so each check sees the place the last one gave. The
 * toast rises no higher than just under `topBar`.
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
        const nowShift = Number(holder.dataset.hintShift) || 0;
        // Its own place: where it would be with no lift and no step aside. The holder's margin and its left and
        // right are all that move it here.
        const ownAt = () => {
          const box = laidOut(el);
          return { left: box.left - nowShift, right: box.right - nowShift, top: box.top + now, bottom: box.bottom + now };
        };
        const buttons = [...scene.querySelectorAll('button')].filter(seen).map((b) => b.getBoundingClientRect());
        const highest = (topBar.current?.getBoundingClientRect().bottom ?? 0) + CLEAR_GAP;
        const room = { left: CLEAR_GAP, right: window.innerWidth - CLEAR_GAP };
        // The size of its words now, and the standard size they never shrink below.
        const size = parseFloat(getComputedStyle(el).fontSize);
        const grow = Number(document.documentElement.dataset.textGrow) || 1;
        const floor = Math.min(size, Math.round(parseFloat(holder.dataset.hintFull ?? String(size)) / grow));
        holder.dataset.hintFull ??= String(size);
        const placed = fitClear(
          (s) => {
            el.style.fontSize = s === parseFloat(holder.dataset.hintFull!) ? '' : `${s}px`;
            return ownAt();
          },
          size,
          floor,
          buttons,
          highest,
          room,
        );
        if (placed.size !== parseFloat(holder.dataset.hintFull!)) holder.dataset.hintFit = String(placed.size);
        const want = Math.round(placed.lift);
        const shift = Math.round(placed.shift);
        if (want !== now) {
          holder.style.marginBottom = want ? `${want}px` : '';
          holder.dataset.hintLift = String(want);
        }
        if (shift !== nowShift) {
          holder.style.left = shift ? `${shift}px` : '';
          holder.style.right = shift ? `${-shift}px` : '';
          holder.dataset.hintShift = String(shift);
        }
      }
      frame = requestAnimationFrame(check);
    };
    check();
    return () => cancelAnimationFrame(frame);
  }, [shown, pill, root, topBar]);
}
