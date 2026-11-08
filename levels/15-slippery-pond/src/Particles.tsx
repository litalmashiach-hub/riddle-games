import { useSettings } from '@riddle/fx';
import { useFrame } from '@react-three/fiber';
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface ParticlesHandle {
  /** Ice shavings kicked up behind a sliding otter. */
  spray(x: number, z: number, dx: number, dz: number): void;
  /** A soft cloud of snow (drifts and snowbanks). */
  poof(x: number, z: number, n?: number): void;
  /** A big crown of water drops. */
  splash(x: number, z: number): void;
  /** A thin fountain the otter spits out. */
  spit(x: number, y: number, z: number): void;
}

interface P {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  grav: number;
  drag: number;
}

/** One pooled instanced mesh for every little particle in the level (one draw call). */
export const Particles = forwardRef<ParticlesHandle>(function Particles(_, ref) {
  const low = useSettings((s) => s.quality) === 'low';
  const N = low ? 160 : 420;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo<P[]>(
    () => Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, size: 1, grav: 0, drag: 0 })),
    [N],
  );
  const next = useRef(0);
  const o = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  const emit = (x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: string, grav = 9, drag = 1.5) => {
    const i = next.current;
    next.current = (i + 1) % N;
    const q = pool[i];
    q.p.set(x, y, z);
    q.v.set(vx, vy, vz);
    q.life = life;
    q.max = life;
    q.size = size;
    q.grav = grav;
    q.drag = drag;
    const m = mesh.current;
    if (m) {
      m.setColorAt(i, col.set(color));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };
  // Give every instance a colour up front, so the shader is built with instance colours.
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < N; i++) m.setColorAt(i, col.set('#ffffff'));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [N, col]);
  const scale = low ? 0.45 : 1;
  const R = Math.random;

  useImperativeHandle(ref, () => ({
    spray(x, z, dx, dz) {
      for (let k = 0; k < 2; k++) {
        const s = 0.6 + R();
        emit(x - dx * 0.25 + (R() - 0.5) * 0.25, 0.04, z - dz * 0.25 + (R() - 0.5) * 0.25, -dx * s + (R() - 0.5) * 1.2, 0.8 + R() * 1.4, -dz * s + (R() - 0.5) * 1.2, 0.45 + R() * 0.3, 0.6 + R() * 0.6, R() > 0.5 ? '#ffffff' : '#bfeaff');
      }
    },
    poof(x, z, n = 26) {
      for (let k = 0; k < n * scale; k++) {
        const a = R() * Math.PI * 2;
        const s = 0.8 + R() * 2.2;
        emit(x + Math.cos(a) * 0.2, 0.1 + R() * 0.2, z + Math.sin(a) * 0.2, Math.cos(a) * s, 1 + R() * 2.5, Math.sin(a) * s, 0.7 + R() * 0.5, 1.2 + R() * 1.4, R() > 0.3 ? '#ffffff' : '#dfe9ff', 5, 3);
      }
    },
    splash(x, z) {
      for (let k = 0; k < 90 * scale; k++) {
        const a = R() * Math.PI * 2;
        const s = 0.6 + R() * 2.4;
        const up = 3 + R() * 4.5;
        emit(x + Math.cos(a) * 0.25, -0.1, z + Math.sin(a) * 0.25, Math.cos(a) * s, up, Math.sin(a) * s, 1 + R() * 0.6, 0.9 + R() * 1.4, R() > 0.4 ? '#9fe7ff' : '#ffffff', 9.5, 0.6);
      }
    },
    spit(x, y, z) {
      for (let k = 0; k < 10 * scale + 4; k++) {
        emit(x + (R() - 0.5) * 0.05, y, z, (R() - 0.5) * 0.5, 2.6 + R() * 1.4, 0.4 + (R() - 0.5) * 0.4, 0.8, 0.7 + R() * 0.4, '#bff1ff', 8, 0.4);
      }
    },
  }));

  useFrame((_, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    pool.forEach((q, i) => {
      if (q.life > 0) {
        q.life -= dt;
        q.v.y -= q.grav * dt;
        q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt));
        q.p.addScaledVector(q.v, dt);
        if (q.p.y < -0.15 && q.v.y < 0) q.life = Math.min(q.life, 0.05);
      }
      const k = q.life > 0 ? Math.min(1, (q.life / q.max) * 2.2) : 0;
      o.position.copy(q.p);
      o.scale.setScalar(0.05 * q.size * k);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, N]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.3} emissive="#cfefff" emissiveIntensity={0.6} flatShading />
    </instancedMesh>
  );
});
