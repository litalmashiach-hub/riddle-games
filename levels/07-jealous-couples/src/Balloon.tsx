import { useFrame } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

/** Height of the basket floor above the balloon's origin. Riders stand here. */
export const BASKET_FLOOR = 0.08;
const BASKET_TOP = 0.42;
const NECK_Y = 1.2;

const STRIPES = ['#ff6b6b', '#fff3dc', '#ffc93c', '#fff3dc', '#4ecdc4', '#fff3dc'];

/** Faceted, striped envelope as one mesh (vertex colors per gore). */
function useEnvelope() {
  return useMemo(() => {
    const profile = [
      [0.2, 0], [0.42, 0.3], [0.8, 0.8], [1.08, 1.35], [1.16, 1.85], [1.06, 2.3], [0.8, 2.66], [0.42, 2.88], [0.0, 2.95],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const gores = 18;
    const g = new THREE.LatheGeometry(profile, gores).toNonIndexed();
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let tri = 0; tri < pos.count / 3; tri++) {
      // Color a whole triangle by the gore its center falls in.
      let ax = 0, az = 0;
      for (let k = 0; k < 3; k++) {
        ax += pos.getX(tri * 3 + k);
        az += pos.getZ(tri * 3 + k);
      }
      const ang = (Math.atan2(ax, az) + Math.PI * 2) % (Math.PI * 2);
      const gore = Math.floor((ang / (Math.PI * 2)) * gores) % gores;
      col.set(STRIPES[gore % STRIPES.length]);
      for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], (tri * 3 + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
}

/**
 * A hot-air balloon with a wicker basket. Origin is the bottom of the basket.
 * `burning` makes the burner roar (bigger flame, more light). Children ride in the basket.
 */
export function Balloon({ burning = false, children }: { burning?: boolean; children?: ReactNode }) {
  const envelope = useEnvelope();
  const sway = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const flag = useRef<THREE.Group>(null);
  const high = useSettings((s) => s.quality) === 'high';

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (sway.current) {
      sway.current.rotation.z = Math.sin(t * 0.9) * 0.025;
      sway.current.rotation.x = Math.sin(t * 0.7 + 1) * 0.02;
    }
    const f = flame.current;
    if (f) {
      const base = burning ? 1.6 : 0.6;
      const flick = 1 + Math.sin(t * 31) * 0.12 + Math.sin(t * 17) * 0.1;
      f.scale.set(base * (0.9 + Math.sin(t * 23) * 0.08), base * flick, base * (0.9 + Math.cos(t * 19) * 0.08));
    }
    if (light.current) light.current.intensity = (burning ? 6 : 1.5) * (1 + Math.sin(t * 27) * 0.15);
    if (flag.current) flag.current.rotation.y = Math.sin(t * 3) * 0.35;
  });

  const wicker = toon('#c48a4a', { rough: 1 });
  const wickerDark = toon('#8a5a2c', { rough: 1 });
  const rope = toon('#e8d9b5');
  const metal = toon('#6b6f7a', { metal: 0.6, rough: 0.4 });

  const ropes = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const from = new THREE.Vector3(Math.sin(a) * 0.46, BASKET_TOP, Math.cos(a) * 0.46);
        const to = new THREE.Vector3(Math.sin(a) * 0.2, NECK_Y + 0.05, Math.cos(a) * 0.2);
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const dir = to.clone().sub(from);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        return { mid, len: dir.length(), q };
      }),
    [],
  );

  return (
    <group ref={sway}>
      {/* basket */}
      <mesh position-y={BASKET_TOP / 2} material={wicker} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.42, BASKET_TOP, 12, 1, true]} />
      </mesh>
      <mesh position-y={BASKET_TOP / 2}>
        <cylinderGeometry args={[0.47, 0.4, BASKET_TOP - 0.02, 12, 1, true]} />
        <meshStandardMaterial color="#7a4e25" side={THREE.BackSide} flatShading roughness={1} />
      </mesh>
      <mesh position-y={0.02} material={wickerDark} receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.04, 12]} />
      </mesh>
      {[BASKET_TOP, 0.16].map((y, i) => (
        <mesh key={y} position-y={y} rotation-x={Math.PI / 2} material={i === 0 ? wickerDark : wicker} castShadow>
          <torusGeometry args={[i === 0 ? 0.5 : 0.465, 0.04, 6, 24]} />
        </mesh>
      ))}
      {/* sandbags */}
      {[0.6, 2.2, 3.9].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.52, 0.22, Math.cos(a) * 0.52]} scale={[1, 1.25, 1]} material={toon('#d9c08a')} castShadow>
          <icosahedronGeometry args={[0.075, 0]} />
        </mesh>
      ))}
      {/* ropes */}
      {ropes.map((r, i) => (
        <mesh key={i} position={r.mid} quaternion={r.q} material={rope}>
          <cylinderGeometry args={[0.012, 0.012, r.len, 4]} />
        </mesh>
      ))}
      {/* burner and flame */}
      <mesh position-y={NECK_Y - 0.12} material={metal} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 0.14, 8]} />
      </mesh>
      <mesh ref={flame} position-y={NECK_Y + 0.05}>
        <coneGeometry args={[0.07, 0.3, 7]} />
        <meshBasicMaterial color={new THREE.Color('#ffb347').multiplyScalar(3)} toneMapped={false} />
      </mesh>
      {high && <pointLight ref={light} position-y={NECK_Y + 0.2} color="#ffa64d" distance={4} decay={2} />}
      {/* envelope */}
      <group position-y={NECK_Y}>
        <mesh geometry={envelope} castShadow>
          <meshStandardMaterial vertexColors flatShading roughness={0.65} side={THREE.DoubleSide} emissive="#ff9a4d" emissiveIntensity={burning ? 0.12 : 0.04} />
        </mesh>
        <mesh position-y={0.02} rotation-x={Math.PI / 2} material={toon('#a8552f')}>
          <torusGeometry args={[0.2, 0.035, 6, 16]} />
        </mesh>
        {/* top flag */}
        <mesh position-y={3.1} material={toon('#8a5a2c')}>
          <cylinderGeometry args={[0.012, 0.012, 0.35, 4]} />
        </mesh>
        <group ref={flag} position-y={3.22}>
          <mesh position-z={-0.11} material={toon('#ff6b6b')}>
            <boxGeometry args={[0.02, 0.12, 0.22]} />
          </mesh>
        </group>
      </group>
      {children}
    </group>
  );
}
