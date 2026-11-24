import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Water, seeded, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Height of the banks around the pond. The water is at y = 0. */
export function bankHeight(x: number, z: number) {
  const back = smooth(-4.4, -6.2, z) * 0.9 + smooth(-8, -17, z) * 2.6;
  const sides = smooth(8.2, 11.5, Math.abs(x)) * 1.1;
  const bumps = Math.sin(x * 0.8 + z * 0.5) * 0.14 + Math.sin(x * 2.1 - z * 1.6) * 0.05;
  return -0.7 + back + sides + (back + sides > 0.3 ? bumps : 0);
}

function Banks() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(52, 34, 90, 60);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -7);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const mossA = new THREE.Color('#3c7a52');
    const mossB = new THREE.Color('#285a47');
    const sand = new THREE.Color('#bfa878');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = bankHeight(x, z);
      pos.setY(i, y);
      c.copy(mossA).lerp(mossB, 0.5 + 0.5 * Math.sin(x * 0.6 + z * 1.2));
      if (y < 0.2) c.lerp(sand, smooth(0.2, 0.0, y));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} />
    </mesh>
  );
}

/** Glowing mushrooms along the banks, in two draw calls. */
function BankMushrooms({ count }: { count: number }) {
  const stems = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const rnd = seeded(2222);
    const palette = ['#5ef2ff', '#b48cff', '#ff7ad9', '#7dffb0'];
    return Array.from({ length: count }, (_, i) => {
      const side = rnd() < 0.6;
      const x = side ? (rnd() - 0.5) * 20 : (rnd() < 0.5 ? -1 : 1) * (9.3 + rnd() * 2);
      const z = side ? -5.2 - rnd() * 3.5 : -4 + rnd() * 6;
      return { x, z, s: 0.7 + rnd() * 1.2, color: new THREE.Color(palette[i % palette.length]) };
    });
  }, [count]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    items.forEach((m, i) => {
      const y = bankHeight(m.x, m.z);
      o.position.set(m.x, y + 0.12 * m.s, m.z);
      o.scale.setScalar(m.s);
      o.updateMatrix();
      stems.current!.setMatrixAt(i, o.matrix);
      o.position.y = y + 0.26 * m.s;
      o.updateMatrix();
      caps.current!.setMatrixAt(i, o.matrix);
      caps.current!.setColorAt(i, m.color);
    });
    stems.current!.instanceMatrix.needsUpdate = true;
    caps.current!.instanceMatrix.needsUpdate = true;
    if (caps.current!.instanceColor) caps.current!.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <group>
      <instancedMesh ref={stems} args={[undefined, undefined, items.length]} material={toon('#e9e2cf')}>
        <cylinderGeometry args={[0.035, 0.05, 0.25, 6]} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, items.length]}>
        <sphereGeometry args={[0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Dark, droopy trees on the far bank: one trunk and one crown each. */
function Trees() {
  const defs = useMemo(
    () => [
      { x: -9.5, z: -7.2, s: 1.5 }, { x: -5.2, z: -9, s: 1.25 }, { x: -0.8, z: -8, s: 1.6 },
      { x: 4.3, z: -9.5, s: 1.3 }, { x: 8.8, z: -7.4, s: 1.55 }, { x: 12.5, z: -3, s: 1.3 }, { x: -12.6, z: -2.4, s: 1.35 },
    ],
    [],
  );
  const crowns = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    crowns.current.forEach((m, i) => {
      if (m) m.rotation.z = Math.sin(clock.elapsedTime * 0.6 + i * 1.7) * 0.03;
    });
  });
  return (
    <group>
      {defs.map((d, i) => (
        <group key={i} position={[d.x, bankHeight(d.x, d.z), d.z]} scale={d.s}>
          <mesh position-y={1} material={toon('#4b3a2e')} castShadow>
            <cylinderGeometry args={[0.15, 0.28, 2, 6]} />
          </mesh>
          <mesh ref={(m) => void (crowns.current[i] = m)} position-y={2.5} scale={[1.5, 1.15, 1.35]} material={toon(i % 2 ? '#2f6e5a' : '#3a7d55')} castShadow>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The twilight pond everything floats on: water, mossy banks, a low moon, trees, mushrooms and drifting fireflies. */
export function Backdrop() {
  const high = useSettings((s) => s.quality) === 'high';
  return (
    <group>
      <group position={[-10, 9.5, -32]}>
        <mesh>
          <sphereGeometry args={[2.3, 24, 18]} />
          <meshBasicMaterial color="#fff6d8" toneMapped={false} fog={false} />
        </mesh>
      </group>
      <Banks />
      <Water width={64} length={30} position={[0, 0, 0]} shallow="#1f7385" deep="#0b2a48" foam="#7fcfe0" flow={0.06} waveHeight={0.02} segments={high ? 110 : 48} />
      <Trees />
      <BankMushrooms count={high ? 30 : 16} />
      <Sparkles count={high ? 70 : 26} scale={[20, 2.4, 9]} position={[0, 1.5, -0.5]} size={5} speed={0.35} color="#fff3a0" opacity={0.9} noise={1} />
    </group>
  );
}
