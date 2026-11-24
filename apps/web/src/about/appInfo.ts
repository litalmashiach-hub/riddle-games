/**
 * THE GAME'S NAME, CONTACT AND PUBLISHER, as the game itself shows them: the one place to change them.
 * The About screen, the privacy policy inside it and the contact line all read from here.
 * (The name under the home-screen icon and the bundle identifier live in apps/mobile/ios/AppIdentity.xcconfig.)
 *
 * Three values are the owner's and not chosen yet. Each is `null` until then, and the screen leaves its
 * line out. A store build must not ship that way: `RELEASE=1 pnpm test` and any `RELEASE=1` build fail
 * while one of them is still null (see appInfo.test.ts, releaseChecks.ts and docs/about-screen.md).
 */

/** Working name. Change it here when the owner picks the final one. */
export const APP_NAME = 'Riddlebrook';

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
