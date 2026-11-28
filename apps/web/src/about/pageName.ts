import { APP_NAME, WEBSITE_NAME } from './appInfo';

/**
 * THE NAME IN index.html: the page title and the loading mark's spoken label ("Loading ..."), which
 * VoiceOver reads at launch before the game has drawn anything. index.html writes the token below in
 * their place, and the build (vite.config.ts) puts in the name the build shows: the working name in the
 * app build, the website's name in the website build, as SHOWN_NAME does in src/about/shown.ts.
 *
 * This file is read by vite.config.ts in Node, so it takes the build's mode as an argument instead of
 * reading import.meta.env. Pure, so the build and the unit test share one answer.
 */
export const NAME_TOKEN = '%SHOWN_NAME%';

/** The name a build of this mode shows (`vite build` is "production", `vite build --mode app` is "app"). */
export function nameForMode(mode: string): string {
  return mode === 'app' ? APP_NAME : WEBSITE_NAME;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** index.html with every token replaced by the name. Fails when the page holds no token, so a lost one cannot pass unseen. */
export function withShownName(html: string, name: string): string {
  if (!html.includes(NAME_TOKEN)) throw new Error(`index.html holds no ${NAME_TOKEN}: the page title and the loading label must take the shown name (see apps/web/src/about/pageName.ts).`);
  return html.split(NAME_TOKEN).join(escapeHtml(name));
}

/**
 * What is wrong with a built index.html, in plain words; empty when nothing is.
 * The title and the loading label must both carry this build's name, and the app build must not carry
 * the website's name anywhere in the page (Apple's reviewer would hear or read two names).
 */
export function pageNameProblems(builtHtml: string, mode: string): string[] {
  const name = escapeHtml(nameForMode(mode));
  const out: string[] = [];
  if (!builtHtml.includes(`<title>${name}</title>`)) out.push(`The page title is not "${nameForMode(mode)}".`);
  if (!builtHtml.includes(`aria-label="Loading ${name}"`)) out.push(`The loading mark's spoken label is not "Loading ${nameForMode(mode)}".`);
  if (builtHtml.includes(NAME_TOKEN)) out.push(`The page still holds the token ${NAME_TOKEN}.`);
  if (mode === 'app' && (APP_NAME as string) !== WEBSITE_NAME && builtHtml.includes(escapeHtml(WEBSITE_NAME))) out.push(`The app's page still says the website's name ("${WEBSITE_NAME}").`);
  return out;
}
