import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { APP_INFO, APP_ONLY_WORDS, releaseAsked, releaseBlockers } from './src/about/appInfo';
import { identityBlockers } from './src/about/identity';
import { pageNameProblems } from './src/about/pageName';
import { missingNotices, packageOf } from './src/about/notices';
import { policyPhrases } from './src/about/privacyPolicy';

/**
 * Four checks on every build, of the website and of the app alike:
 *
 * 1. Open-source notices. Every npm package whose code or fonts end up in the built files must have a
 *    notice in src/about/notices.ts. A package without one fails the build, by name.
 * 2. Release placeholders. While the contact email, the publisher's name or the policy's date is still a
 *    placeholder in src/about/appInfo.ts, or while the name under the icon, the version or the bundle
 *    identifier in apps/mobile/ios/AppIdentity.xcconfig does not fit it (src/about/identity.ts), a build
 *    with RELEASE=1 in the environment fails. Without
 *    RELEASE=1 (unset, empty, 0 or false) the build only warns, so that everyday builds and the
 *    repository's checks stay green.
 * 3. What each build may say. The website build (which every merge to main publishes) must not hold the
 *    privacy policy, the contact line or the working name anywhere in its built files; the app build must
 *    hold all three. See src/about/shown.ts and docs/about-screen.md.
 * 4. The page's own name. The built index.html's title and the loading mark's spoken label carry the name
 *    this build shows, and the app's page holds no other name (src/about/pageName.ts).
 */
export function releaseChecks(): Plugin {
  let appBuild = false;
  let mode = '';
  let outDir = '';
  return {
    name: 'riddle-release-checks',
    apply: 'build',
    configResolved(config) {
      appBuild = config.mode === 'app';
      mode = config.mode;
      outDir = join(config.root, config.build.outDir);
    },
    buildStart() {
      const blockers = [...releaseBlockers(), ...identityBlockers(readFileSync(new URL('../mobile/ios/AppIdentity.xcconfig', import.meta.url), 'utf8'), APP_INFO)];
      if (blockers.length === 0) return;
      const list = blockers.map((b) => `  - ${b}`).join('\n');
      if (releaseAsked(process.env.RELEASE)) this.error(`NOT READY FOR RELEASE (RELEASE=${process.env.RELEASE}):\n${list}`);
      this.warn(`Not ready for the store yet. A build with RELEASE=1 will fail until these are set:\n${list}`);
    },
    generateBundle(_options, bundle) {
      const shipped = new Set<string>();
      // Code that survived tree-shaking into a chunk.
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        for (const [id, mod] of Object.entries(file.modules)) {
          const pkg = packageOf(id);
          if (pkg && mod.renderedLength > 0) shipped.add(pkg);
        }
      }
      // Stylesheets and their fonts leave no code in a chunk, so they are read from the module graph.
      for (const id of this.getModuleIds()) {
        const pkg = packageOf(id);
        if (pkg && /\.(css|woff2?|ttf|otf)(\?|$)/.test(id)) shipped.add(pkg);
      }
      const missing = missingNotices(shipped);
      if (missing.length > 0) {
        this.error(
          `These packages ship in the game without an open-source notice: ${missing.join(', ')}.\n` +
            'Add each one, with its copyright line and licence, to apps/web/src/about/notices.ts.',
        );
      }
      // What this build says: every built file, code and assets alike, is searched as text.
      const built = Object.values(bundle)
        .map((file) => (file.type === 'chunk' ? file.code : typeof file.source === 'string' ? file.source : ''))
        .join('\n');
      for (const [what, words] of Object.entries(APP_ONLY_WORDS)) {
        const found = built.includes(words);
        if (appBuild && !found) this.error(`The app build has lost its ${what} text ("${words}"). It must keep the Privacy and Contact pages: see apps/web/src/about/shown.ts.`);
        if (!appBuild && found) this.error(`The website build holds the app's ${what} text ("${words}"). The website must not publish it: see apps/web/src/about/shown.ts.`);
      }
      // Every sentence of the policy, not only the one above: the website build holds no run of words from any.
      const phrases = policyPhrases();
      const leaked = phrases.filter((phrase) => built.includes(phrase));
      if (!appBuild && leaked.length > 0) this.error(`The website build holds ${leaked.length} run(s) of words from the app's privacy policy, the first: "${leaked[0]}". The website must not publish it: see apps/web/src/about/shown.ts.`);
      const lost = phrases.filter((phrase) => !built.includes(phrase));
      if (appBuild && lost.length > 0) this.error(`The app build has lost ${lost.length} run(s) of words of its privacy policy, the first: "${lost[0]}". It must keep the Privacy page whole: see apps/web/src/about/shown.ts.`);
      this.info(appBuild ? 'app build: holds the privacy policy, the contact line and the working name' : 'website build: holds no privacy policy, no contact line and no working name');
      this.info(`open-source notices cover all ${shipped.size} packages in the bundle`);
    },
    // The page itself, as written to disk: its title and the loading mark's spoken label carry this build's name.
    closeBundle() {
      const problems = pageNameProblems(readFileSync(join(outDir, 'index.html'), 'utf8'), mode);
      if (problems.length > 0) this.error(`The built index.html does not carry this build's one name:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
      this.info(`index.html: title and loading label say the shown name`);
    },
  };
}
