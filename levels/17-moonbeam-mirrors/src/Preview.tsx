import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BEAM_Y, beamPath, pointAt, sharedLength, type BeamPath, type THREE_V2 } from './layout';
import { turnPreviews, turned, type Layout, type State } from './rules';

/** Gap between the dots of a preview path. */
const DOT_GAP = 0.24;
const MAX_DOTS = 160;
const noRaycast = () => null;

export interface PreviewLine {
  mirror: number;
  /** Dots along the path the beam would take after that crystal turned, from where it would leave today's beam. */
  dots: THREE_V2[];
  toad: boolean;
  /** Where the warning sits: the end of the would-be beam, at the toad. */
  end: THREE_V2;
}

/** The would-be beams, ready to draw: only the part that differs from today's beam. */
export function previewLines(state: State, layout: Layout, now: BeamPath): PreviewLine[] {
  return turnPreviews(state, layout).map(({ mirror, toad }) => {
    const path = beamPath(turned(state, mirror), layout);
    const from = sharedLength(now, path) + DOT_GAP * 0.75;
    const dots: THREE_V2[] = [];
    for (let d = from; d <= path.total - 0.05; d += DOT_GAP) dots.push(pointAt(path, d, [0, 0]));
    return { mirror, dots, toad, end: pointAt(path, path.total, [0, 0]) };
  });
}

/**
 * A faint dotted line from each crystal in the beam, along the way the beam would go if that crystal were
 * turned, and a red "!" where it would reach the toad. Draws nothing that can be tapped.
 */
export function TurnPreview({ state, layout, path, show }: { state: State; layout: Layout; path: BeamPath; show: boolean }) {
  const lines = useMemo(() => previewLines(state, layout, path), [state, layout, path]);
  const safe = useRef<THREE.InstancedMesh>(null);
  const risky = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 6), []);
  const mats = useMemo(
    () => ({
      safe: new THREE.MeshBasicMaterial({ color: '#dcd6ff', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }),
      risky: new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
    }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mats.safe.opacity = 0.42 + Math.sin(t * 2.4) * 0.1;
    mats.risky.opacity = 0.62 + Math.sin(t * 3.2) * 0.12;
    for (const [mesh, toad] of [
      [safe.current, false],
      [risky.current, true],
    ] as const) {
      if (!mesh) continue;
      let n = 0;
      if (show) {
        for (const line of lines) {
          if (line.toad !== toad) continue;
          for (const [x, z] of line.dots) {
            if (n >= MAX_DOTS) break;
            dummy.position.set(x, BEAM_Y - 0.04, z);
            dummy.updateMatrix();
            mesh.setMatrixAt(n++, dummy.matrix);
          }
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={safe} args={[geo, mats.safe, MAX_DOTS]} frustumCulled={false} raycast={noRaycast} renderOrder={2} />
      <instancedMesh ref={risky} args={[geo, mats.risky, MAX_DOTS]} frustumCulled={false} raycast={noRaycast} renderOrder={2} />
      {/* Every risky path ends at the same toad: one mark is enough. */}
      {show &&
        lines
          .filter((l) => l.toad)
          .slice(0, 1)
          .map((l) => (
            <Html key="toad" position={[l.end[0], BEAM_Y + 0.55, l.end[1]]} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
              <div
                data-turn-warning
                aria-hidden
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'Fredoka, system-ui, sans-serif',
                  fontWeight: 800,
                  fontSize: 18,
                  lineHeight: 1,
                  color: '#fff',
                  background: 'linear-gradient(#ff6b7a,#e11d48)',
                  border: '2px solid #ffe4e6',
                  boxShadow: '0 3px 10px rgba(0,0,0,.4)',
                }}
              >
                !
              </div>
            </Html>
          ))}
    </group>
  );
}
