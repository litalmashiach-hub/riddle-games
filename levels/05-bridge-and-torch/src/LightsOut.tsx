import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Flame } from './Torch';

/**
 * The "lights out" gag when the torch dies: the whole picture fades to night
 * and only the explorers' big, blinking cartoon eyes are left.
 */

/** Seconds after the torch died, or -1 while it is still burning. */
const sinceOut = (flame: Flame) => (flame.outAt == null ? -1 : (performance.now() - flame.outAt) / 1000);

/** How dark the scene is, 0..1. Starts a beat after the "pfft". */
export const darkness = (flame: Flame) => {
  const s = sinceOut(flame);
  if (s < 0.25) return 0;
  const t = Math.min(1, (s - 0.25) / 0.45);
  return t * t * (3 - 2 * t);
};

/** A dark veil glued in front of the camera. */
export function Blackout({ flame }: { flame: Flame }) {
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#08040f', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false }),
    [],
  );
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const d = darkness(flame);
    m.visible = d > 0.001;
    mat.opacity = d * 0.9;
    camera.getWorldDirection(dir);
    m.position.copy(camera.position).addScaledVector(dir, 0.3);
    m.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={1000} frustumCulled={false} visible={false}>
      <planeGeometry args={[4, 4]} />
    </mesh>
  );
}

// Brighter than white, so the bloom pass makes the eyes glow.
const eyeWhite = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.65, 1.35), depthTest: false, depthWrite: false, toneMapped: false, fog: false, transparent: true });
const pupil = new THREE.MeshBasicMaterial({ color: '#120a1c', depthTest: false, depthWrite: false, fog: false, transparent: true });

/**
 * Two big glowing eyes floating where an explorer's head is, shown only in the dark.
 * They blink out of sync and dart around nervously.
 */
export function DarkEyes({ flame, height, seed }: { flame: Flame; height: number; seed: number }) {
  const root = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group[]>([]);
  const pupils = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const d = darkness(flame);
    g.visible = d > 0.35;
    if (!g.visible) return;
    const t = clock.elapsedTime + seed * 1.37;
    // Pop in, then blink every ~1.3 s (quick squash), out of sync per explorer.
    const pop = Math.min(1, (d - 0.35) / 0.4);
    const cycle = (t * 0.75) % 1;
    const blink = cycle > 0.9 ? Math.abs(Math.cos(((cycle - 0.9) / 0.1) * Math.PI)) : 1;
    lids.current.forEach((l) => l && l.scale.set(pop, pop * Math.max(0.08, blink), pop));
    // Nervous glances left and right.
    const look = Math.sin(t * 2.3) > 0.3 ? 1 : Math.sin(t * 2.3) < -0.3 ? -1 : 0;
    pupils.current.forEach((p) => p && p.position.set(look * 0.04, -0.01 + Math.sin(t * 9) * 0.004, 0.001));
  });
  return (
    <group ref={root} position={[0, height, 0]} visible={false}>
      <Billboard>
        {[-0.1, 0.1].map((x, i) => (
          <group key={x} position={[x, 0, 0]} ref={(g) => void (g && (lids.current[i] = g))}>
            <mesh material={eyeWhite} renderOrder={1001} scale={[1, 1.3, 1]}>
              <circleGeometry args={[0.085, 20]} />
            </mesh>
            <mesh ref={(m) => void (m && (pupils.current[i] = m))} material={pupil} renderOrder={1002}>
              <circleGeometry args={[0.04, 14]} />
            </mesh>
          </group>
        ))}
      </Billboard>
    </group>
  );
}
