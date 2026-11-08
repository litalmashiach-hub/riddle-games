import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { forwardRef, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { Steam } from './Canal';
import { brass, copper, iron } from './Gear';

/** Height of the raft deck above the water, where riders stand. */
export const DECK_Y = 0.26;
export const RAFT_LENGTH = 2.2;

function PaddleWheel({ z, spin }: { z: number; spin: { current: number } }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = spin.current;
  });
  return (
    <group position={[0, 0.12, z]}>
      <group ref={ref}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} rotation-z={(i / 8) * Math.PI * 2} material={toon('#8a5a33')} castShadow>
            <boxGeometry args={[0.07, 0.62, 0.16]} />
          </mesh>
        ))}
        <mesh material={brass()}>
          <torusGeometry args={[0.24, 0.025, 4, 16]} />
        </mesh>
      </group>
      <mesh rotation-x={Math.PI / 2} material={iron()}>
        <cylinderGeometry args={[0.05, 0.05, 0.22, 8]} />
      </mesh>
    </group>
  );
}

/**
 * A steam-powered raft: plank deck on barrel floats, a little copper boiler with a
 * chimney, and two paddle wheels that churn while it crosses. Long axis is x.
 * Origin is at the waterline. Children ride on the deck.
 */
export const Raft = forwardRef<THREE.Group, { moving?: boolean; /** +1 when heading to +x, -1 toward -x. */ dir?: number; children?: ReactNode }>(function Raft(
  { moving = false, dir = 1, children },
  ref,
) {
  const bob = useRef<THREE.Group>(null);
  const fire = useRef<THREE.MeshStandardMaterial>(null);
  const spin = useRef(0);
  const speed = useRef(0);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    speed.current += ((moving ? 7 : 0.4) - speed.current) * Math.min(1, dt * 3);
    spin.current -= speed.current * dt * dir;
    if (bob.current) {
      bob.current.position.y = Math.sin(t * 1.5) * 0.025;
      bob.current.rotation.z = Math.sin(t * 1.1) * 0.02 + (moving ? Math.sin(t * 8) * 0.006 : 0);
      bob.current.rotation.x = Math.sin(t * 1.3 + 1) * 0.018;
    }
    if (fire.current) fire.current.emissiveIntensity = 2.5 + Math.sin(t * 13) * 0.5 + Math.sin(t * 31) * 0.3 + (moving ? 1.5 : 0);
  });

  const wood = toon('#9a6334');
  const woodDark = toon('#6d4223');
  const half = RAFT_LENGTH / 2;

  return (
    <group ref={ref}>
      <group ref={bob}>
        {/* barrel floats */}
        {[-0.42, 0.42].map((z) => (
          <group key={z} position={[0, 0.02, z]}>
            <mesh rotation-z={Math.PI / 2} material={woodDark} castShadow>
              <cylinderGeometry args={[0.17, 0.17, RAFT_LENGTH - 0.1, 12]} />
            </mesh>
            {[-0.8, 0, 0.8].map((x) => (
              <mesh key={x} position-x={x} rotation-y={Math.PI / 2} material={brass()}>
                <torusGeometry args={[0.172, 0.02, 4, 16]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* deck planks */}
        {[-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].map((z, i) => (
          <mesh key={z} position={[0, DECK_Y - 0.04, z]} rotation-y={(i % 2 ? 1 : -1) * 0.006} material={i % 2 ? wood : toon('#a86f3c')} castShadow receiveShadow>
            <boxGeometry args={[RAFT_LENGTH, 0.07, 0.185]} />
          </mesh>
        ))}
        {/* brass frame */}
        {[-0.62, 0.62].map((z) => (
          <mesh key={z} position={[0, DECK_Y, z]} material={brass()} castShadow>
            <boxGeometry args={[RAFT_LENGTH + 0.06, 0.06, 0.05]} />
          </mesh>
        ))}
        {[-half, half].map((x) => (
          <mesh key={x} position={[x, DECK_Y, 0]} material={brass()} castShadow>
            <boxGeometry args={[0.05, 0.06, 1.28]} />
          </mesh>
        ))}
        {/* boiler on the back edge, between the two seats */}
        <group position={[0, DECK_Y, -0.36]}>
          <mesh position-y={0.24} material={copper()} castShadow>
            <cylinderGeometry args={[0.2, 0.22, 0.48, 12]} />
          </mesh>
          {[0.08, 0.4].map((y) => (
            <mesh key={y} position-y={y} rotation-x={Math.PI / 2} material={brass()}>
              <torusGeometry args={[0.215, 0.022, 4, 16]} />
            </mesh>
          ))}
          <mesh position={[0, 0.16, 0.2]}>
            <circleGeometry args={[0.07, 10]} />
            <meshStandardMaterial ref={fire} color="#ff8a3d" emissive="#ff6a1a" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <mesh position-y={0.52} material={copper()}>
            <sphereGeometry args={[0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.8, 0]} material={iron()} castShadow>
            <cylinderGeometry args={[0.055, 0.06, 0.5, 8]} />
          </mesh>
          <mesh position={[0, 1.07, 0]} material={iron()}>
            <cylinderGeometry args={[0.09, 0.06, 0.08, 8]} />
          </mesh>
          {/* pressure gauge */}
          <mesh position={[0.15, 0.38, 0.13]} rotation-y={0.7} material={toon('#fff2cf')}>
            <circleGeometry args={[0.05, 10]} />
          </mesh>
          <Steam position={[0, 1.1, 0]} count={6} rate={moving ? 2.4 : 0.7} spread={0.05} size={moving ? 0.2 : 0.13} rise={moving ? 1.3 : 0.9} />
        </group>
        {/* paddle wheels on both sides */}
        <PaddleWheel z={-0.76} spin={spin} />
        <PaddleWheel z={0.76} spin={spin} />
        {/* corner lantern */}
        <group position={[half - 0.12, DECK_Y, -0.55]}>
          <mesh position-y={0.35} material={iron()}>
            <cylinderGeometry args={[0.018, 0.018, 0.7, 5]} />
          </mesh>
          <mesh position-y={0.74}>
            <octahedronGeometry args={[0.07, 0]} />
            <meshStandardMaterial color="#ffd38a" emissive="#ffb347" emissiveIntensity={3.5} toneMapped={false} />
          </mesh>
        </group>
        <group position-y={DECK_Y}>{children}</group>
      </group>
    </group>
  );
});
