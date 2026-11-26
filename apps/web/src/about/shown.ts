import { APP_SHELL } from '../appShell';
import { APP_NAME, WEBSITE_NAME } from './appInfo';

/**
 * WHICH BUILD SHOWS WHAT on the About and settings screen. The one place that decides it.
 *
 * - The app build (`pnpm build:app`) shows all four pages and the working name. Apple asks for the privacy
 *   policy and a contact inside the app.
 * - The website build (`pnpm build`, which every merge to main publishes) shows Settings and Credits only,
 *   under the name the website already carries. The policy and the contact line are not public until the
 *   owner has read and published them, so the website neither shows nor holds them.
 *
 * Both are written as plain choices on APP_SHELL so that the bundler drops the other side: the website's
 * built files then hold no policy text, no contact line and no working name. The build checks that
 * (releaseChecks.ts), and shown.test.ts runs this file in both modes.
 */
export const PAGES = APP_SHELL
  ? ([
      { id: 'settings', label: 'Settings' },
      { id: 'privacy', label: 'Privacy' },
      { id: 'contact', label: 'Contact' },
      { id: 'credits', label: 'Credits' },
    ] as const)
  : ([
      { id: 'settings', label: 'Settings' },
      { id: 'credits', label: 'Credits' },
    ] as const);

export type PageId = 'settings' | 'privacy' | 'contact' | 'credits';

/** The game's name as this build shows it. */
export const SHOWN_NAME: string = APP_SHELL ? APP_NAME : WEBSITE_NAME;
