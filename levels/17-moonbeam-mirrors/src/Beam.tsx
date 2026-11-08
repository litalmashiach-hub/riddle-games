import { useFrame } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { BEAM_Y, pointAt, type BeamPath } from './layout';

const MAX_SEGS = 24;
const UP = new THREE.Vector3(0, 1, 0);

function glow(r: number, g: number, b: number, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(r, g, b),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

/**
 * The moonbeam: a bright core, a soft glow and a wide haze, plus sparkly motes drifting along it
 * and flares where it bounces. `reveal` is how far along the path the beam has reached;
 * `power` fades the whole beam (0 to 1).
 */
export function Beam({ path, reveal, power }: { path: BeamPath; reveal: RefObject<number>; power: RefObject<number> }) {
  const high = useSettings((s) => s.quality) === 'high';
  const core = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.InstancedMesh>(null);
  const haze = useRef<THREE.InstancedMesh>(null);
  const flares = useRef<THREE.InstancedMesh>(null);
  const motes = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.Mesh>(null);

  const mats = useMemo(
    () => ({
      core: glow(3.2, 3.4, 3.8, 1),
      halo: glow(0.55, 0.85, 1.6, 0.55),
      haze: glow(0.35, 0.3, 0.9, 0.22),
      flare: glow(1.8, 1.9, 2.6, 0.75),
      mote: glow(2.4, 2.4, 3.2, 0.9),
    }),
    [],
  );
  const geos = useMemo(
    () => ({
      core: new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true),
      halo: new THREE.CylinderGeometry(0.1, 0.1, 1, 10, 1, true),
      haze: new THREE.CylinderGeometry(0.24, 0.24, 1, 12, 1, true),
      flare: new THREE.IcosahedronGeometry(0.2, 2),
      mote: new THREE.OctahedronGeometry(0.03, 0),
    }),
    [],
  );
  const moteCount = high ? 90 : 30;
  const moteSeeds = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ u: (i * 0.618) % 1, a: i * 2.4, r: 0.05 + ((i * 37) % 11) / 60, sp: 0.6 + ((i * 13) % 7) / 10 })), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), p: [0, 0] as [number, number] }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pw = Math.max(0, Math.min(1, power.current ?? 1));
    const rv = reveal.current ?? 0;
    const flick = 0.92 + Math.sin(t * 13) * 0.04 + Math.sin(t * 31) * 0.03;
    mats.core.opacity = pw;
    mats.halo.opacity = 0.55 * pw * flick;
    mats.haze.opacity = 0.22 * pw * (0.85 + Math.sin(t * 2.2) * 0.15);
    mats.flare.opacity = 0.75 * pw;
    mats.mote.opacity = 0.9 * pw;

    const layers = [core.current, halo.current, haze.current];
    let n = 0;
    for (let i = 1; i < path.pts.length && n < MAX_SEGS; i++) {
      const start = path.dist[i - 1];
      const len = path.dist[i] - start;
      const vis = Math.min(len, rv - start);
      if (vis <= 0.001) break;
      tmp.a.set(path.pts[i - 1][0], BEAM_Y, path.pts[i - 1][1]);
      tmp.b.set(path.pts[i][0], BEAM_Y, path.pts[i][1]);
      tmp.d.subVectors(tmp.b, tmp.a).normalize();
      dummy.position.copy(tmp.a).addScaledVector(tmp.d, vis / 2);
      dummy.quaternion.setFromUnitVectors(UP, tmp.d);
      dummy.scale.set(1, vis, 1);
      dummy.updateMatrix();
      for (const l of layers) l?.setMatrixAt(n, dummy.matrix);
      n++;
    }
    for (const l of layers) {
      if (!l) continue;
      l.count = n;
      l.instanceMatrix.needsUpdate = true;
    }

    // Flares at each bounce the beam has reached, and a bright spark at its tip.
    const f = flares.current;
    if (f) {
      let k = 0;
      for (let i = 1; i < path.pts.length - 1; i++) {
        if (path.dist[i] > rv) break;
        const pulse = 1 + Math.sin(t * 6 + i) * 0.18;
        const since = Math.min(1, (rv - path.dist[i]) / 0.6);
        dummy.position.set(path.pts[i][0], BEAM_Y, path.pts[i][1]);
        dummy.quaternion.identity();
        dummy.scale.setScalar(pulse * (0.6 + 0.4 * since) * (1 + (1 - since) * 1.5));
        dummy.updateMatrix();
        f.setMatrixAt(k++, dummy.matrix);
      }
      f.count = k;
      f.instanceMatrix.needsUpdate = true;
    }
    if (head.current) {
      const growing = rv < path.total - 0.01 && rv > 0.01;
      head.current.visible = growing && pw > 0.05;
      if (growing) {
        pointAt(path, rv, tmp.p);
        head.current.position.set(tmp.p[0], BEAM_Y, tmp.p[1]);
        head.current.scale.setScalar(1.3 + Math.sin(t * 40) * 0.3);
      }
    }

    // Motes drift along the visible beam.
    const m = motes.current;
    if (m) {
      const shown = Math.min(rv, path.total);
      for (let i = 0; i < moteCount; i++) {
        const s = moteSeeds[i];
        if (shown < 0.2) {
          dummy.scale.setScalar(0);
        } else {
          const d = ((s.u * path.total + t * s.sp) % path.total + path.total) % path.total;
          if (d > shown) dummy.scale.setScalar(0);
          else {
            pointAt(path, d, tmp.p);
            const a = s.a + t * 2;
            dummy.position.set(tmp.p[0] + Math.cos(a) * s.r * 0.6, BEAM_Y + Math.sin(a) * s.r, tmp.p[1] + Math.sin(a) * s.r * 0.6);
            dummy.scale.setScalar(0.6 + Math.sin(t * 9 + i) * 0.4);
          }
        }
        dummy.quaternion.identity();
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.count = moteCount;
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={core} args={[geos.core, mats.core, MAX_SEGS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={halo} args={[geos.halo, mats.halo, MAX_SEGS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={haze} args={[geos.haze, mats.haze, MAX_SEGS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={flares} args={[geos.flare, mats.flare, MAX_SEGS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={motes} args={[geos.mote, mats.mote, 90]} frustumCulled={false} renderOrder={3} />
      <mesh ref={head} geometry={geos.flare} material={mats.flare} visible={false} renderOrder={3} />
    </group>
  );
}
