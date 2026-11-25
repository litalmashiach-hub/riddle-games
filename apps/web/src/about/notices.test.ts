import { describe, expect, it } from 'vitest';
import { LICENCE_NAMES, LICENCE_TEXTS } from './licenceTexts';
import { LICENCES_IN_USE, missingNotices, NOTICES, packageOf } from './notices';

describe('open-source notices', () => {
  it('finds the package of a module path', () => {
    expect(packageOf('/repo/node_modules/.pnpm/three@0.187.0/node_modules/three/build/three.core.js')).toBe('three');
    expect(packageOf('/repo/node_modules/.pnpm/@react-three+fiber@9/node_modules/@react-three/fiber/dist/index.js')).toBe('@react-three/fiber');
    expect(packageOf('\0/repo/node_modules/react/index.js?commonjs-module')).toBe('react');
    expect(packageOf('/repo/levels/01-wolf-two-sheep/src/index.ts')).toBeNull();
  });

  it('reports a shipped package that has no notice', () => {
    expect(missingNotices(['three', 'react', 'left-pad', 'left-pad', '@scope/new'])).toEqual(['@scope/new', 'left-pad']);
    expect(missingNotices(NOTICES.flatMap((n) => n.packages))).toEqual([]);
  });

  it('gives every notice a copyright line and a licence whose full text is shown', () => {
    for (const n of NOTICES) {
      expect(n.copyright.trim().length, n.name).toBeGreaterThan(10);
      expect(LICENCES_IN_USE, n.name).toContain(n.licence);
    }
    expect(new Set(NOTICES.map((n) => n.name)).size).toBe(NOTICES.length);
    for (const id of LICENCES_IN_USE) {
      expect(NOTICES.some((n) => n.licence === id), `${id} is used`).toBe(true);
      expect(LICENCE_NAMES[id]).toBeTruthy();
      expect(LICENCE_TEXTS[id].length, id).toBeGreaterThan(500);
    }
  });

  it('carries the known licences word for word', () => {
    expect(LICENCE_TEXTS.MIT).toContain('The above copyright notice and this permission notice shall be included in all');
    expect(LICENCE_TEXTS.Zlib).toContain('Altered source versions must be plainly marked as such');
    expect(LICENCE_TEXTS['OFL-1.1']).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007');
    expect(LICENCE_TEXTS['Apache-2.0']).toContain('TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION');
    expect(LICENCE_TEXTS['CC0-1.0']).toContain('CC0 1.0 Universal');
  });
});
