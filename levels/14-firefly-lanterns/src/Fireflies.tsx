import { seeded } from '@riddle/fx';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { hdr } from './glow';
import { LANTERN_COLORS, padPos, type Glows } from './layout';
import { CELLS } from './rules';

const PER_LANTERN = 4;

/**
 * Fireflies that circle each lit lantern. On a win they spiral up into the sky;
 * when they get sleepy they sink down onto the pads and stop blinking.
 */
export function LanternFireflies({ glows, party, sleepy }: { glows: Glows; party: boolean; sleepy: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = CELLS * PER_LANTERN;
  const flies = useMemo(() => {
    const rnd = seeded(42);
    return Array.from({ length: count }, (_, i) => ({
      cell: Math.floor(i / PER_LANTERN),
      r: 0.38 + rnd() * 0.25,
      h: 0.25 + rnd() * 0.55,
      sp: (rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 1.2),
      ph: rnd() * Math.PI * 2,
      pos: new THREE.Vector3(),
      init: false,
    }));
  }, [count]);
  const partyStart = useRef(-1);
  useLayoutEffect(() => {
    partyStart.current = party ? performance.now() : -1;
  }, [party]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    flies.forEach((f, i) => m.setColorAt(i, hdr(LANTERN_COLORS[f.cell], 3.2)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [flies]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, dt) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime;
    const pe = partyStart.current < 0 ? -1 : (performance.now() - partyStart.current) / 1000;
    flies.forEach((f, i) => {
      const [x, , z] = padPos(f.cell);
      const g = glows[f.cell];
      const a = t * f.sp + f.ph;
      if (pe >= 0) {
        // spiral up in a big shared swirl above the pond
        const k = Math.min(1, pe / 2.5);
        const ang = a * 0.6 + pe * 2 + i;
        const rad = THREE.MathUtils.lerp(f.r, 1.5 + (i % 7) * 0.35, k);
        goal.set(THREE.MathUtils.lerp(x, 0, k) + Math.cos(ang) * rad, f.h + 0.4 + k * (2.2 + (i % 5) * 0.4), THREE.MathUtils.lerp(z, 0, k) + Math.sin(ang) * rad);
      } else if (sleepy) {
        goal.set(x + Math.cos(f.ph) * f.r * 0.8, 0.07, z + Math.sin(f.ph) * f.r * 0.8);
      } else {
        goal.set(x + Math.cos(a) * f.r, 0.1 + f.h + Math.sin(a * 1.7) * 0.08, z + Math.sin(a) * f.r);
      }
      if (!f.init) {
        f.pos.copy(goal);
        f.init = true;
      }
      f.pos.lerp(goal, Math.min(1, dt * (sleepy ? 1.5 : 6)));
      dummy.position.copy(f.pos);
      const blink = sleepy ? 0.25 : 0.7 + 0.3 * Math.sin(t * 7 + f.ph * 3);
      const show = pe >= 0 ? 1 : g;
      dummy.scale.setScalar(0.035 * blink * Math.min(1, show * 1.4));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
