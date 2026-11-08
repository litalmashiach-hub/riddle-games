import { useFrame } from '@react-three/fiber';
import { Burst, ComicWord, FightCloud, sfx, useSettings, type Vec3 } from '@riddle/fx';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Steam } from './Canal';
import { sign, slot, thiefGetaway, thiefSpot } from './layout';
import type { trouble } from './rules';

type Problem = NonNullable<ReturnType<typeof trouble>>;

export type FailPhase = 'windup' | 'gag' | 'after';
/** The beats of every fail scene: a setup, the slapstick, then the aftermath. */
export const FAIL_PHASES: [FailPhase, number][] = [
  ['windup', 1000],
  ['gag', 1700],
  ['after', 60000],
];
/** How long the shell waits after the move before the "Oh no!" screen. */
export const FAIL_MS = 1000 + 1700 + 1700;

/** Where the action happens in a fail scene (for the camera and the effects). */
export function gagSpot(problem: Problem, lift = 0): Vec3 {
  const side = problem.side;
  if (problem.kind === 'thief') {
    const { end } = thiefSpot(problem.who[1], side);
    const g = thiefGetaway(side);
    return [(end[0] + g[0]) / 2, end[1] + lift, (end[2] + g[2]) / 2];
  }
  if (problem.kind === 'dad') {
    const d = slot('father', side);
    const g = slot(problem.who[1], side);
    return [(d[0] + g[0]) / 2, d[1] + lift, (d[2] + g[2]) / 2];
  }
  const m = slot('mother', side);
  return [sign(side) * 3.55, m[1] + lift, -0.05];
}

/** Eye height of the kids and Mom's head height, for the effects. */
const KID_EYES = 0.71;
const MOM_HEAD = 0.92;

const o = new THREE.Object3D();

/** Seconds since this component mounted, so effects can ramp in. */
function useAge() {
  const born = useRef<number | null>(null);
  return (clock: THREE.Clock) => {
    if (born.current == null) born.current = clock.elapsedTime;
    return clock.elapsedTime - born.current;
  };
}

// ---------------------------------------------------------------------------
// Dad's terrible jokes: cartoon tear fountains and a growing puddle

function TearFountain({ position, yaw, seed }: { position: Vec3; yaw: number; seed: number }) {
  const drops = useRef<THREE.InstancedMesh>(null);
  const puddle = useRef<THREE.Mesh>(null);
  const age = useAge();
  const N = 28;
  useFrame(({ clock }) => {
    const a = age(clock);
    const m = drops.current;
    if (m) {
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        const life = (a * 1.6 + i / N + seed * 0.37) % 1;
        const on = a > 0.15 ? 1 : 0;
        const out = 0.85 * life;
        const up = 0.55 * life - 1.15 * life * life;
        o.position.set(side * (0.07 + out), up, 0.14 + Math.sin(i * 7.1) * 0.05 * life);
        o.scale.setScalar(on * 0.045 * (1 - life * 0.5));
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    if (puddle.current) {
      const r = Math.min(1, a / 2.5) * 0.5 + Math.sin(a * 6) * 0.02;
      puddle.current.scale.set(r, r, r);
    }
  });
  return (
    <group position={position} rotation-y={yaw}>
      <group position-y={KID_EYES}>
        <instancedMesh ref={drops} args={[undefined, undefined, N]} frustumCulled={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#8fdcff" emissive="#4fb8ff" emissiveIntensity={1.4} roughness={0.15} toneMapped={false} />
        </instancedMesh>
      </group>
      <mesh ref={puddle} position-y={0.03} rotation-x={-Math.PI / 2} scale={0.001}>
        <circleGeometry args={[1, 24]} />
        <meshStandardMaterial color="#6cc6f0" emissive="#2d8fd0" emissiveIntensity={0.5} transparent opacity={0.75} roughness={0.05} metalness={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A drum-roll "ba-dum-tss" made of a cymbal flashing next to Dad. */
function Rimshot({ position }: { position: Vec3 }) {
  const cym = useRef<THREE.Group>(null);
  const age = useAge();
  useFrame(({ clock }) => {
    const a = age(clock);
    const g = cym.current;
    if (!g) return;
    const hit = Math.max(0, 1 - ((a % 1.4) / 0.25));
    g.rotation.z = Math.sin(a * 40) * 0.25 * hit;
    g.scale.setScalar(Math.min(1, a * 4));
  });
  return (
    <group ref={cym} position={[position[0], position[1] + 1.15, position[2] + 0.35]}>
      <mesh rotation-x={0.4}>
        <cylinderGeometry args={[0.22, 0.24, 0.025, 18]} />
        <meshStandardMaterial color="#ffd166" metalness={0.9} roughness={0.25} emissive="#a06a00" emissiveIntensity={0.6} />
      </mesh>
      <mesh position-y={-0.25}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 5]} />
        <meshStandardMaterial color="#3a3640" metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Mom and the wild boys: a cartoon fight cloud and steam from Mom's ears

function EarSteam({ position, yaw, high }: { position: Vec3; yaw: number; high: boolean }) {
  return (
    <group position={position} rotation-y={yaw}>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.17, MOM_HEAD, -0.02]} rotation-z={-s * 0.6}>
          <Steam position={[0, 0, 0]} count={high ? 10 : 6} rate={3.2} spread={0.03} size={0.13} rise={0.8} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// The thief: coins and trinkets arc out of the family's pockets into his sack

function LootStream({ from, to, high }: { from: Vec3[]; to: Vec3; high: boolean }) {
  const coins = useRef<THREE.InstancedMesh>(null);
  const age = useAge();
  const per = high ? 5 : 3;
  const N = from.length * per;
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const t = setInterval(() => sfx.click(), 280);
    return () => clearInterval(t);
  }, []);
  useFrame(({ clock }) => {
    const a = age(clock);
    const m = coins.current;
    if (!m) return;
    for (let i = 0; i < N; i++) {
      const src = from[Math.floor(i / per)];
      const life = (a * 1.1 + (i % per) / per + Math.floor(i / per) * 0.13) % 1;
      const on = a > 0.35 ? 1 : 0;
      v.set(src[0], src[1] + 0.55, src[2]).lerp(new THREE.Vector3(to[0], to[1], to[2]), life);
      v.y += Math.sin(Math.PI * life) * 0.9;
      o.position.copy(v);
      o.rotation.set(a * 9 + i, a * 4, i);
      o.scale.setScalar(on * (0.06 + 0.02 * Math.sin(Math.PI * life)));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={coins} args={[undefined, undefined, N]} frustumCulled={false} castShadow>
      <cylinderGeometry args={[1, 1, 0.25, 12]} />
      <meshStandardMaterial color="#ffcf3f" metalness={0.9} roughness={0.25} emissive="#b07800" emissiveIntensity={0.9} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------

/**
 * The effects of a fail scene, beat by beat. The characters do their own moves (see Scene);
 * this adds clouds, comic words, tears, coins and steam around them.
 */
export function Mishap({ problem, phase }: { problem: Problem; phase: FailPhase }) {
  const high = useSettings((s) => s.quality) === 'high';
  const side = problem.side;
  const spot = gagSpot(problem);
  const [pop, setPop] = useState(0);
  useEffect(() => {
    if (phase === 'gag' || (phase === 'after' && problem.kind === 'mom')) setPop((n) => n + 1);
  }, [phase, problem.kind]);
  const word = (text: string, color?: string, y = 2.2, tilt?: number, size?: number) => (
    <ComicWord position={[spot[0], spot[1] + y, spot[2]]} text={text} color={color} tilt={tilt} size={size} />
  );

  if (problem.kind === 'dad') {
    const daughters = problem.who.slice(1);
    return (
      <group>
        {phase !== 'windup' && <Rimshot position={slot('father', side)} />}
        {phase === 'gag' && word('BA-DUM-TSS!', '#ffd23f', 2.3, -6, 40)}
        {phase === 'after' &&
          daughters.map((d, i) => <TearFountain key={d} position={slot(d, side)} yaw={0} seed={i} />)}
        {phase === 'after' && word('WAAAH!', '#8fdcff', 2.7, 7, 44)}
        <Burst trigger={pop} position={[spot[0], spot[1] + 1.4, spot[2]]} count={high ? 60 : 30} colors={['#ffd23f', '#ffffff', '#ff8fab']} power={0.5} size={0.7} />
      </group>
    );
  }
  if (problem.kind === 'mom') {
    const boys = problem.who.slice(1);
    return (
      <group>
        <FightCloud position={spot} active={phase === 'gag'} scale={0.95} limbColors={[...boys.map((b): string => (b === 'sonA' ? '#3d7cc9' : '#2a9d8f')), '#7a5230', '#f1c19a']} />
        {phase === 'gag' && word('RUMBLE!', '#ffd23f', 1.9, -8)}
        {phase === 'after' && <EarSteam position={slot('mother', side)} yaw={0} high={high} />}
        {phase === 'after' && word('Uh-oh…', '#ff8fab', 2.3, 6, 36)}
        <Burst trigger={pop} position={[spot[0], spot[1] + 0.6, spot[2]]} count={high ? 50 : 25} colors={['#f1e3c8', '#d9c7a5', '#ffd23f']} power={0.45} size={0.9} />
      </group>
    );
  }
  const victims = problem.who.slice(1);
  const { end } = thiefSpot(victims[0], side);
  return (
    <group>
      {phase === 'gag' && <LootStream from={victims.slice(0, 4).map((v) => slot(v, side))} to={[end[0], end[1] + 0.75, end[2] - 0.2]} high={high} />}
      {phase === 'gag' && word('YOINK!', '#ffd23f', 2.2, -8)}
      {phase === 'after' && <ComicWord position={[thiefGetaway(side)[0], 2.6, thiefGetaway(side)[2]]} text="Oops!" color="#ff8fab" tilt={6} size={38} />}
      <Burst trigger={pop} position={[spot[0], spot[1] + 1.2, spot[2]]} count={high ? 70 : 35} colors={['#ffcf3f', '#ffe9a0', '#ffffff']} power={0.55} size={0.8} />
    </group>
  );
}
