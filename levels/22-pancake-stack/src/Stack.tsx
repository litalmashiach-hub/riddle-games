import { useFrame } from '@react-three/fiber';
import { easeInOut, reducedMotion } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { CHEF_HAT, SLOT, THICK, radiusOf, slotY } from './layout';
import { PANCAKES } from './rules';

export const FLIP_MS = 640;
export type StackGag = null | 'wobble' | 'topple' | 'flopped';

/** Batter colours, pale for the small ones and toastier for the big ones, so sizes are easy to tell apart. */
const BATTER = ['#ffe6a3', '#ffd98a', '#f9c871', '#f0b65c', '#e6a44b', '#d9913d'];
const CRUST = ['#e9b760', '#e0a850', '#d69843', '#cb8938', '#bf7a2f', '#b26c27'];

interface Flip {
  start: number;
  /** Height of the middle of the flipped part. */
  centre: number;
  /** This pancake's height above that middle before the flip. */
  offset: number;
  lift: number;
}

/**
 * The pancakes. `stack` lists sizes from the top down. When `flip` changes (a new move), the top `count` pancakes
 * turn over together around their middle, lifted just enough to clear the rest. Undo and restart slide them back.
 */
export function Stack({ stack, before, flip, hintCount, gag, party }: { stack: number[]; before: number[] | null; flip: { id: string; count: number } | null; hintCount: number; gag: StackGag; party: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  // Where each pancake is when the level opens. After that only the frame loop moves them, so nothing ever jumps.
  const [first] = useState(stack);
  const flips = useRef<(Flip | null)[]>(Array.from({ length: PANCAKES }, () => null));
  const seen = useRef<string | null>(null);
  const gagAt = useRef(0);
  const lastGag = useRef<StackGag>(null);
  if (gag !== lastGag.current) {
    lastGag.current = gag;
    gagAt.current = performance.now();
  }

  // Start a flip: note where each flipped pancake was, relative to the middle of the part that turns.
  if (flip && flip.id !== seen.current && before) {
    seen.current = flip.id;
    const centre = (slotY(0) + slotY(flip.count - 1)) / 2;
    const widest = Math.max(...before.slice(0, flip.count).map(radiusOf));
    const lift = Math.max(0.35, widest - (flip.count * SLOT) / 2 + 0.2);
    const now = performance.now();
    before.forEach((size, pos) => {
      flips.current[size - 1] = pos < flip.count ? { start: now, centre, offset: slotY(pos) - centre, lift } : null;
    });
  } else if (!flip && seen.current) {
    seen.current = null;
    flips.current.fill(null);
  }

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const now = performance.now();
    const ge = (now - gagAt.current) / 1000;
    stack.forEach((size, pos) => {
      const g = refs.current[size - 1];
      if (!g) return;
      const f = flips.current[size - 1];
      const height = PANCAKES - 1 - pos;
      if (f && now - f.start < FLIP_MS) {
        const k = (now - f.start) / FLIP_MS;
        const a = easeInOut(k) * Math.PI;
        g.position.set(-Math.sin(a) * f.offset, f.centre + Math.cos(a) * f.offset + Math.sin(k * Math.PI) * f.lift, 0);
        g.rotation.set(0, 0, a);
        return;
      }
      if (f) flips.current[size - 1] = null;
      // Rest pose, or one of the gags.
      let x = 0;
      let y = slotY(pos);
      let z = 0;
      let rz = 0;
      let speed = 14;
      const still = reducedMotion();
      if (gag === 'wobble') {
        // With Reduce Motion on, the tower leans to one side and holds there instead of wobbling.
        x = still ? 0.03 * height : Math.sin(ge * 9) * 0.045 * height * Math.min(1, ge * 1.5);
      } else if (gag === 'topple' || gag === 'flopped') {
        // With Reduce Motion on, the pancakes are at once in their toppled places instead of sailing there.
        speed = 6;
        if (still) speed = 0;
        if (pos === 0) {
          // The top pancake sails over and lands on the chef's hat.
          [x, y, z] = CHEF_HAT;
          y += THICK / 2;
          rz = 0.12;
        } else {
          // The rest slump sideways into a lazy staircase.
          x = height * 0.4;
          y = slotY(pos) - height * 0.05;
          rz = -0.1 * height;
        }
      } else if (party && !still) {
        // (With Reduce Motion on, the pancakes stay neatly stacked: a held hop would leave them floating apart.)
        y += Math.abs(Math.sin(t * 6 - height * 0.5)) * 0.1;
      } else if (pos < hintCount) {
        x = Math.sin(t * 8) * 0.03;
        rz = Math.sin(t * 8) * 0.02;
      }
      const k = speed === 0 ? 1 : 1 - Math.exp(-speed * dt);
      g.position.x += (x - g.position.x) * k;
      g.position.y += (y - g.position.y) * k;
      g.position.z += (z - g.position.z) * k;
      g.rotation.z += (rz - g.rotation.z) * k;
    });
  });

  return (
    <group>
      {Array.from({ length: PANCAKES }, (_, i) => {
        const size = i + 1;
        const r = radiusOf(size);
        return (
          <group key={size} ref={(g) => void (refs.current[i] = g)} position={[0, slotY(first.indexOf(size)), 0]}>
            <mesh rotation-y={i * 0.5} material={toon(BATTER[i], { rough: 0.9, emissive: BATTER[i], emissiveIntensity: 0.42 })} castShadow receiveShadow>
              <cylinderGeometry args={[r * 0.95, r * 0.95, THICK, 18]} />
            </mesh>
            <mesh rotation-y={i * 0.5} material={toon(CRUST[i], { rough: 0.9, emissive: CRUST[i], emissiveIntensity: 0.3 })} castShadow>
              <cylinderGeometry args={[r, r, THICK * 0.55, 18]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
