import type { Plugin } from 'vite';
import { releaseBlockers } from './src/about/appInfo';
import { missingNotices, packageOf } from './src/about/notices';

/**
 * Two checks on every build, of the website and of the app alike:
 *
 * 1. Open-source notices. Every npm package whose code or fonts end up in the built files must have a
 *    notice in src/about/notices.ts. A package without one fails the build, by name.
 * 2. Release placeholders. While the contact email, the publisher's name or the policy's date is still a
 *    placeholder in src/about/appInfo.ts, a build with RELEASE=1 in the environment fails. Without
 *    RELEASE=1 the build only warns, so that everyday builds and the repository's checks stay green.
 */
export function releaseChecks(): Plugin {
  return {
    name: 'riddle-release-checks',
    apply: 'build',
    buildStart() {
      const blockers = releaseBlockers();
      if (blockers.length === 0) return;
      const list = blockers.map((b) => `  - ${b}`).join('\n');
      if (process.env.RELEASE) this.error(`NOT READY FOR RELEASE (RELEASE=${process.env.RELEASE}):\n${list}`);
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
      this.info(`open-source notices cover all ${shipped.size} packages in the bundle`);
    },
  };
}
