/** Installs the offline service worker and asks the browser to keep saved progress. */
export function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline play just won't be available */
    });
    navigator.storage?.persist?.().catch(() => {});
  });
}

/** Stops iPad Safari pinch and double-tap zoom from wrecking the game view. */
export function lockZoom() {
  const stop = (e: Event) => e.preventDefault();
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300 && e.cancelable && (e.target as Element | null)?.tagName === 'CANVAS') e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
}
