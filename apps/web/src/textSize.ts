import { useSyncExternalStore } from 'react';
import { APP_SHELL, hasTestFlag } from './appShell';

/**
 * Larger Text: the game's words follow the text size the player chose on the iPhone or iPad
 * (Settings, Display & Text Size, Larger Text, the accessibility sizes included). See docs/larger-text.md.
 *
 * A web view does not do this by itself. But WebKit gives the font keyword `-apple-system-body` the size
 * of the system's body text at the chosen setting (17 points at the standard size, 53 at the largest),
 * and changes it when the setting changes. A hidden probe in the page wears that font; its size, against
 * the standard 17, is how much the words grow. It is written to `--text-grow` on <html>, and every text
 * size of the shell's styles (index.css, `@theme`) is multiplied by it. Spacing, icons and the 3D scene
 * stay as they are.
 *
 * The app only: the website is left as it is, bar `?debug`, which the tests use to reach every card.
 * Anywhere else the keyword is unknown or small (Chromium, desktop Safari), the probe keeps its plain
 * 17px, and the words keep their sizes.
 */

/** The size of iOS's body text at the standard setting, in points (CSS px in the web view). */
export const STANDARD_BODY = 17;
/**
 * How far the words grow: twice their size, which Apple's Larger Text label asks of an app (about 200%).
 * iOS reaches that at its third accessibility size; the two larger ones get the same, so that the cards
 * still fit a small iPhone held sideways.
 */
export const MOST_GROWTH = 2;

/** How much the words grow for a system body text of `bodyPx`. Smaller settings keep the game's own sizes. */
export function textGrowth(bodyPx: number) {
  if (!Number.isFinite(bodyPx) || bodyPx <= 0) return 1;
  const g = Math.min(MOST_GROWTH, Math.max(1, bodyPx / STANDARD_BODY));
  return Math.round(g * 1000) / 1000;
}

export function startTextSize() {
  if (!APP_SHELL && !hasTestFlag('debug')) return;
  const root = document.documentElement;
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.dataset.textSizeProbe = '';
  // The plain 17px first: where the keyword is unknown, the declaration after it is dropped and 17px stays.
  probe.style.cssText = 'display:inline-block;position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;font-size:17px;font:-apple-system-body;';
  probe.textContent = 'Aa';
  document.body.append(probe);
  let shown = '';
  const apply = () => {
    const grow = String(textGrowth(parseFloat(getComputedStyle(probe).fontSize)));
    if (grow === shown) return;
    shown = grow;
    root.style.setProperty('--text-grow', grow);
    root.dataset.textGrow = grow;
  };
  apply();
  // The probe's box changes with its font, so a changed setting is seen at once; coming back to the app checks again.
  new ResizeObserver(apply).observe(probe);
  document.addEventListener('visibilitychange', apply);
  window.addEventListener('focus', apply);
}

/** The growth now in force: 1 on the website and at the standard size. */
export function currentTextGrowth() {
  return Number(document.documentElement.dataset.textGrow ?? 1) || 1;
}

function watchGrowth(changed: () => void) {
  const watch = new MutationObserver(changed);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-text-grow'] });
  return () => watch.disconnect();
}

/**
 * True while the words are grown: for a layout that must change then, beyond what the `grown:` style variant
 * (index.css) can do, like pinning a card's buttons below its words.
 */
export function useTextGrown() {
  return useSyncExternalStore(watchGrowth, () => currentTextGrowth() > 1);
}
