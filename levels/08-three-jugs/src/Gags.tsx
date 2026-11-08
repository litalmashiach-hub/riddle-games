import { useFrame } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';

/**
 * Funny reactions for silly taps:
 * - "burp": pouring into a full flask makes it burp, spit a spray of potion that splats on the ground, and puff a smoke ring.
 * - "empty": an empty flask flips over and shakes; one sad drop falls ("plip"), a dust puff and a little moth flutter out.
 */
export type GagKind = 'burp' | 'empty';
export interface GagEvent {
  kind: GagKind;
  /** World position of the flask's mouth when the gag fires. */
  at: [number, number, number];
  /** Ground height under the flask (pedestal top), where drops splat. */
  floor: number;
  t0: number;
}

export const BURP_MS = 900;
export const EMPTY_MS = 1350;
/** When, inside the "empty" gag, the flask hangs upside down and the drop falls. */
export const EMPTY_DROP_AT = 520;

// ---- Little synthesized sounds ----
let ctx: AudioContext | null = null;
function audio() {
  if (!useSettings.getState().sound || typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function voice(a: AudioContext, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0) {
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
export const gagSound = {
  /** One tiny drop. */
  plip() {
    const a = audio();
    if (!a) return;
    voice(a, 'sine', 900, 1700, 0.09, 0.12, EMPTY_DROP_AT / 1000 + 0.32);
  },
};

const SPRAY = 22;
const PUFF = 9;

interface Drop {
  p: THREE.Vector3;
  v: THREE.Vector3;
  born: number;
  /** ms after landing, or -1 while flying. */
  landed: number;
  floor: number;
  cx: number;
  cz: number;
  alive: boolean;
}

/** Plays every gag effect that `events` asks for. One draw call per effect type. */
export function GagFx({ events, potion }: { events: MutableRefObject<GagEvent[]>; potion: MutableRefObject<THREE.Color> }) {
  const high = useSettings((s) => s.quality) === 'high';
  const drops = useRef<THREE.InstancedMesh>(null);
  const puffs = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const moth = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const dropMat = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pool = useMemo<Drop[]>(
    () => Array.from({ length: SPRAY * 2 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), born: 0, landed: -1, floor: 0, cx: 0, cz: 0, alive: false })),
    [],
  );
  const handled = useRef(new Set<number>());
  const state = useRef<{ ring?: GagEvent; puff?: GagEvent; moth?: GagEvent }>({});

  const spawn = (at: [number, number, number], floor: number, count: number, now: number, spread: number, up: number) => {
    let n = 0;
    for (const d of pool) {
      if (n >= count) break;
      if (d.alive) continue;
      d.alive = true;
      d.born = now;
      d.landed = -1;
      d.floor = floor;
      d.cx = at[0];
      d.cz = at[2];
      d.p.set(at[0] + (Math.random() - 0.5) * 0.12, at[1] + 0.05, at[2] + (Math.random() - 0.5) * 0.12);
      const a = Math.random() * Math.PI * 2;
      const s = spread * (0.4 + Math.random() * 0.6);
      d.v.set(Math.cos(a) * s, up * (0.6 + Math.random() * 0.6), Math.sin(a) * s);
      n++;
    }
  };

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const now = performance.now();

    // Start new events.
    for (const e of events.current) {
      if (handled.current.has(e.t0)) continue;
      handled.current.add(e.t0);
      if (e.kind === 'burp') {
        spawn(e.at, e.floor, high ? SPRAY : 12, now + 120, 1.3, 3.2);
        state.current.ring = e;
      } else {
        state.current.puff = e;
        state.current.moth = e;
      }
    }
    events.current = events.current.filter((e) => now - e.t0 < 4000);

    // The single sad drop of an empty flask.
    const pe = state.current.puff;
    if (pe && pe.kind === 'empty' && now - pe.t0 > EMPTY_DROP_AT + 250 && !handled.current.has(pe.t0 + 0.5)) {
      handled.current.add(pe.t0 + 0.5);
      for (const d of pool) {
        if (d.alive) continue;
        d.alive = true;
        d.born = now;
        d.landed = -1;
        d.floor = pe.floor;
        d.cx = pe.at[0];
        d.cz = pe.at[2];
        d.p.set(pe.at[0], pe.at[1] - 0.05, pe.at[2]);
        d.v.set(0, -0.5, 0);
        break;
      }
    }

    // Potion drops: fly, fall, splat flat, fade.
    const m = drops.current;
    if (m) {
      if (dropMat.current) {
        dropMat.current.color.copy(potion.current);
        dropMat.current.emissive.copy(potion.current);
      }
      pool.forEach((d, i) => {
        if (d.alive && now >= d.born) {
          if (d.landed < 0) {
            d.v.y -= 9.8 * dt;
            d.p.addScaledVector(d.v, dt);
            // Land on the pedestal top if over it, else on the ground.
            const floor = Math.hypot(d.p.x - d.cx, d.p.z - d.cz) < 0.55 ? d.floor : 0.02;
            if (d.p.y <= floor + 0.01 && d.v.y < 0) {
              d.p.y = floor + 0.012;
              d.landed = now;
            }
            const sp = d.v.length();
            dummy.position.copy(d.p);
            dummy.lookAt(d.p.x + d.v.x, d.p.y + d.v.y, d.p.z + d.v.z);
            dummy.scale.set(1, 1, 1 + Math.min(sp * 0.25, 1.4));
          } else {
            const age = (now - d.landed) / 1300;
            if (age >= 1) d.alive = false;
            const grow = Math.min(1, (now - d.landed) / 90);
            dummy.position.copy(d.p);
            dummy.rotation.set(0, 0, 0);
            const s = (1 - age) * (1.2 + grow * 1.4);
            dummy.scale.set(s, 0.12, s);
          }
        } else {
          dummy.position.set(0, -50, 0);
          dummy.scale.setScalar(0);
        }
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }

    // Smoke ring from a burp.
    const r = ring.current;
    const re = state.current.ring;
    if (r) {
      const u = re ? (now - re.t0 - 80) / 1100 : 2;
      if (re && u >= 0 && u < 1) {
        r.visible = true;
        r.position.set(re.at[0], re.at[1] + 0.15 + u * 1.1, re.at[2]);
        r.scale.setScalar(0.6 + u * 2.2);
        r.rotation.set(Math.PI / 2 + Math.sin(u * 6) * 0.2, 0, 0);
        (r.material as THREE.MeshStandardMaterial).opacity = (1 - u) * 0.85;
      } else r.visible = false;
    }

    // Dust puff from an empty flask.
    const pm = puffs.current;
    if (pm) {
      const u = pe ? (now - pe.t0 - EMPTY_DROP_AT) / 1100 : 2;
      for (let i = 0; i < PUFF; i++) {
        if (pe && u >= 0 && u < 1) {
          const a = (i / PUFF) * Math.PI * 2 + i;
          const rr = 0.1 + u * (0.35 + (i % 3) * 0.08);
          dummy.position.set(pe.at[0] + Math.cos(a) * rr, pe.at[1] - 0.1 - u * 0.2 + Math.sin(i * 3) * 0.05, pe.at[2] + Math.sin(a) * rr);
          dummy.scale.setScalar((0.5 + u * 0.9) * (1 - u) * (0.7 + (i % 4) * 0.15));
        } else {
          dummy.position.set(0, -50, 0);
          dummy.scale.setScalar(0);
        }
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pm.setMatrixAt(i, dummy.matrix);
      }
      pm.instanceMatrix.needsUpdate = true;
    }

    // A tiny moth flutters out of the empty flask and away.
    const mo = moth.current;
    const me = state.current.moth;
    if (mo) {
      const u = me ? (now - me.t0 - EMPTY_DROP_AT + 100) / 2400 : 2;
      if (me && u >= 0 && u < 1) {
        mo.visible = true;
        const t = u * 2400;
        const a = u * Math.PI * 3.2;
        mo.position.set(me.at[0] + Math.sin(a) * (0.25 + u * 0.6), me.at[1] - 0.15 + u * 2.6 + Math.sin(t / 90) * 0.06, me.at[2] + Math.cos(a) * 0.4 * u);
        mo.rotation.y = a + Math.PI / 2;
        mo.scale.setScalar(Math.min(1, u * 8) * (u > 0.85 ? (1 - u) / 0.15 : 1));
        const flap = Math.sin(clock.elapsedTime * 38) * 0.9;
        if (wingL.current) wingL.current.rotation.z = 0.3 + flap;
        if (wingR.current) wingR.current.rotation.z = -0.3 - flap;
      } else mo.visible = false;
    }
  });

  const wing = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9e1ff', roughness: 0.9, side: THREE.DoubleSide, flatShading: true }), []);
  return (
    <group>
      <instancedMesh ref={drops} args={[undefined, undefined, pool.length]} frustumCulled={false} castShadow>
        <icosahedronGeometry args={[0.045, 1]} />
        <meshStandardMaterial ref={dropMat} color="#7417ff" emissive="#d63cff" emissiveIntensity={1.4} roughness={0.2} toneMapped={false} />
      </instancedMesh>
      <mesh ref={ring} visible={false}>
        <torusGeometry args={[0.18, 0.06, 8, 24]} />
        <meshStandardMaterial color="#ffd6f5" emissive="#ff9be6" emissiveIntensity={0.6} transparent depthWrite={false} roughness={1} />
      </mesh>
      <instancedMesh ref={puffs} args={[undefined, undefined, PUFF]} frustumCulled={false}>
        <icosahedronGeometry args={[0.14, 1]} />
        <meshStandardMaterial color="#d8d0ea" roughness={1} flatShading transparent opacity={0.9} />
      </instancedMesh>
      <group ref={moth} visible={false}>
        <mesh material={toon('#9a8bb8')}>
          <capsuleGeometry args={[0.025, 0.09, 3, 6]} />
        </mesh>
        {[0.03, -0.03].map((x) => (
          <mesh key={x} position={[x, 0.045, 0.04]} material={toon('#1d1b3a', { flat: false })}>
            <sphereGeometry args={[0.016, 6, 6]} />
          </mesh>
        ))}
        <group ref={wingL} position={[0.02, 0.02, 0]}>
          <mesh position={[0.09, 0, 0]} rotation-x={-Math.PI / 2} material={wing}>
            <circleGeometry args={[0.09, 6]} />
          </mesh>
        </group>
        <group ref={wingR} position={[-0.02, 0.02, 0]}>
          <mesh position={[-0.09, 0, 0]} rotation-x={-Math.PI / 2} material={wing}>
            <circleGeometry args={[0.09, 6]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
