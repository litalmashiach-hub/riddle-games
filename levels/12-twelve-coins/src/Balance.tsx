import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { gearGeometry } from './art';

/** Where the great balance stands, and its proportions. */
export const SCALE_POS: [number, number, number] = [0, 0, -0.7];
export const PIVOT_Y = 3.15;
export const ARM = 1.9;
export const HANG = 1.5;
/** Height of a resting coin's centre relative to the pan origin. */
const PAN_FLOOR = -0.015;
export const PAN_R = 0.82;

/** Shared, mutable beam physics. The scene sets `target`; the balance springs towards it. */
export interface Beam {
  angle: number;
  vel: number;
  target: number;
  locked: boolean;
}

/** World position of a pan's floor centre for a beam angle (positive angle = left pan down). */
export function panCentre(side: 'L' | 'R', angle: number, out = new THREE.Vector3()) {
  const s = side === 'L' ? -1 : 1;
  const x = SCALE_POS[0] + s * ARM * Math.cos(angle);
  const y = SCALE_POS[1] + PIVOT_Y + s * ARM * Math.sin(angle) - HANG + PAN_FLOOR;
  return out.set(x, y, SCALE_POS[2]);
}

const brass = () => toon('#d9a441', { metal: 0.85, rough: 0.32, flat: false });
const brassDark = () => toon('#9c6b22', { metal: 0.8, rough: 0.4, flat: false });

export function Balance({ beam, used, high }: { beam: MutableRefObject<Beam>; used: number; high: boolean }) {
  const beamRef = useRef<THREE.Group>(null);
  const panL = useRef<THREE.Group>(null);
  const panR = useRef<THREE.Group>(null);
  const crown = useRef<THREE.Mesh>(null);
  const clampA = useRef<THREE.Group>(null);
  const clampB = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const b = beam.current;
    const k = b.locked ? 90 : 26;
    const c = b.locked ? 16 : 2.6;
    const target = b.locked ? 0 : b.target;
    b.vel += (k * (target - b.angle) - c * b.vel) * dt;
    b.angle += b.vel * dt;
    if (beamRef.current) beamRef.current.rotation.z = b.angle;
    // Pans hang straight down, with a little sway from the beam's speed.
    for (const [ref, side] of [[panL, 'L'], [panR, 'R']] as const) {
      const g = ref.current;
      if (!g) continue;
      panCentre(side, b.angle, tmp);
      g.position.set(tmp.x - SCALE_POS[0], tmp.y - SCALE_POS[1] - PAN_FLOOR, 0);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, -b.vel * 0.05, 0.2);
    }
    if (crown.current) crown.current.rotation.z = -b.angle * 4;
    // The clamp jaws close around the beam when locked.
    const open = b.locked ? 0 : 0.16;
    for (const [ref, s] of [[clampA, 1], [clampB, -1]] as const) {
      const g = ref.current;
      if (g) g.position.y = THREE.MathUtils.lerp(g.position.y, PIVOT_Y + s * (0.15 + open), 0.15);
    }
  });

  const gear = useMemo(() => gearGeometry(0.62, 14, 0.08, 0.2), []);

  return (
    <group position={SCALE_POS}>
      {/* Plinth */}
      <mesh position-y={0.18} material={toon('#3c3140', { rough: 0.9 })} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.2, 0.36, 8]} />
      </mesh>
      <mesh position-y={0.42} material={brassDark()} castShadow receiveShadow>
        <cylinderGeometry args={[0.82, 0.95, 0.14, 8]} />
      </mesh>
      <mesh position-y={0.52} material={brass()} castShadow>
        <cylinderGeometry args={[0.32, 0.5, 0.12, 12]} />
      </mesh>
      <WeighLamps used={used} />

      {/* Column with rings */}
      <mesh position-y={1.85} material={brass()} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 2.6, 12]} />
      </mesh>
      {[0.85, 1.6, 2.4].map((y) => (
        <mesh key={y} position-y={y} rotation-x={Math.PI / 2} material={brassDark()} castShadow>
          <torusGeometry args={[0.17, 0.045, 8, 20]} />
        </mesh>
      ))}

      {/* Dial behind the pivot, with a turning crown gear */}
      <mesh ref={crown} geometry={gear} position={[0, PIVOT_Y, -0.2]} material={brassDark()} castShadow />
      <mesh position={[0, PIVOT_Y, -0.13]} material={toon('#f3e6c4', { rough: 0.6, flat: false })}>
        <circleGeometry args={[0.5, 32, 0, Math.PI]} />
      </mesh>
      <DialTicks />

      {/* Clamp jaws (the brake) */}
      <group ref={clampA} position={[0, PIVOT_Y + 0.15, 0]}>
        <mesh position-x={-0.32} material={brassDark()} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.26]} />
        </mesh>
        <mesh position-x={0.32} material={brassDark()} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.26]} />
        </mesh>
      </group>
      <group ref={clampB} position={[0, PIVOT_Y - 0.15, 0]}>
        <mesh position-x={-0.32} material={brassDark()} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.26]} />
        </mesh>
        <mesh position-x={0.32} material={brassDark()} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.26]} />
        </mesh>
      </group>

      {/* The beam */}
      <group ref={beamRef} position-y={PIVOT_Y}>
        <mesh material={brass()} castShadow>
          <boxGeometry args={[ARM * 2, 0.11, 0.13]} />
        </mesh>
        <mesh position-y={0.1} material={brassDark()} castShadow>
          <boxGeometry args={[ARM * 1.3, 0.05, 0.09]} />
        </mesh>
        {/* pointer needle */}
        <mesh position={[0, 0.36, 0.02]} material={toon('#7a1d2a', { rough: 0.5 })} castShadow>
          <coneGeometry args={[0.04, 0.6, 6]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} material={brass()} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.3, 16]} />
        </mesh>
        <mesh position-z={0.17} material={toon('#ffcf6b', { emissive: '#ffb02e', emissiveIntensity: 2.5, flat: false })}>
          <sphereGeometry args={[0.07, 12, 12]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position-x={s * ARM}>
            <mesh rotation-z={-s * Math.PI / 2} position-x={s * 0.1} material={brass()} castShadow>
              <coneGeometry args={[0.1, 0.24, 8]} />
            </mesh>
            <mesh position-y={-0.1} material={brassDark()} castShadow>
              <torusGeometry args={[0.07, 0.022, 6, 14]} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={panL} position={[-ARM, PIVOT_Y - HANG, 0]}>
        <Pan high={high} />
      </group>
      <group ref={panR} position={[ARM, PIVOT_Y - HANG, 0]}>
        <Pan high={high} />
      </group>
    </group>
  );
}

/** A shallow brass dish on three chains. Its origin is the dish floor centre. */
function Pan({ high }: { high: boolean }) {
  const bowl = useMemo(
    () =>
      new THREE.LatheGeometry(
        [new THREE.Vector2(0, -0.05), new THREE.Vector2(0.74, -0.05), new THREE.Vector2(0.8, 0.0), new THREE.Vector2(PAN_R, 0.1)],
        28,
      ),
    [],
  );
  const links = useRef<THREE.InstancedMesh>(null);
  const perChain = high ? 11 : 7;
  useLayoutEffect(() => {
    const m = links.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let i = 0;
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2 + Math.PI / 2;
      const bottom = new THREE.Vector3(Math.cos(a) * PAN_R * 0.95, 0.1, Math.sin(a) * PAN_R * 0.95);
      const top = new THREE.Vector3(0, HANG - 0.12, 0);
      for (let k = 0; k < perChain; k++) {
        const t = (k + 0.5) / perChain;
        o.position.lerpVectors(bottom, top, t);
        o.lookAt(top);
        o.rotateY(k % 2 ? Math.PI / 2 : 0);
        o.updateMatrix();
        m.setMatrixAt(i++, o.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }, [perChain]);
  return (
    <group>
      <mesh geometry={bowl} castShadow receiveShadow>
        <meshStandardMaterial color="#e0ae4c" metalness={0.85} roughness={0.28} side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={0.1} rotation-x={Math.PI / 2} material={brassDark()} castShadow>
        <torusGeometry args={[PAN_R, 0.035, 8, 36]} />
      </mesh>
      <instancedMesh ref={links} args={[undefined, undefined, perChain * 3]} material={brassDark()} castShadow>
        <torusGeometry args={[0.055, 0.016, 5, 10]} />
      </instancedMesh>
      <mesh position-y={HANG - 0.1} material={brassDark()}>
        <sphereGeometry args={[0.05, 8, 8]} />
      </mesh>
    </group>
  );
}

function DialTicks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = 13;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / (n - 1));
      o.position.set(Math.cos(a) * 0.42, PIVOT_Y + Math.sin(a) * 0.42, -0.12);
      o.rotation.set(0, 0, a - Math.PI / 2);
      o.scale.set(1, i === (n - 1) / 2 ? 2 : 1, 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} material={toon('#5a3a14')}>
      <boxGeometry args={[0.02, 0.07, 0.01]} />
    </instancedMesh>
  );
}

/** Three lamps on the plinth: one goes dark for each weighing used. */
function WeighLamps({ used }: { used: number }) {
  const lit = toon('#ffd27a', { emissive: '#ffae2b', emissiveIntensity: 3.2, flat: false });
  const dark = toon('#3a2c22', { rough: 0.5, flat: false });
  return (
    <group position={[0, 0.3, 1.08]}>
      {[-0.32, 0, 0.32].map((x, i) => (
        <group key={x} position-x={x}>
          <mesh rotation-x={Math.PI / 2} material={brassDark()}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
          </mesh>
          <mesh position-z={0.04} material={i < 3 - used ? lit : dark}>
            <sphereGeometry args={[0.075, 14, 14]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
