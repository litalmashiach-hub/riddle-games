import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useRef } from 'react';
import * as THREE from 'three';

export type GuardianMood = 'idle' | 'no' | 'happy';

/**
 * Pip, the little temple monkey who guards the tower. Sits on a stone pedestal,
 * watches the disc you lift, shakes their head at illegal moves and cheers on a win.
 * Faces +z; `lookAt` is a world-space point to turn the head toward.
 */
export function Guardian({ position, yaw, mood, lookAt, scale = 1 }: { position: [number, number, number]; yaw: number; scale?: number; mood: GuardianMood; lookAt: THREE.Vector3 }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const tmp = useRef(new THREE.Vector3());

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const b = body.current, h = head.current;
    if (!b || !h || !armL.current || !armR.current || !tail.current || !root.current) return;
    tail.current.rotation.z = Math.sin(t * 1.6) * 0.25;
    b.position.y = 0;
    b.scale.setScalar(1);
    let armUp = 0.2;
    let shake = 0;
    if (mood === 'happy') {
      const j = Math.abs(Math.sin(t * 7));
      b.position.y = j * 0.35;
      b.scale.set(1 + (1 - j) * 0.07, 1 - (1 - j) * 0.09, 1 + (1 - j) * 0.07);
      armUp = 2.5 + Math.sin(t * 14) * 0.25;
    } else if (mood === 'no') {
      shake = Math.sin(t * 22) * 0.45;
      armUp = 0.9;
    } else {
      const br = Math.sin(t * 2) * 0.02;
      b.scale.set(1 + br * 0.5, 1 + br, 1 + br * 0.5);
    }
    armL.current.rotation.z = THREE.MathUtils.lerp(armL.current.rotation.z, armUp, Math.min(1, dt * 10));
    armR.current.rotation.z = THREE.MathUtils.lerp(armR.current.rotation.z, -armUp, Math.min(1, dt * 10));

    // Turn the head toward the point of interest (in the guardian's local frame).
    const local = root.current.worldToLocal(tmp.current.copy(lookAt));
    const targetYaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
    const targetPitch = THREE.MathUtils.clamp(-Math.atan2(local.y - 1.3, Math.hypot(local.x, local.z)), -0.5, 0.4);
    h.rotation.y = THREE.MathUtils.lerp(h.rotation.y, (mood === 'happy' ? 0 : targetYaw) + shake, Math.min(1, dt * 8));
    h.rotation.x = THREE.MathUtils.lerp(h.rotation.x, mood === 'happy' ? -0.25 : targetPitch, Math.min(1, dt * 6));
  });

  const fur = toon('#b9733b');
  const furDark = toon('#8a5229');
  const face = toon('#f3d3a6');
  const stone = toon('#c99560', { rough: 0.95 });
  const jade = toon('#5fe3b0', { emissive: '#2fd69a', emissiveIntensity: 2.5, rough: 0.3 });
  return (
    <group ref={root} position={position} rotation-y={yaw} scale={scale}>
      {/* Pedestal */}
      <mesh position-y={0.4} material={stone} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.8, 1.05]} />
      </mesh>
      <mesh position-y={0.86} material={toon('#dcaa6e')} castShadow receiveShadow>
        <boxGeometry args={[1.25, 0.14, 1.25]} />
      </mesh>
      <mesh position={[0, 0.42, 0.53]} material={jade}>
        <octahedronGeometry args={[0.13, 0]} />
      </mesh>

      <group position-y={0.93}>
      <group ref={body}>
        {/* Tail curling up behind */}
        <group ref={tail} position={[0, 0.15, -0.28]}>
          <mesh position={[0, 0.25, -0.15]} rotation-y={Math.PI / 2} material={furDark} castShadow>
            <torusGeometry args={[0.22, 0.05, 6, 12, Math.PI * 1.4]} />
          </mesh>
        </group>
        {/* Legs, folded in front */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.17, 0.1, 0.14]} rotation-x={Math.PI / 2.3} material={fur} castShadow>
            <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
          </mesh>
        ))}
        {/* Body */}
        <mesh position-y={0.32} scale={[1, 1.15, 0.92]} material={fur} castShadow>
          <icosahedronGeometry args={[0.3, 1]} />
        </mesh>
        <mesh position={[0, 0.3, 0.17]} scale={[1, 1.2, 0.6]} material={face}>
          <icosahedronGeometry args={[0.2, 1]} />
        </mesh>
        {/* Arms */}
        <group ref={armL} position={[0.27, 0.48, 0.02]}>
          <mesh position={[0.05, -0.18, 0.05]} material={fur} castShadow>
            <capsuleGeometry args={[0.065, 0.26, 4, 8]} />
          </mesh>
        </group>
        <group ref={armR} position={[-0.27, 0.48, 0.02]}>
          <mesh position={[-0.05, -0.18, 0.05]} material={fur} castShadow>
            <capsuleGeometry args={[0.065, 0.26, 4, 8]} />
          </mesh>
        </group>
        {/* Head */}
        <group ref={head} position-y={0.78}>
          <mesh material={fur} castShadow>
            <icosahedronGeometry args={[0.27, 1]} />
          </mesh>
          <mesh position={[0, -0.04, 0.14]} scale={[1.15, 0.95, 0.75]} material={face}>
            <icosahedronGeometry args={[0.19, 1]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.28, 0.03, 0]}>
              <mesh scale={[0.5, 1, 1]} material={fur} castShadow>
                <sphereGeometry args={[0.12, 10, 8]} />
              </mesh>
              <mesh position-x={s * 0.03} scale={[0.4, 0.75, 0.75]} material={toon('#e9a48c')}>
                <sphereGeometry args={[0.1, 10, 8]} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.085, 0.03, 0.27]}>
              <mesh material={toon('#ffffff', { flat: false, rough: 0.3 })}>
                <sphereGeometry args={[0.055, 12, 12]} />
              </mesh>
              <mesh position-z={0.035} material={toon('#1a1210', { flat: false, rough: 0.2 })}>
                <sphereGeometry args={[0.032, 10, 10]} />
              </mesh>
              <mesh position={[0.012, 0.015, 0.06]} material={toon('#ffffff', { flat: false, emissive: '#ffffff', emissiveIntensity: 1 })}>
                <sphereGeometry args={[0.009, 6, 6]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.09, 0.3]} material={toon('#5a3420')}>
            <sphereGeometry args={[0.03, 8, 8]} />
          </mesh>
          {/* Jade headband with a gem */}
          <mesh position-y={0.1} rotation-x={Math.PI / 2 - 0.15} material={toon('#d9a441', { metal: 0.8, rough: 0.3 })}>
            <torusGeometry args={[0.255, 0.025, 6, 20]} />
          </mesh>
          <mesh position={[0, 0.14, 0.25]} material={jade}>
            <octahedronGeometry args={[0.05, 0]} />
          </mesh>
        </group>
      </group>
      </group>
    </group>
  );
}
