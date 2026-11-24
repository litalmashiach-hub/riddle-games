import { APP_SHELL } from './appShell';
import { startHaptics } from './haptics';

/**
 * What makes the game behave like an app and not like a web page, in the native shell only (see docs/ios-app.md).
 * The website is not touched: nothing here runs in its build, and every style rule this switches on sits
 * under `.app-shell` in index.css.
 *
 * Already true for both, in index.css and pwa/register.ts: no text selection, no long-press callout,
 * no tap flash, no pinch or double-tap zoom of the page.
 */
export function startNativeFeel() {
  if (!APP_SHELL) return;
  document.documentElement.classList.add('app-shell');
  // No menu on a long press or a secondary click (iPad with a trackpad or mouse), and nothing can be
  // dragged out of the page. Text that is meant to be copied (`select-text`) keeps its menu.
  document.addEventListener('contextmenu', (e) => {
    if (!(e.target instanceof Element && e.target.closest('.select-text, input, textarea'))) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => e.preventDefault());
  // WebKit shows a button's pressed look (`:active`) reliably only when the page listens for touches.
  document.addEventListener('touchstart', () => {}, { passive: true });
  startHaptics();
}
