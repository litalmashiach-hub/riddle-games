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
 * The wording is the launch draft's, with the game's name, the publisher and the contact filled in from
 * appInfo.ts. One sentence differs from the draft: "Keeping and deleting" also names the Reset button of
 * this screen. The public web page of the policy must say the same before it is published.
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
              'The game does not connect to the internet while you play.',
            ],
          },
        ],
      },
      {
        heading: 'What is saved on your device',
        blocks: [
          'To remember your progress, the game saves two small things on your own device:',
          { points: ['the stars you have earned on each riddle;', 'your choices for graphics quality and sound.'] },
          'This information never leaves your device. We cannot see it, and nobody else receives it.',
        ],
      },
      {
        heading: 'Sharing',
        blocks: ['Because we collect nothing, we have nothing to share, sell or pass on, and we do not.'],
      },
      {
        heading: 'Keeping and deleting',
        blocks: [
          'We hold no data about you, so there is nothing for us to keep or delete. To erase the progress saved on your device, use Reset progress on the Settings page of this screen, or delete the app.',
        ],
      },
      {
        heading: 'Children',
        blocks: [`${name} is a general-audience game. It collects no information from anyone, of any age.`],
      },
      {
        heading: 'Apple',
        blocks: [
          "You get the app from Apple's App Store. Apple may collect information about downloads and, if you have agreed to share it in your device's settings, about how apps are used and when they crash. That is governed by Apple's own privacy policy, not this one. We do not add anything to it.",
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
