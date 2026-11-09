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

/**
 * Stops phone and tablet browsers from zooming the whole page. iOS Safari ignores `user-scalable=no`,
 * so a pinch on the buttons or the level list could zoom the page and leave it stuck. The 3D view
 * still gets its own pinch (OrbitControls reads pointer events, which a blocked page zoom doesn't stop).
 */
export function lockZoom() {
  const stop = (e: Event) => e.preventDefault();
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, stop, { passive: false });
  // Two-finger moves never scroll anything here, so blocking them only blocks page zoom.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300 && e.cancelable && (e.target as Element | null)?.tagName === 'CANVAS') e.preventDefault();
      lastTouchEnd = now;
      if (e.touches.length === 0) resetPageZoom();
    },
    { passive: false },
  );
  // Turning the phone can leave Safari zoomed in on the new layout.
  window.addEventListener('orientationchange', () => setTimeout(resetPageZoom, 350));
  window.visualViewport?.addEventListener('resize', () => setTimeout(resetPageZoom, 350));
}

/** If the page somehow got zoomed anyway, snap it back to normal size. */
function resetPageZoom() {
  const vv = window.visualViewport;
  if (!vv || Math.abs(vv.scale - 1) < 0.01) return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  if (!meta) return;
  const content = meta.content;
  meta.content = content.replace(/initial-scale=[\d.]+/, 'initial-scale=1.0');
  requestAnimationFrame(() => (meta.content = content));
  window.scrollTo(window.scrollX, window.scrollY);
}
