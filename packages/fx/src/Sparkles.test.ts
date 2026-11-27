import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { guardSparkleShader, guardSparklesWithin } from './Sparkles';

/** drei's own Sparkles source, as installed. */
function dreiSparkles(): string {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve('@react-three/drei/package.json'));
  return readFileSync(join(root, 'core', 'Sparkles.js'), 'utf8');
}

describe('guardSparkleShader', () => {
  it("takes the division by zero out of drei's sparkle shader", () => {
    const source = dreiSparkles();
    // If drei changes its shader, this fails: look again at whether the dots can still divide by zero.
    expect(source).toContain('0.05 / distanceToCenter');
    const guarded = guardSparkleShader(source);
    expect(guarded).not.toContain('0.05 / distanceToCenter');
    expect(guarded).toContain('0.05 / max(distanceToCenter, 0.001)');
  });

  it('leaves any other shader as it is', () => {
    expect(guardSparkleShader('void main() { gl_FragColor = vec4(1.0); }')).toBe('void main() { gl_FragColor = vec4(1.0); }');
  });
});

describe('guardSparklesWithin', () => {
  const sparkleMaterial = () => new THREE.ShaderMaterial({ fragmentShader: 'void main() { float s = 0.05 / distanceToCenter; }' });

  it('guards the points under it, and only once', () => {
    const group = new THREE.Group();
    const first = new THREE.Points(new THREE.BufferGeometry(), sparkleMaterial());
    group.add(first);
    expect(guardSparklesWithin(group)).toBe(1);
    expect((first.material as THREE.ShaderMaterial).fragmentShader).toContain('max(distanceToCenter, 0.001)');
    expect(guardSparklesWithin(group)).toBe(0);
  });

  it('guards new points that take the place of the first, as drei makes them when the HD/SD button changes the count', () => {
    const group = new THREE.Group();
    const first = new THREE.Points(new THREE.BufferGeometry(), sparkleMaterial());
    group.add(first);
    guardSparklesWithin(group);
    group.remove(first);
    const next = new THREE.Points(new THREE.BufferGeometry(), sparkleMaterial());
    group.add(next);
    expect(guardSparklesWithin(group)).toBe(1);
    expect((next.material as THREE.ShaderMaterial).fragmentShader).not.toContain('0.05 / distanceToCenter');
  });

  it('passes over nothing and over materials with no shader of their own', () => {
    expect(guardSparklesWithin(null)).toBe(0);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    expect(guardSparklesWithin(group)).toBe(0);
  });
});

describe('the sparkles in the game', () => {
  it("all come from @riddle/fx, never from drei's own Sparkles", () => {
    const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.') || e.name.startsWith('dist')) continue;
        const path = join(dir, e.name);
        if (e.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(e.name)) files.push(path);
      }
    };
    for (const top of ['apps', 'levels', 'packages']) walk(join(repo, top));
    const own = join(repo, 'packages', 'fx', 'src', 'Sparkles.tsx');
    const fromDrei = files.filter((f) => f !== own && /import\s*\{[^}]*\bSparkles\b[^}]*\}\s*from\s*'@react-three\/drei'/.test(readFileSync(f, 'utf8')));
    expect(fromDrei.map((f) => relative(repo, f))).toEqual([]);
    expect(files.length).toBeGreaterThan(50);
  });
});
