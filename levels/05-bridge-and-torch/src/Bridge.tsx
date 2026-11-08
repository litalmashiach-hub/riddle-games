import { seeded } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { BRIDGE_HALF, deckY, dipAt } from './layout';

const PLANKS = 25;
const RAIL_Z = 0.5;
const railY = (x: number) => deckY(x) * 0.55 + 0.82;

/**
 * A sagging rope bridge. The planks dip and sway under whoever is walking on it.
 * `walkers` holds the x positions of everyone currently on the deck.
 */
export function RopeBridge({ walkers }: { walkers: RefObject<number[]> }) {
  const planks = useRef<THREE.InstancedMesh>(null);
  const hangers = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const jitter = useMemo(() => {
    const rnd = seeded(51);
    return Array.from({ length: PLANKS }, () => ({ yaw: (rnd() - 0.5) * 0.12, len: 0.92 + rnd() * 0.14, dz: (rnd() - 0.5) * 0.06, tilt: (rnd() - 0.5) * 0.06 }));
  }, []);
  const plankX = (i: number) => -BRIDGE_HALF + 0.12 + (i * (BRIDGE_HALF * 2 - 0.24)) / (PLANKS - 1);

  useLayoutEffect(() => {
    const m = planks.current;
    if (!m) return;
    const woods = ['#8a5a32', '#9b6a3c', '#7a4c2a', '#a3743f'].map((c) => new THREE.Color(c));
    for (let i = 0; i < PLANKS; i++) m.setColorAt(i, woods[i % woods.length]);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const ws = walkers.current ?? [];
    const sway = (x: number) => Math.sin(t * 1.3 + x * 0.4) * 0.025 * (1 - (x / BRIDGE_HALF) ** 2) * (1 + ws.length * 1.5);
    const dip = (x: number) => ws.reduce((d, wx) => Math.max(d, dipAt(x, wx)), 0);
    const m = planks.current;
    if (m) {
      for (let i = 0; i < PLANKS; i++) {
        const x = plankX(i);
        const j = jitter[i];
        // Slope of the deck so planks follow the curve.
        const slope = Math.atan2(deckY(x + 0.05) - deckY(x - 0.05), 0.1);
        dummy.position.set(x, deckY(x) - dip(x) - 0.03, j.dz + sway(x));
        dummy.rotation.set(sway(x) * 2 + j.tilt, j.yaw, slope);
        dummy.scale.set(1, 1, j.len);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    const h = hangers.current;
    if (h) {
      let n = 0;
      for (let i = 1; i < PLANKS - 1; i += 2) {
        const x = plankX(i);
        const bottom = deckY(x) - dip(x);
        const top = railY(x);
        for (const z of [-RAIL_Z, RAIL_Z]) {
          dummy.position.set(x, (bottom + top) / 2, z + sway(x));
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, top - bottom, 1);
          dummy.updateMatrix();
          h.setMatrixAt(n++, dummy.matrix);
        }
      }
      h.count = n;
      h.instanceMatrix.needsUpdate = true;
    }
  });

  const rope = toon('#c9a56a', { rough: 1 });
  const ropes = useMemo(() => {
    const make = (z: number, y: (x: number) => number, ext: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const x = -BRIDGE_HALF - ext + (i / 24) * (BRIDGE_HALF + ext) * 2;
        pts.push(new THREE.Vector3(x, y(Math.max(-BRIDGE_HALF, Math.min(BRIDGE_HALF, x))), z));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.028, 5, false);
    };
    return [
      make(-RAIL_Z, railY, 0.05),
      make(RAIL_Z, railY, 0.05),
      make(-RAIL_Z, (x) => deckY(x) - 0.06, 0.2),
      make(RAIL_Z, (x) => deckY(x) - 0.06, 0.2),
    ];
  }, []);

  const post = toon('#6d4223');
  return (
    <group>
      <instancedMesh ref={planks} args={[undefined, undefined, PLANKS]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[0.2, 0.05, 1.06]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={hangers} args={[undefined, undefined, PLANKS]} frustumCulled={false} material={rope}>
        <cylinderGeometry args={[0.012, 0.012, 1, 4]} />
      </instancedMesh>
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g} material={rope} castShadow />
      ))}
      {/* posts with rope wraps */}
      {[-1, 1].map((sx) =>
        [-RAIL_Z, RAIL_Z].map((z) => (
          <group key={`${sx}${z}`} position={[sx * (BRIDGE_HALF + 0.08), 0, z]}>
            <mesh position-y={0.3} material={post} castShadow>
              <cylinderGeometry args={[0.07, 0.09, 1.3, 7]} />
            </mesh>
            <mesh position-y={0.97} material={post} castShadow>
              <icosahedronGeometry args={[0.095, 0]} />
            </mesh>
            <mesh position-y={0.8} rotation-x={Math.PI / 2} material={rope}>
              <torusGeometry args={[0.085, 0.025, 4, 10]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}
