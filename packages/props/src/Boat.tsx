import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { toon } from './materials';

/**
 * A wooden rowboat. Long axis is x (it crosses rivers that run along z).
 * Origin is at the waterline. Children ride inside it.
 */
export const Boat = forwardRef<THREE.Group, { rowing?: boolean; length?: number; children?: ReactNode }>(function Boat(
  { rowing = false, length = 2.5, children },
  ref,
) {
  const bob = useRef<THREE.Group>(null);
  const oarL = useRef<THREE.Group>(null);
  const oarR = useRef<THREE.Group>(null);
  const sx = length / 1.1;

  const hull = useMemo(() => {
    const pts = [
      new THREE.Vector2(0, -0.26),
      new THREE.Vector2(0.28, -0.24),
      new THREE.Vector2(0.45, -0.12),
      new THREE.Vector2(0.53, 0.04),
      new THREE.Vector2(0.56, 0.16),
    ];
    return new THREE.LatheGeometry(pts, 18);
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (bob.current) {
      bob.current.position.y = Math.sin(t * 1.6) * 0.03;
      bob.current.rotation.z = Math.sin(t * 1.1) * 0.025;
      bob.current.rotation.x = Math.sin(t * 1.3 + 1) * 0.02;
    }
    const a = rowing ? Math.sin(t * 6) : 0;
    if (oarL.current) {
      oarL.current.rotation.y = a * 0.6;
      oarL.current.rotation.x = 0.35 + (rowing ? Math.cos(t * 6) * 0.2 : 0);
    }
    if (oarR.current) {
      oarR.current.rotation.y = -a * 0.6;
      oarR.current.rotation.x = -0.35 - (rowing ? Math.cos(t * 6) * 0.2 : 0);
    }
  });

  const wood = toon('#9a6334');
  const woodDark = toon('#6d4223');
  const trim = toon('#e9d5a1');

  return (
    <group ref={ref}>
      <group ref={bob}>
        <group position-y={0.1}>
        <mesh geometry={hull} scale={[sx, 1, 1]} castShadow receiveShadow>
          <meshStandardMaterial color="#2c8c99" roughness={0.7} side={THREE.DoubleSide} flatShading />
        </mesh>
        <mesh geometry={hull} scale={[sx * 0.94, 0.95, 0.92]} position-y={0.02} receiveShadow>
          <meshStandardMaterial color="#b07a45" roughness={0.9} side={THREE.BackSide} flatShading />
        </mesh>
        {/*
          Invisible lid at the waterline. It only writes depth, and draws after solid objects but
          before the (transparent) water, so the river never shows through the inside of the hull.
        */}
        <mesh position-y={0.02} rotation-x={-Math.PI / 2} scale={[sx, 1, 1]} renderOrder={-1}>
          <circleGeometry args={[0.5, 36]} />
          <meshBasicMaterial colorWrite={false} depthWrite transparent />
        </mesh>
        <mesh position-y={0.16} rotation-x={Math.PI / 2} scale={[sx, 1, 1]} material={trim} castShadow>
          <torusGeometry args={[0.56, 0.035, 6, 36]} />
        </mesh>
        {/* floor boards and seats */}
        <mesh position={[0, -0.17, 0]} material={woodDark} receiveShadow>
          <boxGeometry args={[length * 0.75, 0.03, 0.55]} />
        </mesh>
        {[-0.62, 0, 0.62].map((x) => (
          <mesh key={x} position={[x * (length / 2.3), 0.02, 0]} material={wood} castShadow receiveShadow>
            <boxGeometry args={[0.22, 0.05, 1.0 - Math.abs(x) * 0.35]} />
          </mesh>
        ))}
        {/* oars */}
        <group ref={oarL} position={[0, 0.16, 0.55]}>
          <mesh position={[0, 0, 0.55]} rotation-x={Math.PI / 2} material={wood} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 1.3, 6]} />
          </mesh>
          <mesh position={[0, 0, 1.15]} material={wood} castShadow>
            <boxGeometry args={[0.16, 0.02, 0.36]} />
          </mesh>
        </group>
        <group ref={oarR} position={[0, 0.16, -0.55]}>
          <mesh position={[0, 0, -0.55]} rotation-x={Math.PI / 2} material={wood} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 1.3, 6]} />
          </mesh>
          <mesh position={[0, 0, -1.15]} material={wood} castShadow>
            <boxGeometry args={[0.16, 0.02, 0.36]} />
          </mesh>
        </group>
        {children}
        </group>
      </group>
    </group>
  );
});
