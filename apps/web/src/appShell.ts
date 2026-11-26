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
  // TEST ONLY (branch quit-relaunch-mac-test, never for main): an app build made with
  // VITE_APP_TEST_HOOKS=1 exposes the debug hook, so a run in the simulator can read the session.
  if (APP_SHELL && import.meta.env.VITE_APP_TEST_HOOKS === '1') return name === 'debug';
  return !APP_SHELL && new URLSearchParams(location.search).has(name);
}
