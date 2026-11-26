import type { AppInfo } from './appInfo';

/**
 * THE NAME UNDER THE ICON AND THE NAME INSIDE THE GAME must be one name, and the version one version.
 * The first two live in apps/mobile/ios/AppIdentity.xcconfig (Xcode reads it), the others in appInfo.ts
 * (the game reads it). App Review compares the name on the home screen, in the app and on the store
 * (guideline 2.3.7 and 2.3.8), so a store build with RELEASE=1 fails while they differ, or while the
 * bundle identifier is still the example one. Pure: it takes the file's text, so the build check and
 * the unit test share one answer.
 */
export function readIdentity(xcconfig: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of xcconfig.split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('//')) out[m[1]] = m[2];
  }
  return out;
}

export function identityBlockers(xcconfig: string, info: Pick<AppInfo, 'name' | 'version'>): string[] {
  const id = readIdentity(xcconfig);
  const out: string[] = [];
  const where = 'apps/mobile/ios/AppIdentity.xcconfig';
  const shown = id.APP_DISPLAY_NAME ?? '';
  if (shown !== info.name) out.push(`The name under the icon ("${shown}", APP_DISPLAY_NAME in ${where}) is not the name the game shows ("${info.name}", APP_NAME in apps/web/src/about/appInfo.ts): make them one.`);
  if ((id.APP_VERSION ?? '') !== info.version) out.push(`The app's version ("${id.APP_VERSION ?? ''}", APP_VERSION in ${where}) is not the version the game shows ("${info.version}", APP_VERSION in apps/web/src/about/appInfo.ts): make them one.`);
  const bundle = id.APP_BUNDLE_ID ?? '';
  if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+){2,}$/.test(bundle) || /^com\.example\./i.test(bundle)) out.push(`The bundle identifier ("${bundle}", APP_BUNDLE_ID in ${where}) is still the example one: set the owner's own.`);
  return out;
}
