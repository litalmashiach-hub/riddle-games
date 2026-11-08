import { useFrame } from '@react-three/fiber';
import { ComicWord, DizzyStars, useSettings } from '@riddle/fx';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

/** A chunky five-point star, lying in the xy plane. */
function starGeometry(size: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: size * 0.25,
    bevelEnabled: true,
    bevelThickness: size * 0.08,
    bevelSize: size * 0.08,
    bevelSegments: 1,
  });
  g.center();
  return g;
}

const WORDS = ['BONK!', 'BOING!', 'SQUISH!', 'OOF!'];

/**
 * The funny "that cog is too big" moment at `position`, starting `at` (performance.now ms):
 * a ring of cartoon steam puffs and gold stars flying out, plus the shared comic word and dizzy stars.
 */
export function BonkFx({ at, position, radius }: { at: number; position: [number, number, number]; radius: number }) {
  const high = useSettings((s) => s.quality) === 'high';
  const PUFFS = high ? 14 : 8;
  const SPARKS = high ? 8 : 5;
  const puffs = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const star = useMemo(() => starGeometry(0.11), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const dirs = useMemo(
    () =>
      Array.from({ length: Math.max(PUFFS, SPARKS) }, (_, i) => ({
        a: (i / PUFFS) * Math.PI * 2 + (i % 2) * 0.2,
        b: (i / SPARKS) * Math.PI * 2 + 0.4,
        up: 2.4 + ((i * 37) % 10) / 6,
        spin: 4 + (i % 3) * 3,
      })),
    [PUFFS, SPARKS],
  );
  const [word, setWord] = useState<string | null>(null);
  const [dizzy, setDizzy] = useState(false);

  // The comic word pops and the squashed cog sees stars, starting at the impact.
  useEffect(() => {
    if (!at) return;
    const wait = Math.max(0, at - performance.now());
    const timers = [
      setTimeout(() => {
        setWord(WORDS[Math.floor(at / 7) % WORDS.length]);
        setDizzy(true);
      }, wait),
      setTimeout(() => setWord(null), wait + 1000),
      setTimeout(() => setDizzy(false), wait + 1700),
    ];
    return () => timers.forEach(clearTimeout);
  }, [at]);

  useFrame(() => {
    const raw = at ? (performance.now() - at) / 1000 : 99;
    const t = raw < 0 ? 99 : raw;
    const pm = puffs.current;
    if (pm) {
      for (let i = 0; i < PUFFS; i++) {
        const k = Math.min(t / 0.75, 1);
        const d = dirs[i];
        const r = radius * 0.7 + Math.sqrt(k) * (radius * 0.9 + 0.4);
        o.position.set(Math.cos(d.a) * r, 0.05 + k * 0.45, Math.sin(d.a) * r);
        o.rotation.set(d.spin * k, d.a, 0);
        o.scale.setScalar(t < 0.75 ? (0.18 + k * 0.32) * Math.sin(Math.PI * Math.min(1, k * 1.15 + 0.05)) : 0.0001);
        o.updateMatrix();
        pm.setMatrixAt(i, o.matrix);
      }
      pm.instanceMatrix.needsUpdate = true;
    }
    const sm = sparks.current;
    if (sm) {
      for (let i = 0; i < SPARKS; i++) {
        const d = dirs[i];
        const h = Math.min(t, 0.9);
        const r = radius * 0.5 + h * 2.2;
        o.position.set(Math.cos(d.b) * r, 0.2 + d.up * h - 4.5 * h * h, Math.sin(d.b) * r);
        o.rotation.set(0, d.spin * h * 3, d.spin * h);
        o.scale.setScalar(t < 0.9 ? 1 - (t / 0.9) ** 3 : 0.0001);
        o.updateMatrix();
        sm.setMatrixAt(i, o.matrix);
      }
      sm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      <instancedMesh ref={puffs} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#fff6ec" roughness={1} flatShading emissive="#ffe2c4" emissiveIntensity={0.25} />
      </instancedMesh>
      <instancedMesh ref={sparks} args={[star, undefined, SPARKS]} frustumCulled={false}>
        <meshStandardMaterial color="#ffd54a" emissive="#ffb300" emissiveIntensity={2.6} roughness={0.4} metalness={0.3} />
      </instancedMesh>
      {word && <ComicWord key={at} position={[0.3, 0.9, 0]} text={word} color="#ff4d6d" ink="#3b0d18" size={38} tilt={-10} />}
      <DizzyStars position={[0, 0.4, 0]} radius={0.42} count={4} visible={dizzy} />
    </group>
  );
}
