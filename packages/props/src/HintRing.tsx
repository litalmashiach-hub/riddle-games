import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HINT_EDGE, HINT_GOLD, RING_OPACITY, ringBands } from './hintMark';

/** A mark is looked at, never tapped: no ray hits it, so it takes no touch from what it marks. */
export const noHit = () => null;

/** The name every hint mark's mesh carries, so a test can find the marks without asking how they pick. */
export const HINT_MARK = 'hint-mark';

/** Flat bands round the middle, one colour each, as one mesh: the dark edges can never be drawn over the band. */
function bandsGeometry(bands: { from: number; to: number; color: string }[], segments: number, thetaStart = 0) {
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const c = new THREE.Color();
  for (const band of bands) {
    // Read the way a material reads its colour, so a band looks the same as a mesh of that colour.
    c.set(band.color);
    const base = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = thetaStart + (i / segments) * Math.PI * 2;
      for (const r of [band.from, band.to]) {
        positions.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        colors.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2;
      index.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  return g;
}

/** A band from `inner` to `outer` in `color`, with a dark edge inside and outside it. `segments` 4 makes it a square. */
export function edgedBandGeometry(inner: number, outer: number, edge: number, color: string, segments = 48, thetaStart = 0) {
  // With few segments the band's sides are straight and lie nearer the middle than its corners: keep the edge as wide there.
  const e = edge / Math.cos(Math.PI / segments);
  return bandsGeometry(
    [
      { from: Math.max(0, inner - e), to: inner, color: HINT_EDGE },
      { from: inner, to: outer, color },
      { from: outer, to: outer + e, color: HINT_EDGE },
    ],
    segments,
    thetaStart,
  );
}

/** The gentle pulse every hint mark shares: a little larger and smaller, and never fainter than RING_OPACITY.low. */
export function useHintPulse(ref: React.RefObject<THREE.Mesh | null>) {
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const wave = Math.sin(clock.elapsedTime * 5);
    const s = 1 + wave * 0.08;
    m.scale.set(s, s, s);
    (m.material as THREE.MeshBasicMaterial).opacity = (RING_OPACITY.low + RING_OPACITY.high) / 2 + (wave * (RING_OPACITY.high - RING_OPACITY.low)) / 2;
  });
}

/**
 * A glowing pulsing ring on the ground, to point at something (hints, selection).
 * It has a dark edge, so it shows on ground of its own colour too, and it takes no taps.
 * Where the ground at a figure's feet can be hidden by other figures, add a `HintHalo` round the figure.
 */
export function HintRing({
  position,
  radius = 0.55,
  color = HINT_GOLD,
  visible = true,
  renderOrder = 0,
}: {
  position: [number, number, number];
  radius?: number;
  color?: string;
  visible?: boolean;
  /** Raise it where a glow is drawn over the ground late (a sprite with a `renderOrder` of its own), so the glow doesn't wash the ring out. */
  renderOrder?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useHintPulse(ref);
  const geometry = useMemo(() => {
    const b = ringBands(radius);
    return edgedBandGeometry(b.inner, b.outer, b.edge, color);
  }, [radius, color]);
  if (!visible) return null;
  return (
    <mesh ref={ref} position={position} rotation-x={-Math.PI / 2} geometry={geometry} renderOrder={renderOrder} raycast={noHit} name={HINT_MARK}>
      {/* No fog: a world's haze would fade the mark towards the colour of the ground it lies on. */}
      <meshBasicMaterial vertexColors transparent toneMapped={false} depthWrite={false} fog={false} />
    </mesh>
  );
}
