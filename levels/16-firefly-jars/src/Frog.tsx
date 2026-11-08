import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Lulu, the lagoon frog who keeps the firefly jars. Chunky low-poly, big eyes.
 * mood: idle, happy (party bounce) or dizzy (after the swarm buzzed past).
 * `hop` bumps make a little cheer hop, `nope` bumps shake the head.
 */
export function Frog({ mood, hop, nope }: { mood: 'idle' | 'happy' | 'dizzy'; hop: number; nope: number }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group[]>([]);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const throat = useRef<THREE.Mesh>(null);
  const hopAt = useRef(-10);
  const nopeAt = useRef(-10);
  useEffect(() => {
    if (hop > 0) hopAt.current = performance.now() / 1000;
  }, [hop]);
  useEffect(() => {
    if (nope > 0) nopeAt.current = performance.now() / 1000;
  }, [nope]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = performance.now() / 1000;
    const sh = now - hopAt.current;
    const sn = now - nopeAt.current;
    let y = 0;
    let squash = 1 + Math.sin(t * 2) * 0.02;
    let armUp = 0;
    if (mood === 'happy') {
      const b = Math.abs(Math.sin(t * 5));
      y = b * 0.35;
      squash = 1 + (b < 0.15 ? -0.12 : 0.05);
      armUp = 1;
    }
    if (sh < 0.6) {
      const k = sh / 0.6;
      y = Math.max(y, Math.sin(k * Math.PI) * 0.45);
      armUp = Math.max(armUp, Math.sin(k * Math.PI));
    }
    if (root.current) root.current.position.y = y;
    if (body.current) body.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    if (headRef.current) {
      headRef.current.rotation.y = sn < 0.6 ? Math.sin(sn * 30) * 0.35 * (1 - sn / 0.6) : mood === 'dizzy' ? Math.sin(t * 3) * 0.25 : Math.sin(t * 0.6) * 0.12;
      headRef.current.rotation.z = mood === 'dizzy' ? Math.sin(t * 3 + 1) * 0.18 : 0;
    }
    // Blink every few seconds (dizzy frogs keep their eyes half shut).
    const blink = mood === 'dizzy' ? 0.55 : (t % 3.7) < 0.12 ? 1 : 0.05;
    lids.current.forEach((l) => l && l.scale.set(1, blink, 1));
    const a = 0.3 + armUp * 2.1 + (mood === 'happy' ? Math.sin(t * 10) * 0.3 : 0);
    if (armL.current) armL.current.rotation.z = -a;
    if (armR.current) armR.current.rotation.z = a;
    // Throat pouch puffs like a real frog.
    if (throat.current) {
      const p = 0.75 + Math.max(0, Math.sin(t * 1.3)) * 0.35;
      throat.current.scale.set(p, p * 0.8, p);
    }
  });

  const skin = toon('#7ccf5a');
  const belly = toon('#d9f2a6');
  const dark = toon('#3f8a3a');
  return (
    <group>
      <group ref={root}>
        <group ref={body}>
          {/* Body */}
          <mesh position={[0, 0.28, 0]} scale={[1, 0.82, 0.9]} castShadow material={skin}>
            <icosahedronGeometry args={[0.36, 1]} />
          </mesh>
          <mesh position={[0, 0.24, 0.16]} scale={[0.8, 0.75, 0.6]} material={belly}>
            <icosahedronGeometry args={[0.3, 1]} />
          </mesh>
          <mesh ref={throat} position={[0, 0.36, 0.27]} material={toon('#f2f8c4')}>
            <icosahedronGeometry args={[0.11, 1]} />
          </mesh>
          {/* Spots */}
          {[
            [-0.2, 0.47, -0.12],
            [0.17, 0.5, -0.18],
            [0.02, 0.56, -0.24],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} scale={[1, 0.5, 1]} material={dark}>
              <icosahedronGeometry args={[0.06, 0]} />
            </mesh>
          ))}
          {/* Back legs folded at the sides */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[s * 0.3, 0.12, -0.05]} scale={[0.55, 0.4, 1]} castShadow material={skin}>
                <icosahedronGeometry args={[0.22, 1]} />
              </mesh>
              <mesh position={[s * 0.36, 0.03, 0.18]} scale={[1, 0.3, 1.4]} material={dark}>
                <icosahedronGeometry args={[0.1, 0]} />
              </mesh>
            </group>
          ))}
          {/* Arms */}
          <group ref={armL} position={[-0.26, 0.3, 0.18]}>
            <mesh position={[0, -0.12, 0]} material={skin} castShadow>
              <capsuleGeometry args={[0.05, 0.16, 2, 6]} />
            </mesh>
            <mesh position={[0, -0.24, 0.02]} scale={[1.2, 0.5, 1.2]} material={dark}>
              <icosahedronGeometry args={[0.06, 0]} />
            </mesh>
          </group>
          <group ref={armR} position={[0.26, 0.3, 0.18]}>
            <mesh position={[0, -0.12, 0]} material={skin} castShadow>
              <capsuleGeometry args={[0.05, 0.16, 2, 6]} />
            </mesh>
            <mesh position={[0, -0.24, 0.02]} scale={[1.2, 0.5, 1.2]} material={dark}>
              <icosahedronGeometry args={[0.06, 0]} />
            </mesh>
          </group>
          {/* Head: eyes on top, a wide smile, rosy cheeks */}
          <group ref={headRef} position={[0, 0.5, 0.05]}>
            {[-1, 1].map((s, i) => (
              <group key={s} position={[s * 0.15, 0.12, 0.02]}>
                <mesh material={skin} castShadow>
                  <icosahedronGeometry args={[0.12, 1]} />
                </mesh>
                <mesh position={[0, 0.01, 0.07]}>
                  <sphereGeometry args={[0.085, 14, 10]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.3} />
                </mesh>
                <mesh position={[s * -0.01, 0.0, 0.145]}>
                  <sphereGeometry args={[0.042, 10, 8]} />
                  <meshStandardMaterial color="#1b1530" roughness={0.2} />
                </mesh>
                <mesh position={[s * -0.02, 0.025, 0.18]}>
                  <sphereGeometry args={[0.012, 6, 4]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                {/* Eyelid that closes from the top */}
                <group ref={(g) => void (g && (lids.current[i] = g))} position={[0, 0.09, 0.05]}>
                  <mesh position={[0, -0.05, 0]} scale={[1, 1, 0.9]} material={skin}>
                    <sphereGeometry args={[0.095, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  </mesh>
                </group>
              </group>
            ))}
            <mesh position={[0, -0.04, 0.27]} rotation={[0.25, 0, Math.PI]} material={toon('#2b5a2a')}>
              <torusGeometry args={[0.11, 0.014, 6, 16, Math.PI]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.2, -0.04, 0.22]} scale={[1, 0.6, 0.4]}>
                <sphereGeometry args={[0.045, 8, 6]} />
                <meshStandardMaterial color="#ff8fa8" transparent opacity={0.7} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}
