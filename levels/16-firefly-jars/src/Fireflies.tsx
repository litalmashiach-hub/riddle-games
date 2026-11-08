import { useFrame } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOW, HOVER_Y, hoverPos, slotPos } from './layout';
import { CAPACITY, START, isDone, type Color, type Jar } from './rules';

/** Every firefly keeps its own identity (and colour) so moves animate the right one. */
const COLORS_BY_ID: Color[] = START.flat();
const N = COLORS_BY_ID.length;

/** Where the angry swarm is, `k` seconds after the fireflies lose patience. */
export function swarmCenter(k: number, out = new THREE.Vector3()) {
  out.set(0, 3.5, 0.4);
  if (k > 1.7) {
    const d = k - 1.7;
    out.x += d * d * 7;
    out.y += d * d * 2.2;
    out.z -= d * d * 3;
  }
  return out;
}

export type Phase = 'play' | 'won' | 'lost';

interface Place {
  jar: number;
  slot: number;
}

interface Bug {
  pos: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  dur: number;
  flying: boolean;
  /** Land on a slot (true) or just hover (false). */
  landing: boolean;
  landJar: number;
  yaw: number;
  seed: number;
  cheer: number; // time of the last happy spin
}

/** Keep fireflies that did not move where they are; match the rest by colour, nearest first. */
function assign(prev: (Place | null)[], jars: Jar[]): Place[] {
  const next: (Place | null)[] = new Array(N).fill(null);
  const taken = new Set<string>();
  prev.forEach((p, id) => {
    if (!p) return;
    const j = jars[p.jar];
    if (j && p.slot < j.length && j[p.slot] === COLORS_BY_ID[id]) {
      next[id] = p;
      taken.add(`${p.jar}:${p.slot}`);
    }
  });
  const open: Place[] = [];
  jars.forEach((j, jar) => j.forEach((_, slot) => !taken.has(`${jar}:${slot}`) && open.push({ jar, slot })));
  for (const o of open) {
    const c = jars[o.jar][o.slot];
    let best = -1;
    let bestD = Infinity;
    for (let id = 0; id < N; id++) {
      if (next[id] || COLORS_BY_ID[id] !== c) continue;
      const p = prev[id];
      const d = p ? Math.abs(p.jar - o.jar) * 10 + Math.abs(p.slot - o.slot) : 99;
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    if (best >= 0) next[best] = o;
  }
  return next.map((p) => p ?? { jar: 0, slot: 0 });
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Up out of the jar, across at cruise height, down into the other jar. */
function flightPoint(a: THREE.Vector3, d: THREE.Vector3, t: number, out: THREE.Vector3) {
  const H = Math.max(HOVER_Y, a.y, d.y);
  const l1 = H - a.y;
  const l2 = Math.hypot(d.x - a.x, d.z - a.z);
  const l3 = H - d.y;
  const total = l1 + l2 + l3 + 1e-6;
  const u = ease(t) * total;
  if (u <= l1) out.set(a.x, a.y + u, a.z);
  else if (u <= l1 + l2) {
    const k = (u - l1) / Math.max(l2, 1e-6);
    out.set(a.x + (d.x - a.x) * k, H + Math.sin(Math.PI * k) * Math.min(0.5, l2 * 0.12), a.z + (d.z - a.z) * k);
    // A little sideways wiggle, like a real bug.
    out.z += Math.sin(k * Math.PI * 3) * 0.08;
  } else out.set(d.x, H - (u - l1 - l2), d.z);
  return out;
}

const pathLength = (a: THREE.Vector3, d: THREE.Vector3) => {
  const H = Math.max(HOVER_Y, a.y, d.y);
  return H - a.y + Math.hypot(d.x - a.x, d.z - a.z) + (H - d.y);
};

export function Fireflies({
  jars,
  selected,
  grump,
  phase,
  shake,
  quick,
  onLand,
  onComplete,
}: {
  jars: Jar[];
  /** Jar whose top firefly is lifted out, waiting to be placed. */
  selected: number | null;
  /** 0 = happy, 1 = out of patience. */
  grump: number;
  phase: Phase;
  /** Bumps when a move is refused, so the lifted firefly shakes its head. */
  shake: number;
  /** Fast flights (undo / restart). */
  quick: boolean;
  onLand?: (jar: number, color: Color) => void;
  onComplete?: (jar: number, color: Color) => void;
}) {
  const quality = useSettings((s) => s.quality);
  const low = quality === 'low';

  const places = useRef<Place[]>(assign([], START));
  const bugs = useMemo<Bug[]>(
    () =>
      places.current.map((p, i) => {
        const v = new THREE.Vector3(...slotPos(p.jar, p.slot));
        return { pos: v.clone(), from: v.clone(), to: v.clone(), start: 0, dur: 1, flying: false, landing: false, landJar: -1, yaw: 0, seed: i * 1.37 + 0.4, cheer: -10 };
      }),
    [],
  );

  const props = useRef({ jars, selected, grump, phase, shake, onLand, onComplete });
  props.current = { jars, selected, grump, phase, shake, onLand, onComplete };

  // Re-plan targets whenever the jars or the lifted firefly change.
  const planKey = `${jars.map((j) => j.join(',')).join('|')}#${selected}#${phase}`;
  useEffect(() => {
    if (phase === 'lost') return;
    places.current = assign(places.current, jars);
    const now = performance.now() / 1000;
    places.current.forEach((p, id) => {
      const b = bugs[id];
      const isTop = p.slot === jars[p.jar].length - 1;
      const target = new THREE.Vector3(...(selected === p.jar && isTop && phase === 'play' ? hoverPos(p.jar) : slotPos(p.jar, p.slot)));
      if (target.distanceTo(b.to) < 1e-3 && (b.flying || b.pos.distanceTo(target) < 1e-3)) return;
      b.from.copy(b.pos);
      b.to.copy(target);
      b.start = now;
      const len = pathLength(b.from, b.to);
      b.dur = quick ? Math.min(0.55, 0.2 + len * 0.08) : Math.min(0.9, Math.max(0.3, 0.18 + len * 0.17));
      b.flying = true;
      b.landing = !(selected === p.jar && isTop);
      b.landJar = p.jar;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  const lostAt = useRef(-1);
  const lostFrom = useMemo(() => bugs.map(() => new THREE.Vector3()), [bugs]);
  useEffect(() => {
    if (phase === 'lost') {
      lostAt.current = performance.now() / 1000;
      bugs.forEach((b, i) => lostFrom[i].copy(b.pos));
    } else lostAt.current = -1;
  }, [phase, bugs, lostFrom]);

  const shakeAt = useRef(-10);
  useEffect(() => {
    if (shake > 0) shakeAt.current = performance.now() / 1000;
  }, [shake]);

  // Instanced parts: a handful of draw calls for all sixteen fireflies.
  const bulb = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const eyes = useRef<THREE.InstancedMesh>(null);
  const pupils = useRef<THREE.InstancedMesh>(null);
  const brows = useRef<THREE.InstancedMesh>(null);
  const mouths = useRef<THREE.InstancedMesh>(null);
  const wings = useRef<THREE.InstancedMesh>(null);
  const antennae = useRef<THREE.InstancedMesh>(null);

  // Glitter trail behind flying fireflies.
  const TRAIL = low ? 60 : 160;
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3).fill(-999), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    return { g, life: new Float32Array(TRAIL), base: new Float32Array(TRAIL * 3), next: 0 };
  }, [TRAIL]);

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      part: new THREE.Matrix4(),
      out: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      s: new THREE.Vector3(),
      p: new THREE.Vector3(),
      v: new THREE.Vector3(),
      c: new THREE.Color(),
      sw: new THREE.Vector3(),
    }),
    [],
  );
  const glow = useMemo(() => COLORS_BY_ID.map((c) => new THREE.Color(GLOW[c])), []);
  const headCalm = useMemo(() => new THREE.Color('#40366e'), []);
  const headMad = useMemo(() => new THREE.Color('#8a2f4f'), []);

  useLayoutEffect(() => {
    bugs.forEach((_, i) => {
      bulb.current?.setColorAt(i, glow[i]);
      head.current?.setColorAt(i, headCalm);
    });
  }, [bugs, glow, headCalm]);

  const part = (mesh: THREE.InstancedMesh | null, index: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    if (!mesh) return;
    tmp.e.set(rx, ry, rz);
    tmp.q.setFromEuler(tmp.e);
    tmp.part.compose(tmp.p.set(x, y, z), tmp.q, tmp.s.set(sx, sy, sz));
    tmp.out.multiplyMatrices(tmp.m, tmp.part);
    mesh.setMatrixAt(index, tmp.out);
  };

  useFrame(({ clock }) => {
    const now = performance.now() / 1000;
    const t = clock.elapsedTime;
    const P = props.current;
    const g = P.grump;
    const lost = P.phase === 'lost' && lostAt.current > 0;
    const won = P.phase === 'won';
    const k = lost ? now - lostAt.current : 0;
    if (lost) swarmCenter(k, tmp.sw);

    for (let i = 0; i < N; i++) {
      const b = bugs[i];
      let flapSpeed = 26;
      let tilt = 0;
      let extraYaw = 0;
      let hop = 0;

      if (lost) {
        // Out of patience: zoom up into a buzzing, squabbling swarm, then storm off.
        const blend = smooth(0, 0.8, k - (i % 5) * 0.05);
        const w = 5 + (i % 4) * 1.3;
        const r = 0.55 + 0.35 * Math.sin(i * 2.1 + k * 1.7);
        tmp.v.set(Math.sin(w * k + b.seed * 3) * r, Math.sin(w * 1.3 * k + i) * 0.45, Math.cos(w * k + b.seed * 3) * r * 0.7).add(tmp.sw);
        b.pos.lerpVectors(lostFrom[i], tmp.v, blend);
        flapSpeed = 46;
        tilt = Math.sin(k * 9 + i) * 0.5;
        extraYaw = w * k;
      } else if (b.flying) {
        const u = Math.min(1, (now - b.start) / b.dur);
        flightPoint(b.from, b.to, u, b.pos);
        flapSpeed = 40;
        tilt = Math.sin(u * Math.PI) * 0.25;
        if (u >= 1) {
          b.flying = false;
          b.pos.copy(b.to);
          if (b.landing && P.phase === 'play') {
            const jar = P.jars[b.landJar];
            P.onLand?.(b.landJar, COLORS_BY_ID[i]);
            // A jar of one colour: its fireflies do a happy spin.
            if (jar && isDone(jar) && jar.length === CAPACITY) {
              const pl = places.current;
              bugs.forEach((o, j) => pl[j].jar === b.landJar && (o.cheer = now));
              P.onComplete?.(b.landJar, COLORS_BY_ID[i]);
            }
          }
        }
      }

      // Idle life: bob, look around, happy spins.
      const bob = Math.sin(t * 2.2 + b.seed * 2) * 0.03;
      const sinceCheer = now - b.cheer;
      if (sinceCheer < 0.9) {
        extraYaw += ease(sinceCheer / 0.9) * Math.PI * 2;
        hop = Math.sin((sinceCheer / 0.9) * Math.PI) * 0.12;
      }
      let dx = 0;
      let dz = 0;
      if (won && !b.flying) {
        // Party: twirl around inside the jar.
        const a = t * 3 + b.seed * 4;
        dx = Math.cos(a) * 0.11;
        dz = Math.sin(a) * 0.11;
        hop += Math.abs(Math.sin(t * 6 + b.seed)) * 0.07;
        extraYaw += -a + Math.PI / 2;
        flapSpeed = 38;
      }
      // Grumpy fireflies jitter.
      const jitter = g > 0.6 && !lost ? (g - 0.6) * 0.06 * Math.sin(t * 40 + i * 7) : 0;

      // Face the way it flies, otherwise face the camera.
      let yawTarget = 0;
      if (b.flying) {
        const vx = b.to.x - b.from.x;
        const vz = b.to.z - b.from.z;
        if (Math.abs(vx) + Math.abs(vz) > 0.2) yawTarget = Math.atan2(vx, vz) * 0.6;
      }
      b.yaw += (yawTarget - b.yaw) * 0.12;

      // Head shake for a refused move (the lifted one) and when grumpy.
      let shakeYaw = 0;
      const sinceShake = now - shakeAt.current;
      const isLifted = P.selected !== null && places.current[i].jar === P.selected && places.current[i].slot === P.jars[P.selected].length - 1;
      if (sinceShake < 0.6 && isLifted) shakeYaw = Math.sin(sinceShake * 40) * 0.5 * (1 - sinceShake / 0.6);

      const hovering = isLifted && !b.flying && P.phase === 'play';
      const s = (hovering ? 1.15 : 1) * 1.45;
      tmp.e.set(tilt * 0.4, b.yaw + extraYaw + shakeYaw, tilt * 0.3 + jitter * 4);
      tmp.q.setFromEuler(tmp.e);
      tmp.m.compose(tmp.p.set(b.pos.x + dx + jitter, b.pos.y + bob + hop + (hovering ? Math.sin(t * 5) * 0.05 : 0), b.pos.z + dz), tmp.q, tmp.s.set(s, s, s));

      // Body parts (local space, facing +z).
      part(bulb.current, i, 0, -0.07, -0.05, -0.35, 0, 0, 1.1, 1.15, 1.35);
      part(head.current, i, 0, 0.09, 0.03);
      part(eyes.current, i * 2, -0.052, 0.115, 0.125);
      part(eyes.current, i * 2 + 1, 0.052, 0.115, 0.125);
      const look = Math.sin(t * 0.7 + b.seed) * 0.012;
      part(pupils.current, i * 2, -0.05 + look, 0.11 - g * 0.012, 0.163);
      part(pupils.current, i * 2 + 1, 0.054 + look, 0.11 - g * 0.012, 0.163);
      const browOn = lost ? 1 : smooth(0.35, 0.6, g);
      const ang = lost ? 0.6 : 0.2 + g * 0.45;
      part(brows.current, i * 2, -0.05, 0.168 - g * 0.01, 0.145, 0, 0, -ang, browOn, browOn, browOn);
      part(brows.current, i * 2 + 1, 0.05, 0.168 - g * 0.01, 0.145, 0, 0, ang, browOn, browOn, browOn);
      // Smile when calm, frown when grumpy (the arc flips over).
      const frown = lost || g > 0.65;
      part(mouths.current, i, 0, frown ? 0.035 : 0.06, 0.15, 0.15, 0, frown ? 0 : Math.PI, 1, won ? 1.4 : 1, 1);
      const flap = Math.sin(t * flapSpeed + b.seed * 5) * 0.55;
      part(wings.current, i * 2, -0.07, 0.17, -0.07, 0.3, 0.5, 0.55 + flap, 1, 1, 1);
      part(wings.current, i * 2 + 1, 0.07, 0.17, -0.07, 0.3, -0.5, -0.55 - flap, 1, 1, 1);
      part(antennae.current, i * 2, -0.035, 0.22, 0.06, 0.4, 0, 0.35);
      part(antennae.current, i * 2 + 1, 0.035, 0.22, 0.06, 0.4, 0, -0.35);

      // Glow: a gentle pulse, brighter when lifted or partying, flickery when grumpy.
      const flick = g > 0.5 && !won ? 1 - (g - 0.5) * 0.7 * (0.5 + 0.5 * Math.sin(t * 23 + i * 3)) : 1;
      const level = (1.25 + Math.sin(t * 2.5 + b.seed * 3) * 0.2 + (hovering ? 0.5 : 0) + (won ? 0.5 + Math.sin(t * 8 + i) * 0.3 : 0) + (lost ? 0.4 : 0)) * flick;
      tmp.c.copy(glow[i]).multiplyScalar(level);
      bulb.current?.setColorAt(i, tmp.c);
      tmp.c.copy(headCalm).lerp(glow[i], 0.4).lerp(headMad, lost ? 0.8 : Math.max(0, g - 0.4) / 0.75);
      head.current?.setColorAt(i, tmp.c);

      // Sparkle trail.
      if ((b.flying || lost) && Math.random() < (low ? 0.4 : 0.9)) {
        const n = trail.next;
        trail.next = (n + 1) % TRAIL;
        const pa = trail.g.attributes.position.array as Float32Array;
        pa[n * 3] = b.pos.x + (Math.random() - 0.5) * 0.08;
        pa[n * 3 + 1] = b.pos.y - 0.08 + (Math.random() - 0.5) * 0.08;
        pa[n * 3 + 2] = b.pos.z + (Math.random() - 0.5) * 0.08;
        trail.life[n] = 1;
        trail.base[n * 3] = glow[i].r;
        trail.base[n * 3 + 1] = glow[i].g;
        trail.base[n * 3 + 2] = glow[i].b;
      }
    }

    for (const mesh of [bulb, head, eyes, pupils, brows, mouths, wings, antennae]) {
      const m = mesh.current;
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    const col = trail.g.attributes.color.array as Float32Array;
    const pa = trail.g.attributes.position.array as Float32Array;
    for (let n = 0; n < TRAIL; n++) {
      if (trail.life[n] <= 0) continue;
      trail.life[n] = Math.max(0, trail.life[n] - 0.025);
      pa[n * 3 + 1] -= 0.002;
      const l = trail.life[n] * trail.life[n] * 2;
      col[n * 3] = trail.base[n * 3] * l;
      col[n * 3 + 1] = trail.base[n * 3 + 1] * l;
      col[n * 3 + 2] = trail.base[n * 3 + 2] * l;
    }
    trail.g.attributes.color.needsUpdate = true;
    trail.g.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bulb} args={[undefined, undefined, N]} frustumCulled={false}>
        <icosahedronGeometry args={[0.13, 2]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, N]} castShadow frustumCulled={false}>
        <icosahedronGeometry args={[0.12, 1]} />
        <meshStandardMaterial roughness={0.6} flatShading />
      </instancedMesh>
      <instancedMesh ref={eyes} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <sphereGeometry args={[0.048, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={pupils} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <sphereGeometry args={[0.026, 10, 8]} />
        <meshStandardMaterial color="#14101f" roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={brows} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <boxGeometry args={[0.065, 0.016, 0.016]} />
        <meshStandardMaterial color="#1a1028" />
      </instancedMesh>
      <instancedMesh ref={mouths} args={[undefined, undefined, N]} frustumCulled={false}>
        <torusGeometry args={[0.026, 0.008, 6, 12, Math.PI]} />
        <meshStandardMaterial color="#1a1028" />
      </instancedMesh>
      <instancedMesh ref={wings} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <sphereGeometry args={[0.1, 10, 6]} />
        <meshStandardMaterial color="#e8f4ff" emissive="#bfe6ff" emissiveIntensity={0.6} transparent opacity={0.5} depthWrite={false} roughness={0.2} />
      </instancedMesh>
      <instancedMesh ref={antennae} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <cylinderGeometry args={[0.006, 0.008, 0.1, 5]} />
        <meshStandardMaterial color="#2a2145" />
      </instancedMesh>
      <points geometry={trail.g} frustumCulled={false}>
        <pointsMaterial size={0.07} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} sizeAttenuation />
      </points>
    </group>
  );
}
