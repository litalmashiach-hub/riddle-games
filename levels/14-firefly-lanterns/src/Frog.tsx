import { toon } from '@riddle/props';
import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useRef } from 'react';
import * as THREE from 'three';

export type FrogGag = null | 'yawn' | 'slip' | 'under' | 'surfaced';

const tmp = new THREE.Vector3();
const GREEN = '#58c96a';
const DARK = '#2f8a48';
const BELLY = '#e7f7a6';

/**
 * Pip the frog, the lantern keeper. Faces +z. The parent group moves it around; this handles
 * its own life: breathing, blinking, a puffing throat, squash and stretch on hops, a happy dance,
 * and the slapstick fall into the pond.
 */
export const Frog = forwardRef<THREE.Group, { happy: boolean; gag: FrogGag }>(function Frog({ happy, gag }, outer) {
  const body = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group[]>([]);
  const throat = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const yawn = useRef<THREE.Mesh>(null);
  const hat = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group[]>([]);
  const lastY = useRef<number | null>(null);
  const stretch = useRef(0);
  const gagAt = useRef(0);
  useEffect(() => {
    gagAt.current = performance.now();
  }, [gag]);

  useFrame(({ clock }, dt) => {
    const b = body.current;
    if (!b) return;
    const t = clock.elapsedTime;
    const ge = (performance.now() - gagAt.current) / 1000;

    // Squash and stretch from how fast the parent is moving up or down.
    const parent = b.parent;
    if (parent) {
      const y = parent.getWorldPosition(tmp).y;
      const vy = lastY.current == null ? 0 : (y - lastY.current) / Math.max(dt, 1e-3);
      lastY.current = y;
      stretch.current += (THREE.MathUtils.clamp(Math.abs(vy) * 0.12, 0, 0.35) - stretch.current) * Math.min(1, dt * 14);
    }
    const breathe = Math.sin(t * 2.2) * 0.025;
    let sy = 1 + breathe + stretch.current;
    let sxz = 1 - breathe * 0.5 - stretch.current * 0.4;
    let px = 0;
    let py = 0;
    let rz = 0;
    let ry = 0;
    let lid = 0.05;

    if (happy) {
      const hop = Math.abs(Math.sin(t * 6));
      py = hop * 0.35;
      ry = t * 4;
      sy *= 1 + (1 - hop) * -0.15;
    }

    if (gag === 'yawn') {
      // sleepy wobble, eyes drooping
      rz = Math.sin(t * 3) * 0.18 * Math.min(1, ge);
      lid = 0.75 + Math.sin(t * 2) * 0.1;
    } else if (gag === 'slip') {
      // tips over off the pad and drops into the water
      const k = Math.min(1, ge / 0.55);
      rz = -k * 1.7;
      px = k * 0.65;
      py = 0.25 * Math.sin(Math.min(1, ge / 0.3) * Math.PI) - Math.max(0, (ge - 0.25) / 0.3) * 0.9;
      lid = 0;
    } else if (gag === 'under') {
      px = 0.65;
      py = -1.2;
    } else if (gag === 'surfaced') {
      // bobbing in the water with just its eyes and a lily flower above the surface
      const rise = Math.min(1, ge / 0.35);
      px = 0.65;
      py = THREE.MathUtils.lerp(-1.2, -0.2, rise) + Math.sin(t * 2.5) * 0.03;
      lid = 0.35 + (Math.sin(t * 1.3) > 0.9 ? 0.6 : 0);
      ry = Math.sin(t * 1.5) * 0.3;
    }

    // Blink every few seconds.
    const blink = (t % 3.7) < 0.12 ? 1 : 0;
    lid = Math.max(lid, blink);

    b.scale.set(sxz, sy, sxz);
    b.position.set(px, py, 0);
    b.rotation.set(0, ry, rz);
    for (const l of lids.current) if (l) l.scale.y = Math.max(0.05, lid);

    if (throat.current) {
      const puff = gag ? 0 : Math.max(0, Math.sin(t * 1.6)) ** 6;
      throat.current.scale.setScalar(0.12 + puff * 0.1);
    }
    if (yawn.current && mouth.current) {
      const y = gag === 'yawn' ? Math.max(0, Math.sin(ge * 2.2)) : 0;
      yawn.current.scale.set(0.09, 0.02 + y * 0.09, 0.05);
      mouth.current.visible = y < 0.2;
    }
    if (hat.current) hat.current.visible = gag === 'surfaced';
    // little leg kicks during a hop
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = -stretch.current * 2.2 * (i < 2 ? 1 : -0.5);
    });
  });

  const eye = (side: number) => (
    <group position={[side * 0.13, 0.26, 0.12]}>
      <mesh material={toon(GREEN)}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.015, 0.045]} material={toon('#ffffff', { rough: 0.3 })}>
        <sphereGeometry args={[0.075, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.02, 0.105]} material={toon('#1b1b2a', { rough: 0.2 })}>
        <sphereGeometry args={[0.035, 8, 6]} />
      </mesh>
      <mesh position={[0.015, 0.04, 0.13]}>
        <sphereGeometry args={[0.012, 6, 4]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* eyelid: a green cap that scales down over the eye */}
      <group ref={(g) => void (g && (lids.current[side < 0 ? 0 : 1] = g))} position={[0, 0.095, 0.02]}>
        <mesh position-y={-0.05} material={toon(DARK)}>
          <sphereGeometry args={[0.083, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
    </group>
  );

  return (
    <group ref={outer}>
      <group ref={body}>
        {/* body */}
        <mesh position-y={0.12} scale={[0.3, 0.22, 0.32]} castShadow material={toon(GREEN)}>
          <icosahedronGeometry args={[1, 2]} />
        </mesh>
        {/* spots */}
        {[
          [-0.12, 0.27, -0.12],
          [0.1, 0.29, -0.05],
          [0.02, 0.25, -0.22],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} scale={[0.05, 0.02, 0.05]} material={toon(DARK)}>
            <sphereGeometry args={[1, 8, 4]} />
          </mesh>
        ))}
        {/* belly */}
        <mesh position={[0, 0.08, 0.13]} scale={[0.22, 0.15, 0.2]} material={toon(BELLY)}>
          <icosahedronGeometry args={[1, 2]} />
        </mesh>
        {/* puffing throat */}
        <mesh ref={throat} position={[0, 0.07, 0.25]} material={toon('#f3ffc4', { rough: 0.4 })}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
        {eye(-1)}
        {eye(1)}
        {/* smile and yawn */}
        <mesh ref={mouth} position={[0, 0.16, 0.29]} rotation={[0.3, 0, Math.PI]} material={toon('#1f5a30')}>
          <torusGeometry args={[0.09, 0.012, 4, 12, Math.PI]} />
        </mesh>
        <mesh ref={yawn} position={[0, 0.15, 0.3]} material={toon('#7a2a3a')}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
        {/* rosy cheeks */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.2, 0.15, 0.22]} scale={[0.045, 0.03, 0.02]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#ff8fa3" roughness={0.6} transparent opacity={0.85} />
          </mesh>
        ))}
        {/* legs: back thighs and front feet */}
        {[-1, 1].map((s, i) => (
          <group key={`b${s}`} ref={(g) => void (g && (legs.current[i] = g))} position={[s * 0.24, 0.06, -0.08]}>
            <mesh scale={[0.11, 0.08, 0.17]} castShadow material={toon(GREEN)}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
            <mesh position={[s * 0.04, -0.06, 0.1]} scale={[0.08, 0.02, 0.1]} material={toon(DARK)}>
              <sphereGeometry args={[1, 8, 4]} />
            </mesh>
          </group>
        ))}
        {[-1, 1].map((s, i) => (
          <group key={`f${s}`} ref={(g) => void (g && (legs.current[i + 2] = g))} position={[s * 0.13, 0.0, 0.2]}>
            <mesh scale={[0.06, 0.02, 0.07]} material={toon(DARK)}>
              <sphereGeometry args={[1, 8, 4]} />
            </mesh>
          </group>
        ))}
        {/* lily flower hat, worn after the dunk */}
        <group ref={hat} position={[0, 0.38, 0]} visible={false}>
          <mesh scale={[0.2, 0.02, 0.2]} material={toon('#3fae5c')}>
            <cylinderGeometry args={[1, 1, 1, 12]} />
          </mesh>
          <mesh position-y={0.06} scale={0.11}>
            <coneGeometry args={[1, 1.1, 7, 1, true]} />
            <meshStandardMaterial color="#ff9ad5" flatShading side={THREE.DoubleSide} emissive="#ff6fbf" emissiveIntensity={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
});
