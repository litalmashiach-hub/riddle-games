import { useFrame } from '@react-three/fiber';
import { sfx, usePath, type Vec3 } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Colour } from './rules';

const LOOK: Record<Colour, { body: string; glow: string; dark: string; wing: string }> = {
  A: { body: '#ffb53e', glow: '#ff8a1f', dark: '#b8651a', wing: '#ffd98a' },
  B: { body: '#62c9ff', glow: '#2a9dff', dark: '#2a6fb5', wing: '#b8ecff' },
};

export const LEAP_MS = 560;

/**
 * One cricket. It leaps to `spot` whenever that changes (`slow` = a real move with a big arc, otherwise a quick hop back).
 * It breathes and twitches its feelers, bobs while chosen, shakes its head when it cannot leap (`nope` counts up),
 * and dances when the riddle is solved.
 */
export function Cricket({ colour, spot, slow, chosen, nope, happy, seed }: { colour: Colour; spot: Vec3; slow: boolean; chosen: boolean; nope: number; happy: boolean; seed: number }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const feelers = useRef<(THREE.Mesh | null)[]>([]);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const nopeAt = useRef(-1e9);
  const landedAt = useRef(-1e9);
  useEffect(() => {
    if (nope) nopeAt.current = performance.now();
  }, [nope]);

  usePath(
    root,
    [
      slow
        ? { to: spot, durationMs: LEAP_MS, height: 1.5, onStart: sfx.hop, onEnd: () => { landedAt.current = performance.now(); sfx.click(); } }
        : { to: spot, durationMs: 300, height: 0.6 },
    ],
    spot.join(','),
    { face: true },
  );

  useFrame(({ clock }, dt) => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    const t = clock.elapsedTime + seed;
    // Once landed, turn back to face the player.
    if (performance.now() - landedAt.current > 250) {
      const d = Math.atan2(Math.sin(-g.rotation.y), Math.cos(-g.rotation.y));
      g.rotation.y += d * Math.min(1, dt * 4);
    }
    const since = (performance.now() - landedAt.current) / 1000;
    const squash = since < 0.35 ? Math.sin((since / 0.35) * Math.PI) * 0.22 : 0;
    let y = 0;
    let ry = 0;
    let sy = 1 + Math.sin(t * 2.6) * 0.03 - squash;
    if (happy) {
      const hop = Math.abs(Math.sin(t * 6.5));
      y = hop * 0.45;
      ry = t * 5;
    } else if (chosen) {
      y = Math.abs(Math.sin(t * 7)) * 0.14;
      sy += 0.04;
    }
    const n = (performance.now() - nopeAt.current) / 1000;
    if (n < 0.45) ry += Math.sin(n * 28) * 0.45 * (1 - n / 0.45);
    b.position.y = y;
    b.rotation.y = ry;
    b.scale.set(1.25 * (1 + squash * 0.5), 1.25 * sy, 1.25 * (1 + squash * 0.5));
    feelers.current.forEach((m, i) => {
      if (m) m.rotation.z = (i ? -1 : 1) * (0.35 + Math.sin(t * 5 + i) * 0.12);
    });
    legs.current.forEach((l) => {
      if (l) l.rotation.x = chosen || happy ? Math.sin(t * 14) * 0.25 : 0;
    });
  });

  const look = LOOK[colour];
  const skin = toon(look.body, { emissive: look.glow, emissiveIntensity: 0.45 });
  const dark = toon(look.dark);
  return (
    <group ref={root}>
      <group ref={body} scale={1.25}>
        <mesh position={[0, 0.2, -0.02]} rotation-x={Math.PI / 2} material={skin} castShadow>
          <capsuleGeometry args={[0.14, 0.3, 3, 8]} />
        </mesh>
        <mesh position={[0, 0.31, -0.12]} rotation-x={Math.PI / 2 - 0.12} scale={[1, 1, 0.5]} material={toon(look.wing, { rough: 0.5 })}>
          <capsuleGeometry args={[0.11, 0.22, 2, 6]} />
        </mesh>
        <mesh position={[0, 0.27, 0.27]} material={skin} castShadow>
          <icosahedronGeometry args={[0.17, 1]} />
        </mesh>
        {[-1, 1].map((s, i) => (
          <group key={s}>
            <mesh position={[s * 0.09, 0.34, 0.39]} material={toon('#17202b', { rough: 0.15, flat: false })}>
              <sphereGeometry args={[0.055, 8, 6]} />
            </mesh>
            <mesh ref={(m) => void (feelers.current[i] = m)} position={[s * 0.07, 0.5, 0.33]} rotation={[0.5, 0, s * 0.35]} material={dark}>
              <cylinderGeometry args={[0.012, 0.018, 0.34, 4]} />
            </mesh>
            {/* big jumping legs: thigh up and back, shin down to the cap */}
            <group ref={(g) => void (legs.current[i] = g)} position={[s * 0.17, 0.16, -0.12]}>
              <mesh position={[0, 0.13, -0.08]} rotation-x={-0.6} material={dark} castShadow>
                <capsuleGeometry args={[0.05, 0.26, 2, 6]} />
              </mesh>
              <mesh position={[0, 0.07, -0.2]} rotation-x={0.45} material={dark}>
                <cylinderGeometry args={[0.022, 0.03, 0.34, 4]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
