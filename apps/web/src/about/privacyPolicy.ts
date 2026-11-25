import { APP_INFO, type AppInfo } from './appInfo';

/** One block of the policy: a paragraph, or a list of points. */
export type PolicyBlock = string | { points: string[] };

export interface PolicySection {
  heading: string;
  blocks: PolicyBlock[];
}

export interface PrivacyPolicy {
  title: string;
  /** Left out until the owner sets the date. */
  effective: string | null;
  intro: string;
  /** The one-line summary, shown in bold. */
  short: string;
  sections: PolicySection[];
}

/**
 * The privacy policy, as text inside the game (Apple's guideline 5.1.1(i) wants it reachable in the app).
 * The wording is the launch policy's, word for word, with the game's name, the publisher, the date and the
 * contact filled in from appInfo.ts. The public web page of the policy must say the same before it is
 * published, so the text names "the game's About & settings screen" and not "this screen".
 *
 * What the text says of the game is true of the code, and must stay so: no network call anywhere; two things
 * saved (the stars with the first riddle's pointer flag, and the sound and graphics choices); Reset progress
 * clears the stars and the pointer flag, and keeps the two
 * choices (App.tsx); the Contact page's one link opens the player's own email app (AboutStorePages.tsx).
 */
export function privacyPolicy(info: AppInfo = APP_INFO): PrivacyPolicy {
  const { name } = info;
  return {
    title: `${name} Privacy Policy`,
    effective: info.policyEffectiveDate ? `Effective ${info.policyEffectiveDate}` : null,
    intro: `${name} is a puzzle game${info.publisherName ? ` by ${info.publisherName}` : ''}. This policy covers the ${name} app for iPhone and iPad.`,
    short: `The short version: ${name} collects nothing about you.`,
    sections: [
      {
        heading: 'What we collect',
        blocks: [
          'Nothing. The game does not collect, send or share any personal information or any information about your device or how you play.',
          {
            points: [
              'The game has no accounts and never asks for your name, email address, age or location.',
              'The game contains no advertising and no in-app purchases.',
              'The game contains no analytics, tracking or advertising software from us or from anyone else.',
              'The game never connects to the internet.',
            ],
          },
        ],
      },
      {
        heading: 'What is saved on your device',
        blocks: [
          'To remember your progress, the game saves two small things on your own device:',
          { points: ['the stars you have earned on each riddle, and whether you have seen the short pointer on the first riddle;', 'your choices for graphics quality and sound.'] },
          'The game never sends this information anywhere. We cannot see it, and nobody receives it from us.',
        ],
      },
      {
        heading: 'Sharing',
        blocks: ['Because we collect nothing, we have nothing to share, sell or pass on, and we do not.'],
      },
      {
        heading: 'Keeping and deleting',
        blocks: [
          "We hold no data about you, so there is nothing for us to keep or delete. To erase your stars, use Reset progress on the Settings page of the game's About & settings screen; your sound and graphics choices stay. To erase everything the game has saved, delete the app.",
        ],
      },
      {
        heading: 'If you write to us',
        blocks: [
          "The game's Contact page opens your own email app. If you send us an email, we receive your email address and whatever you write, and we use them only to answer you.",
        ],
      },
      {
        heading: 'Children',
        blocks: [`${name} is a general-audience game. It collects no information from anyone, of any age.`],
      },
      {
        heading: 'Apple',
        blocks: [
          "You get the app from Apple's App Store. Apple may collect information about downloads and, if you have agreed to share it in your device's settings, about how apps are used and when they crash. If you back up your device, the backup may include the game's saved stars and settings, as it does for your other apps. All of that is governed by Apple's own privacy policy, not this one. We do not add anything to it.",
        ],
      },
      {
        heading: 'Changes',
        blocks: ['If a future version of the game changes any of this, we will update this policy and its date before that version is released.'],
      },
      {
        heading: 'Contact',
        blocks: [info.contactEmail ? `Questions about this policy: ${info.contactEmail}` : 'Questions about this policy: see the Contact page of this screen.'],
      },
    ],
  };
}

/**
 * Runs of words from every sentence of the policy, for the search of the built files (releaseChecks.ts and
 * e2e/tests/about.spec.ts): the website build must hold none of them. Each sentence is cut at the game's name
 * and at quote marks, which a bundler may write differently, and pieces too short to be the policy's alone
 * are left out. A new sentence in the policy is covered from the moment it is written above.
 */
export function policyPhrases(info: AppInfo = APP_INFO): string[] {
  const p = privacyPolicy(info);
  const texts = [p.intro, p.short, ...p.sections.flatMap((s) => s.blocks.flatMap((b) => (typeof b === 'string' ? [b] : b.points)))];
  const cuts = [info.name, info.publisherName, info.contactEmail, info.policyEffectiveDate].filter((c): c is string => !!c);
  const pieces = texts
    .flatMap((t) => t.split(/(?<=[.;:])\s+/))
    .flatMap((sentence) => cuts.reduce((parts, cut) => parts.flatMap((part) => part.split(cut)), sentence.split(/['"`]/)))
    .map((piece) => piece.trim())
    .filter((piece) => piece.length >= 24);
  return [...new Set(pieces)];
}
