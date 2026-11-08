import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

/*
 * Cartoon "fail scene" kit. Kid-friendly slapstick, never scary:
 * a fight cloud with limbs and stars poking out, comic words, dizzy stars,
 * a screen shake and a dramatic camera zoom. Mix them in a level's lose moment.
 */

type V3 = [number, number, number];

let starGeo: THREE.ExtrudeGeometry | null = null;
/** A chunky 5-point star, shared. */
export function starGeometry() {
  if (starGeo) return starGeo;
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.45;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  starGeo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
  starGeo.center();
  return starGeo;
}

const starMat = () => new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb800', emissiveIntensity: 1.6, roughness: 0.4, flatShading: true });

/**
 * The classic cartoon scuffle: a boiling ball of dust with stars, and arms/legs/tails popping out.
 * Put it where two characters collide and hide the characters while `active`.
 */
export function FightCloud({
  position,
  active,
  scale = 1,
  color = '#f7f4ee',
  limbColors = ['#6f7480', '#3b2f2b', '#f6f1e6'],
}: {
  position: V3;
  active: boolean;
  scale?: number;
  color?: string;
  /** Colors of the arms, legs and tails that poke out (use the fighters' colors). */
  limbColors?: string[];
}) {
  const root = useRef<THREE.Group>(null);
  const puffs = useRef<THREE.Group>(null);
  const extras = useRef<THREE.Group>(null);
  const grow = useRef(0);
  const puffMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, emissive: color, emissiveIntensity: 0.15 }), [color]);
  const shadeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfc8ba', roughness: 1, flatShading: true }), []);
  const limbMats = useMemo(() => limbColors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })), [limbColors]);
  const sMat = useMemo(starMat, []);
  const layout = useMemo(
    () =>
      Array.from({ length: 13 }, (_, i) => {
        const a = (i / 13) * Math.PI * 2;
        const ring = i % 3 === 0 ? 0.25 : 0.55;
        return { x: Math.cos(a) * ring, y: 0.45 + Math.sin(i * 1.7) * 0.3, z: Math.sin(a) * ring, r: 0.32 + (i % 4) * 0.07, ph: i * 1.3 };
      }),
    [],
  );

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    grow.current = THREE.MathUtils.damp(grow.current, active ? 1 : 0, active ? 14 : 8, dt);
    const s = grow.current * scale;
    g.visible = s > 0.01;
    g.scale.setScalar(s);
    const t = clock.elapsedTime;
    g.rotation.y = t * 3;
    g.position.set(position[0] + Math.sin(t * 23) * 0.08, position[1] + Math.abs(Math.sin(t * 17)) * 0.1, position[2] + Math.cos(t * 19) * 0.08);
    puffs.current?.children.forEach((c, i) => {
      const l = layout[i];
      const k = 1 + Math.sin(t * 18 + l.ph) * 0.18;
      c.position.set(l.x * (1 + Math.sin(t * 9 + l.ph) * 0.15), l.y + Math.sin(t * 13 + l.ph) * 0.08, l.z);
      c.scale.setScalar(l.r * k);
    });
    // Limbs and stars pop in and out on their own rhythm.
    extras.current?.children.forEach((c, i) => {
      const on = Math.sin(t * (7 + i) + i * 2.1) > 0.15;
      const base = (c.userData.base ??= c.scale.x) as number;
      c.scale.setScalar(THREE.MathUtils.damp(c.scale.x, on ? base : base * 0.001, 20, dt));
      c.rotation.z = Math.sin(t * 20 + i) * 0.5;
    });
  });

  return (
    <group ref={root} visible={false}>
      <group ref={puffs}>
        {layout.map((_, i) => (
          <mesh key={i} material={i % 4 === 3 ? shadeMat : puffMat} castShadow>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        ))}
      </group>
      <group ref={extras}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2 + 0.4;
          return (
            <group key={`l${i}`} position={[Math.cos(a) * 0.75, 0.35 + (i % 3) * 0.2, Math.sin(a) * 0.75]} rotation={[0, -a, Math.PI / 2]}>
              <mesh position-y={0.18} material={limbMats[i % limbMats.length]}>
                <capsuleGeometry args={[0.07, 0.32, 3, 6]} />
              </mesh>
            </group>
          );
        })}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh key={`s${i}`} geometry={starGeometry()} material={sMat} position={[Math.cos(a) * 0.65, 1.0 + (i % 2) * 0.25, Math.sin(a) * 0.65]} scale={0.18} />
          );
        })}
      </group>
    </group>
  );
}

/** Stars circling above a dazed character's head. Place it at head height. */
export function DizzyStars({ position, radius = 0.32, count = 5, visible = true }: { position: V3; radius?: number; count?: number; visible?: boolean }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(starMat, []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.rotation.y = clock.elapsedTime * 3.5;
    g.current.children.forEach((c, i) => (c.rotation.y = -clock.elapsedTime * 3.5 + i));
  });
  if (!visible) return null;
  return (
    <group ref={g} position={position}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return <mesh key={i} geometry={starGeometry()} material={mat} position={[Math.cos(a) * radius, Math.sin(a * 2) * 0.04, Math.sin(a) * radius]} scale={0.07} />;
      })}
    </group>
  );
}

/** A big bouncy comic-book word ("CHOMP!", "MUNCH!", "SPLASH!") floating in the scene. */
export function ComicWord({
  position,
  text,
  color = '#ffd23f',
  ink = '#3b1d0e',
  size = 46,
  tilt = -8,
}: {
  position: V3;
  text: string;
  color?: string;
  ink?: string;
  size?: number;
  tilt?: number;
}) {
  return (
    <Html position={position} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          fontFamily: 'Fredoka, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1,
          color,
          WebkitTextStroke: `${Math.max(3, size / 12)}px ${ink}`,
          paintOrder: 'stroke fill',
          textShadow: `0 ${size / 10}px 0 ${ink}, 0 ${size / 5}px ${size / 3}px rgba(0,0,0,.35)`,
          whiteSpace: 'nowrap',
          letterSpacing: 1,
          animation: 'riddle-comic .55s cubic-bezier(.34,1.8,.64,1) both, riddle-wobble .9s ease-in-out .55s infinite',
          ['--tilt' as string]: `${tilt}deg`,
        }}
      >
        {text}
      </div>
      <style>{`
        @keyframes riddle-comic{0%{transform:scale(0) rotate(calc(var(--tilt) - 40deg))}100%{transform:scale(1) rotate(var(--tilt))}}
        @keyframes riddle-wobble{0%,100%{transform:scale(1) rotate(var(--tilt))}50%{transform:scale(1.08) rotate(calc(var(--tilt) * -0.6))}}
      `}</style>
    </Html>
  );
}

/** Shakes everything inside it for a moment whenever `trigger` changes (and is non-zero). */
export function Shake({ trigger, intensity = 0.12, durationMs = 500, children }: { trigger: number; intensity?: number; durationMs?: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const start = useRef(-1);
  useEffect(() => {
    if (trigger) start.current = performance.now();
  }, [trigger]);
  useFrame(() => {
    const o = g.current;
    if (!o) return;
    const e = start.current < 0 ? 1 : (performance.now() - start.current) / durationMs;
    if (e >= 1) {
      o.position.set(0, 0, 0);
      return;
    }
    const k = intensity * (1 - e) * (1 - e);
    o.position.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  });
  return <group ref={g}>{children}</group>;
}

/**
 * Dramatic zoom: while `active`, glide the camera in toward `target` (keeps the viewing angle,
 * `closer` = fraction of the distance kept). When it turns off (undo/restart), glide back.
 * Needs the shell's OrbitControls (they are `makeDefault`).
 */
export function FocusCam({ target, active, closer = 0.55, speed = 3 }: { target: V3; active: boolean; closer?: number; speed?: number }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; enabled: boolean } | null;
  const camera = useThree((s) => s.camera);
  const saved = useRef<{ target: THREE.Vector3; pos: THREE.Vector3 } | null>(null);
  const returning = useRef(false);
  const focus = useMemo(() => new THREE.Vector3(...target), [target[0], target[1], target[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!controls) return;
    if (active && !saved.current) {
      saved.current = { target: controls.target.clone(), pos: camera.position.clone() };
      returning.current = false;
    } else if (!active && saved.current) returning.current = true;
  }, [active, controls, camera]);

  useFrame((_, dt) => {
    const sv = saved.current;
    if (!controls || !sv) return;
    const k = 1 - Math.exp(-speed * dt);
    if (active) {
      const offset = sv.pos.clone().sub(sv.target).multiplyScalar(closer);
      controls.target.lerp(focus, k);
      camera.position.lerp(focus.clone().add(offset), k);
    } else if (returning.current) {
      controls.target.lerp(sv.target, k * 1.5);
      camera.position.lerp(sv.pos, k * 1.5);
      if (camera.position.distanceTo(sv.pos) < 0.02) {
        saved.current = null;
        returning.current = false;
      }
    }
  });
  return null;
}

/**
 * Plays a timed sequence of phases, e.g. ['windup', 'fight', 'aftermath'], starting when `start` turns true.
 * Returns the current phase name, or null before it starts / after `start` turns false.
 */
export function usePhases<P extends string>(start: boolean, phases: [P, number][], delayMs = 0): P | null {
  const [phase, setPhase] = useState<P | null>(null);
  useEffect(() => {
    if (!start) {
      setPhase(null);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = delayMs;
    for (const [name, dur] of phases) {
      timers.push(setTimeout(() => setPhase(name), at));
      at += dur;
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);
  return phase;
}

