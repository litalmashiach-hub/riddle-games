/**
 * THE GAME'S NAME, CONTACT AND PUBLISHER, as the game itself shows them: the one place to change them.
 * The About screen, the privacy policy inside it and the contact line all read from here.
 * (The name under the home-screen icon and the bundle identifier live in apps/mobile/ios/AppIdentity.xcconfig.)
 *
 * Three values are the owner's and not chosen yet. Each is `null` until then, and the screen leaves its
 * line out. A store build must not ship that way: `RELEASE=1 pnpm test` and any `RELEASE=1` build fail
 * while one of them is still null (see appInfo.test.ts, releaseChecks.ts and docs/about-screen.md).
 */

/**
 * Working name, shown by the app build only. Change it here when the owner picks the final one.
 * The website build never shows it: see WEBSITE_NAME, and src/about/shown.ts for which build shows what.
 */
export const APP_NAME = 'Riddlebrook';

/** The name the public website carries today, as on the level map and the browser tab. The website build shows this one. */
export const WEBSITE_NAME = 'Riddle Games';

/** The version players see. Keep in step with APP_VERSION in apps/mobile/ios/AppIdentity.xcconfig. */
export const APP_VERSION = '1.0';

/** PLACEHOLDER. The address players write to, e.g. 'hello@example.com'. The owner's to choose. */
export const CONTACT_EMAIL: string | null = null;

/** PLACEHOLDER. The publisher's name exactly as the App Store shows it. The owner's to choose. */
export const PUBLISHER_NAME: string | null = null;

/** PLACEHOLDER. The day the privacy policy takes effect, written out, e.g. '1 December 2026'. */
export const POLICY_EFFECTIVE_DATE: string | null = null;

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;
/** Addresses that are examples, not anyone's mailbox. */
const EXAMPLE_ADDRESS = /@(example\.(com|org|net)|.*\.(example|invalid|test)|localhost)$|^(todo|placeholder|changeme|you|name|email)@/i;

export interface AppInfo {
  name: string;
  version: string;
  contactEmail: string | null;
  publisherName: string | null;
  policyEffectiveDate: string | null;
}

export const APP_INFO: AppInfo = {
  name: APP_NAME,
  version: APP_VERSION,
  contactEmail: CONTACT_EMAIL,
  publisherName: PUBLISHER_NAME,
  policyEffectiveDate: POLICY_EFFECTIVE_DATE,
};

/**
 * Whether a RELEASE value from the environment asks for the release check. Unset, empty, `0` and `false`
 * leave it off; anything else (`1`, `true`, ...) turns it on.
 */
export function releaseAsked(value: string | undefined | null): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v !== '' && v !== '0' && v !== 'false';
}

/**
 * Words that only the Privacy and Contact pages and the working name carry. The website build must hold none
 * of them in its built files, and the app build must hold all of them: the build checks both (releaseChecks.ts),
 * and so does e2e/tests/about.spec.ts on the files as served. Keep each a plain run of text from the page.
 */
export const APP_ONLY_WORDS = {
  policy: 'Because we collect nothing, we have nothing to share, sell or pass on',
  contact: 'The contact address will be here before the game is released',
  name: APP_NAME,
} as const;

/**
 * What still stops a store release, in plain words; empty when nothing does.
 * Pure, so that the unit test and the build check share one answer.
 */
export function releaseBlockers(info: AppInfo = APP_INFO): string[] {
  const out: string[] = [];
  const where = 'apps/web/src/about/appInfo.ts';
  const email = info.contactEmail?.trim() ?? '';
  if (!email) out.push(`The contact email is still a placeholder: set CONTACT_EMAIL in ${where}.`);
  else if (!EMAIL.test(email) || EXAMPLE_ADDRESS.test(email)) out.push(`CONTACT_EMAIL ("${email}") is not a real address: set it in ${where}.`);
  if (!info.publisherName?.trim()) out.push(`The publisher's name is still a placeholder: set PUBLISHER_NAME in ${where}.`);
  if (!info.policyEffectiveDate?.trim()) out.push(`The privacy policy has no effective date: set POLICY_EFFECTIVE_DATE in ${where}.`);
  if (!info.name.trim()) out.push(`The game has no name: set APP_NAME in ${where}.`);
  if (!/^\d+\.\d+(\.\d+)?$/.test(info.version)) out.push(`APP_VERSION ("${info.version}") is not a version number: set it in ${where}.`);
  return out;
}
