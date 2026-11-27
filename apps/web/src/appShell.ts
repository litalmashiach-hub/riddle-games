/**
 * True when the game was built for the native app shell (`vite build --mode app`, see docs/ios-app.md).
 * The website build is the default mode, where this is false and nothing changes.
 */
export const APP_SHELL = import.meta.env.MODE === 'app';

/**
 * Reads a testing switch from the address (`?all`, `?debug`). The app build ignores them:
 * a shipped app must not carry an unlock-everything switch or expose its internals to scripts.
 */
export function hasTestFlag(name: 'all' | 'debug') {
  // TEST ONLY (store-screenshots-test): the app build exposes the debug hook to the screenshot director.
  if (APP_SHELL) return name === 'debug';
  return new URLSearchParams(location.search).has(name);
}
