import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardSparkleShader } from './Sparkles';

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
