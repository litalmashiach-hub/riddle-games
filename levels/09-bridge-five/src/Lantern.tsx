import { useFrame } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { LANTERN_MINUTES } from './rules';

/**
 * The brass lantern. Its origin is the hook it hangs from. The candle inside burns down as
 * `minutes` (a ref updated every frame by the scene) climbs towards 30. When `out` turns on,
 * the flame dies with a little puff of smoke.
 */
export function Lantern({ minutes, out, moving }: { minutes: RefObject<number>; out: boolean; moving: RefObject<number> }) {
  const high = useSettings((s) => s.quality) === 'high';
  const swing = useRef<THREE.Group>(null);
  const candle = useRef<THREE.Mesh>(null);
  const flame = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const smoke = useRef<THREE.Group>(null);
  const outAt = useRef<number | null>(null);
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#fff2c4', emissive: new THREE.Color('#ffb84a'), emissiveIntensity: 1.6, transparent: true, opacity: 0.55, roughness: 0.2, flatShading: true }),
    [],
  );
  const fire = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd36b', emissive: new THREE.Color('#ff9a2e'), emissiveIntensity: 4, toneMapped: false }), []);
  const brass = toon('#d9a441', { metal: 0.85, rough: 0.35 });

  useEffect(() => {
    outAt.current = out ? performance.now() : null;
  }, [out]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const left = Math.max(0, 1 - (minutes.current ?? 0) / LANTERN_MINUTES);
    const lit = !out;
    if (swing.current) {
      const m = Math.min(1, moving.current ?? 0);
      swing.current.rotation.z = Math.sin(t * 2.1) * (0.06 + m * 0.18);
      swing.current.rotation.x = Math.sin(t * 1.7 + 1) * (0.04 + m * 0.1);
    }
    const ch = 0.12 + 0.88 * left;
    if (candle.current) {
      candle.current.scale.y = ch;
      candle.current.position.y = -0.4 + 0.08 * ch;
    }
    const flick = 1 + Math.sin(t * 23) * 0.08 + Math.sin(t * 37) * 0.05;
    if (flame.current) {
      const target = lit ? flick : 0;
      const s = THREE.MathUtils.lerp(flame.current.scale.x, target, Math.min(1, dt * 10));
      flame.current.scale.set(s, s * (lit ? 1 : 1.4), s);
      flame.current.position.y = -0.4 + 0.16 * ch + 0.04;
    }
    // Low on time: the light gets jittery and redder.
    const panic = left < 0.2 && lit ? 1 : 0;
    fire.emissive.setRGB(1, 0.6 - panic * 0.25, 0.18);
    const glow = lit ? (1.4 + Math.sin(t * 9) * 0.15 * (1 + panic * 3)) * (0.6 + 0.4 * left) : 0;
    glass.emissiveIntensity = THREE.MathUtils.lerp(glass.emissiveIntensity, glow, Math.min(1, dt * 8));
    if (light.current) light.current.intensity = THREE.MathUtils.lerp(light.current.intensity, lit ? 3.2 * flick * (0.6 + 0.4 * left) : 0, Math.min(1, dt * 8));
    // Smoke puff after going out.
    if (smoke.current) {
      const since = outAt.current == null ? -1 : (performance.now() - outAt.current) / 1000;
      smoke.current.visible = since >= 0 && since < 2.2;
      smoke.current.children.forEach((c, i) => {
        const k = Math.max(0, since - i * 0.18);
        c.position.set(Math.sin(i * 2.3 + k * 2) * 0.08 * k, -0.2 + k * 0.55, Math.cos(i * 1.7) * 0.05 * k);
        c.scale.setScalar(Math.max(0.001, (0.05 + k * 0.12) * (1 - k / 2.2)));
      });
    }
  });

  return (
    <group>
      <group ref={swing}>
        <mesh position-y={-0.03} material={brass}>
          <torusGeometry args={[0.045, 0.012, 5, 10]} />
        </mesh>
        <mesh position-y={-0.12} material={brass} castShadow>
          <coneGeometry args={[0.15, 0.12, 6]} />
        </mesh>
        <mesh position-y={-0.19} material={brass}>
          <cylinderGeometry args={[0.135, 0.135, 0.03, 6]} />
        </mesh>
        <mesh position-y={-0.3} material={glass}>
          <cylinderGeometry args={[0.115, 0.115, 0.2, 6]} />
        </mesh>
        <mesh position-y={-0.415} material={brass} castShadow>
          <cylinderGeometry args={[0.135, 0.11, 0.04, 6]} />
        </mesh>
        <mesh ref={candle} position-y={-0.32} material={toon('#fff7e8', { flat: false })}>
          <cylinderGeometry args={[0.035, 0.035, 0.16, 8]} />
        </mesh>
        <group ref={flame} position-y={-0.2}>
          <mesh material={fire}>
            <coneGeometry args={[0.028, 0.08, 6]} />
          </mesh>
        </group>
        {high && <pointLight ref={light} position-y={-0.28} color="#ffb766" intensity={3} distance={3.5} decay={2} />}
        <group ref={smoke} visible={false}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} material={toon('#9aa0ad', { rough: 1 })}>
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Wooden hook post the lantern hangs on while waiting on an island. */
export function LanternPost({ position, hookY }: { position: [number, number, number]; hookY: number }) {
  const wood = toon('#8a5a3a');
  return (
    <group position={position}>
      <mesh position={[0, hookY / 2 + 0.05, -0.24]} material={wood} castShadow>
        <cylinderGeometry args={[0.045, 0.06, hookY + 0.1, 6]} />
      </mesh>
      <mesh position={[0, hookY + 0.06, -0.12]} rotation-x={Math.PI / 2} material={wood} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.26, 5]} />
      </mesh>
    </group>
  );
}
