/**
 * Where the focus goes when a card closes. VoiceOver (and a keyboard) reads on from the focus, so a card
 * that closes hands it back to the control that opened it, or to a named one beside it, and never drops it
 * on the page. A player who taps sees none of this: the focus moves without a ring and without a scroll.
 */

/** True while the player's last input was a key. Only then may a focus that the game moves show its ring. */
let byKeys = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { byKeys = true; }, true);
  window.addEventListener('pointerdown', () => { byKeys = false; }, true);
}

/** Can this element take the focus now: in the page, in view, not disabled, and not under something inert? */
export function canTakeFocus(el: Element | null | undefined): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.isConnected || el === document.body) return false;
  if ((el as HTMLButtonElement).disabled || el.closest('[inert]')) return false;
  return getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
}

/**
 * Focuses without scrolling. After a tap the browser may still draw a ring round a focus that a script moved
 * (it does when the element before had one), so the element is marked and index.css keeps the ring off it.
 */
export function quietFocus(el: HTMLElement) {
  if (byKeys) el.removeAttribute('data-quiet-focus');
  else {
    el.setAttribute('data-quiet-focus', '');
    el.addEventListener('blur', () => el.removeAttribute('data-quiet-focus'), { once: true });
  }
  el.focus({ preventScroll: true });
}

interface Return {
  /** The card that closes; null if it is already out of the page. */
  from: Element | null;
  /** What had the focus when the card opened. */
  opener: Element | null;
  /** Where to look for the stand-ins. */
  root: ParentNode | null | undefined;
  /** CSS selectors, in order of choice, for when the opener is gone, disabled or hidden. */
  fallbacks: string[];
}

/**
 * Hands the focus back as a card closes. Does nothing if the focus has already moved on to something outside
 * the card, such as the next card.
 */
export function returnFocus({ from, opener, root, fallbacks }: Return) {
  const active = document.activeElement;
  if (active && active !== document.body && !from?.contains(active)) return;
  let target: HTMLElement | undefined;
  if (canTakeFocus(opener) && !from?.contains(opener)) target = opener;
  else if (root) {
    for (const sel of fallbacks) {
      target = [...root.querySelectorAll(sel)].find(canTakeFocus);
      if (target) break;
    }
  }
  if (target) quietFocus(target);
}
