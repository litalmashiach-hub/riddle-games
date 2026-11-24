import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The app's identifier, name, version and build number live in ONE place:
 * ios/AppIdentity.xcconfig. Xcode reads that file directly; this config reads it too,
 * so nothing has to be changed here.
 */
const identity = Object.fromEntries(
  readFileSync(join(__dirname, 'ios', 'AppIdentity.xcconfig'), 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);

const config: CapacitorConfig = {
  appId: identity.APP_BUNDLE_ID,
  appName: identity.APP_DISPLAY_NAME,
  // The app build of the game: `pnpm build:app` (no service worker, no test switches).
  webDir: '../web/dist-app',
  // Shown behind the web view until the game has drawn. Same dark blue as the game and the launch screen.
  backgroundColor: '#0f2236',
  ios: {
    // The page itself never scrolls (lists scroll inside it), so the web view must not scroll or bounce.
    scrollEnabled: false,
    contentInset: 'never',
    allowsLinkPreview: false,
  },
};

export default config;
