import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, easeInOut, sfx, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing, type Mood } from '@riddle/props';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RopeBridge } from './Bridge';
import { Chasm } from './Chasm';
import { ExplorerBody, torchGrip, type Motion } from './Explorers';
import { BRIDGE_HALF, bridgehead, deckY, dipAt, groundY, sconce, sign, slot, TORCH_REST_Y } from './layout';
import { Blackout, DarkEyes } from './LightsOut';
import { Torch, type Flame } from './Torch';
import { crossingMinutes, EXPLORERS, MINUTES, NAMES, TORCH_MINUTES, type Explorer, type Move, type Side, type State } from './rules';

/** Walk to the bridge, cross it, step off to a waiting spot. */
const PREP_MS = 450;
const STEP_MS = 450;
/** Slower explorers take visibly longer on the bridge. */
const walkMs = (minutes: number) => 800 + minutes * 170;
export const MOVE_MS = PREP_MS + walkMs(10) + STEP_MS;

const FONT = 'Fredoka, system-ui, sans-serif';

/** Head height of each explorer, for the eyes that glow in the dark. */
const EYE_HEIGHT: Record<Explorer, number> = { pip: 0.75, juno: 0.86, bram: 0.97, mo: 0.84 };
/** Bubble heights differ so two walkers side by side don't overlap. */
const BUBBLE_LIFT: Record<Explorer, number> = { pip: 0.45, juno: 0.75, bram: 1.0, mo: 0.55 };
/** What each explorer squeaks when the torch dies. */
const DARK_LINES: Record<Explorer, string> = { pip: 'Eek!', juno: 'Who blew it out?!', bram: 'My glasses! Oh wait…', mo: 'Is it bedtime?' };

/** One crossing being animated. */
interface Crossing {
  start: number;
  walkers: Explorer[];
  from: Side;
  to: Side;
  t0: number;
  minutes: number;
  walk: number;
  /** Fraction of the bridge walked when the torch dies, if it does. */
  outAt: number | null;
  fromPos: Partial<Record<Explorer, THREE.Vector3>>;
  torchFrom: THREE.Vector3;
  played: { arrive: boolean; out: boolean };
}

interface Hop {
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  dur: number;
}

const v = (p: Vec3) => new THREE.Vector3(...p);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Height of someone standing at (x, z), on the bridge or on the ground. */
const standY = (x: number, z: number) => (Math.abs(x) < BRIDGE_HALF ? deckY(x) - dipAt(x, x) : groundY(x, z));
/** The torch bearer (the faster walker) takes the lane nearer the camera, so the flame stays in view. */
const laneOf = (walkers: Explorer[], e: Explorer) => (walkers.length === 1 ? 0 : walkers.indexOf(e) === 0 ? 1 : -1);

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** Explorers picked for the next crossing (UI only, not a move yet). */
  const [picked, setPicked] = useState<Explorer[]>([]);
  const [burst, setBurst] = useState(0);
  const [dark, setDark] = useState(false);
  const over = status.kind !== 'playing';
  const won = status.kind === 'won';

  const groups = useRef<Partial<Record<Explorer, THREE.Group>>>({});
  const motions = useMemo(() => Object.fromEntries(EXPLORERS.map((e) => [e, { speed: 0, carrying: false }])) as Record<Explorer, Motion>, []);
  const hops = useRef<Partial<Record<Explorer, Hop>>>({});
  const cross = useRef<Crossing | null>(null);
  const torch = useRef<THREE.Group>(null);
  const flame = useMemo<Flame>(() => ({ fuel: 1, outAt: null }), []);
  const onBridge = useRef<number[]>([]);
  const clockText = useRef<HTMLSpanElement>(null);
  const clockBar = useRef<HTMLDivElement>(null);
  const lastCount = useRef(moveCount);
  // drei's <Html> can come up empty if it mounts before the canvas has wired up its events,
  // so the 3D labels wait one frame.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Start a crossing when a move is made; otherwise (undo, restart) everyone hops back into place.
  useEffect(() => {
    const forward = moveCount > lastCount.current;
    lastCount.current = moveCount;
    setPicked([]);
    setDark(false);
    flame.outAt = null;
    cross.current = null;
    if (!forward || !lastMove || !previous) return;
    const minutes = crossingMinutes(lastMove);
    const walk = walkMs(minutes);
    const outAt = state.time > TORCH_MINUTES ? (TORCH_MINUTES - previous.time) / minutes : null;
    const fromPos: Crossing['fromPos'] = {};
    for (const w of lastMove.walkers) fromPos[w] = groups.current[w]?.position.clone() ?? v(slot(w, previous[w]));
    cross.current = {
      start: performance.now(),
      walkers: lastMove.walkers,
      from: previous.torch,
      to: state.torch,
      t0: previous.time,
      minutes,
      walk,
      outAt,
      fromPos,
      torchFrom: torch.current?.position.clone() ?? v(sconce(previous.torch)),
      played: { arrive: false, out: false },
    };
    sfx.row();
    if (outAt != null) {
      const t = setTimeout(() => setDark(true), PREP_MS + outAt * walk);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount, resetCount]);

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), MOVE_MS - 200);
    return () => clearTimeout(t);
  }, [won]);

  const rest = (e: Explorer): Vec3 => {
    const i = picked.indexOf(e);
    if (i >= 0) return bridgehead(state.torch, laneOf(picked, e));
    return slot(e, state[e]);
  };

  /** Position of a walker during a crossing, or null once they've finished it. */
  const walkerPos = (c: Crossing, e: Explorer, now: number): THREE.Vector3 | null => {
    const el = now - c.start;
    const lane = laneOf(c.walkers, e);
    const a = v(bridgehead(c.from, lane));
    const b = v(bridgehead(c.to, lane));
    if (el < PREP_MS) {
      const t = easeInOut(clamp01(el / PREP_MS));
      const p = c.fromPos[e]!.clone().lerp(a, t);
      p.y = lerp(c.fromPos[e]!.y, a.y, t) + Math.sin(Math.PI * t) * 0.12;
      return p;
    }
    let u = clamp01((el - PREP_MS) / c.walk);
    if (c.outAt != null) u = Math.min(u, c.outAt);
    if (el < PREP_MS + c.walk || c.outAt != null) {
      const ue = 0.8 * u + 0.2 * easeInOut(u);
      const x = lerp(a.x, b.x, ue);
      const z = a.z;
      return new THREE.Vector3(x, standY(x, z), z);
    }
    const t = clamp01((el - PREP_MS - c.walk) / STEP_MS);
    if (t >= 1) return null;
    const end = v(slot(e, c.to));
    const te = easeInOut(t);
    const p = b.clone().lerp(end, te);
    p.y += Math.sin(Math.PI * te) * 0.3;
    return p;
  };

  const prevPos = useMemo(() => Object.fromEntries(EXPLORERS.map((e) => [e, new THREE.Vector3()])) as Record<Explorer, THREE.Vector3>, []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dtRaw) => {
    const now = performance.now();
    const dt = Math.max(dtRaw, 1e-3);
    const c = cross.current;
    const bridgeXs: number[] = [];

    for (const e of EXPLORERS) {
      const g = groups.current[e];
      if (!g) continue;
      const target = v(rest(e));
      let pos: THREE.Vector3 | null = null;
      if (c && c.walkers.includes(e)) {
        pos = walkerPos(c, e, now);
        if (pos) hops.current[e] = { from: target.clone(), to: target.clone(), start: 0, dur: 1 };
      }
      if (!pos) {
        let h = hops.current[e];
        if (!h) {
          h = hops.current[e] = { from: target.clone(), to: target.clone(), start: 0, dur: 1 };
          g.position.copy(target);
          prevPos[e].copy(target);
        }
        if (h.to.distanceTo(target) > 0.01) {
          const dist = g.position.distanceTo(target);
          hops.current[e] = h = { from: g.position.clone(), to: target, start: now, dur: Math.min(900, 280 + dist * 110) };
        }
        const t = easeInOut(clamp01((now - h.start) / h.dur));
        pos = h.from.clone().lerp(h.to, t);
        pos.y += Math.sin(Math.PI * t) * Math.min(0.5, 0.15 + h.from.distanceTo(h.to) * 0.08);
      }
      g.position.copy(pos);
      if (Math.abs(pos.x) < BRIDGE_HALF) bridgeXs.push(pos.x);

      // Speed drives the walk cycle; direction of travel drives facing.
      tmp.subVectors(pos, prevPos[e]);
      tmp.y = 0;
      const speed = tmp.length() / dt;
      motions[e].speed += (speed - motions[e].speed) * Math.min(1, dt * 12);
      prevPos[e].copy(pos);
      const side = state[e];
      let yaw = won && !busy ? 0 : picked.includes(e) ? (side === 'L' ? Math.PI / 2 : -Math.PI / 2) : side === 'L' ? Math.PI / 2 - 0.55 : -Math.PI / 2 + 0.55;
      if (speed > 0.4) yaw = Math.atan2(tmp.x, tmp.z);
      if (c && c.outAt != null && c.walkers.includes(e) && now - c.start > PREP_MS) yaw = Math.atan2(sign(c.to), 0);
      let d = yaw - g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.rotation.y += d * Math.min(1, dt * 9);
    }
    onBridge.current = bridgeXs;

    // ---- Torch: picked up, carried over, put back in its stand ----
    const tg = torch.current;
    let minutes = state.time;
    for (const e of EXPLORERS) motions[e].carrying = false;
    if (c) {
      const el = now - c.start;
      const u = clamp01((el - PREP_MS) / c.walk);
      minutes = c.t0 + c.minutes * (c.outAt != null ? Math.min(u, c.outAt) : u);
      if (c.outAt != null && u >= c.outAt && flame.outAt == null) {
        flame.outAt = now;
        if (!c.played.out) {
          c.played.out = true;
          sfx.splash();
          setTimeout(() => sfx.deselect(), 350);
        }
      }
      if (!c.played.arrive && c.outAt == null && el > PREP_MS + c.walk) {
        c.played.arrive = true;
        sfx.hop();
      }
      const carrier = c.walkers[0];
      const cg = groups.current[carrier];
      if (tg && cg) {
        const [gx, gy, gz] = torchGrip(carrier);
        const yaw = cg.rotation.y;
        const hand = new THREE.Vector3(gx * Math.cos(yaw) + gz * Math.sin(yaw), gy, -gx * Math.sin(yaw) + gz * Math.cos(yaw)).add(cg.position);
        const restAt = v(sconce(c.to));
        restAt.y = groundY(restAt.x, restAt.z) + TORCH_REST_Y;
        if (el < PREP_MS) tg.position.copy(c.torchFrom).lerp(hand, easeInOut(clamp01(el / PREP_MS)));
        else if (el < PREP_MS + c.walk || c.outAt != null) tg.position.copy(hand);
        else tg.position.copy(hand).lerp(restAt, easeInOut(clamp01((el - PREP_MS - c.walk) / STEP_MS)));
        motions[carrier].carrying = el > PREP_MS * 0.5 && (el < PREP_MS + c.walk + STEP_MS * 0.5 || c.outAt != null);
      }
    } else if (tg) {
      const restAt = v(sconce(state.torch));
      restAt.y = groundY(restAt.x, restAt.z) + TORCH_REST_Y;
      if (tg.position.lengthSq() === 0) tg.position.copy(restAt);
      tg.position.lerp(restAt, Math.min(1, dt * 8));
    }
    if (tg) tg.rotation.z = Math.sin(now * 0.004) * 0.05;
    flame.fuel = clamp01(1 - minutes / TORCH_MINUTES);

    // ---- Torch clock ----
    const shown = Math.min(minutes, TORCH_MINUTES);
    if (clockText.current) clockText.current.textContent = String(Math.floor(shown + 1e-6));
    if (clockBar.current) {
      const left = 1 - shown / TORCH_MINUTES;
      clockBar.current.style.width = `${left * 100}%`;
      clockBar.current.style.background = left < 0.2 ? 'linear-gradient(90deg,#ef476f,#ff8a5c)' : 'linear-gradient(90deg,#ff8a2a,#ffd166)';
    }
  });

  // ---- Input ----
  const lastToggle = useRef<Partial<Record<Explorer, number>>>({});
  const toggle = (e: Explorer) => {
    if (busy || over) return;
    if (state[e] !== state.torch) {
      sfx.denied();
      return;
    }
    // Ignore a second tap on the same explorer right after the first, so a double tap doesn't pick
    // them and then send them straight back.
    const now = performance.now();
    if (now - (lastToggle.current[e] ?? -1e9) < 450) return;
    if (picked.includes(e)) {
      lastToggle.current[e] = now;
      sfx.deselect();
      setPicked(picked.filter((p) => p !== e));
    } else if (picked.length >= 2) {
      // The bridge only holds two: refuse instead of quietly sending the first one back.
      sfx.denied();
    } else {
      lastToggle.current[e] = now;
      sfx.select();
      const next = [...picked, e];
      setPicked(EXPLORERS.filter((x) => next.includes(x)));
    }
  };
  const go = () => {
    if (busy || over) return;
    if (picked.length === 0) {
      sfx.denied();
      return;
    }
    play({ walkers: picked });
  };

  const hinted = hint?.walkers ?? [];
  const hintMatches = hint != null && hinted.length === picked.length && hinted.every((h) => picked.includes(h));
  const pickedMinutes = picked.length ? Math.max(...picked.map((p) => MINUTES[p])) : 0;
  const s = sign(state.torch);

  return (
    <group>
      <Chasm won={won && !busy} />
      <Clickable onClick={go} disabled={busy || over || picked.length === 0} hoverScale={1}>
        <RopeBridge walkers={onBridge} />
      </Clickable>
      <Torch ref={torch} flame={flame} />
      <Blackout flame={flame} />

      {EXPLORERS.map((e, i) => {
        const mood: Mood = won && !busy ? 'happy' : dark ? 'scared' : 'idle';
        const active = !busy && !over && state[e] === state.torch;
        return (
          <group key={e} ref={(g) => void (groups.current[e] = g ?? undefined)}>
            <Clickable onClick={() => toggle(e)} disabled={busy || over}>
              <ExplorerBody kind={e} mood={mood} motion={motions[e]} seed={i} />
              <mesh position-y={0.5} visible={false}>
                <sphereGeometry args={[0.5, 8, 8]} />
              </mesh>
            </Clickable>
            {ready && !dark && <Html position={[0, e === 'pip' ? 1.0 : e === 'bram' ? 1.3 : 1.18, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: 12,
                  padding: '1px 8px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  background: picked.includes(e) ? '#ffd166' : 'rgba(20,12,28,.62)',
                  color: picked.includes(e) ? '#3b2300' : '#fff',
                  border: '1.5px solid rgba(255,255,255,.35)',
                  opacity: active || picked.includes(e) || over ? 1 : 0.7,
                  transition: 'background .2s, opacity .2s',
                }}
              >
                {NAMES[e]} · {MINUTES[e]} min
              </div>
            </Html>}
            <DarkEyes flame={flame} height={EYE_HEIGHT[e]} seed={i} />
            {dark && <Bubble position={[0, EYE_HEIGHT[e] + BUBBLE_LIFT[e], 0]} tone={cross.current?.walkers[0] === e ? 'gold' : 'white'}>{cross.current?.walkers[0] === e ? 'Pfft… uh-oh!' : DARK_LINES[e]}</Bubble>}
          </group>
        );
      })}

      {/* hint rings */}
      {hint && !busy && !over &&
        (hintMatches ? (
          <HintRing position={[s * 3.85, 0.06, 0]} radius={0.85} />
        ) : (
          hinted
            .filter((h) => !picked.includes(h))
            .map((h) => {
              const p = slot(h, state[h]);
              return <HintRing key={h} position={[p[0], p[1] + 0.05, p[2]]} radius={0.55} />;
            })
        ))}
      {picked.length > 0 && !busy && <HintRing position={[s * 3.85, groundY(s * 3.85, 0) + 0.05, 0]} radius={0.7} color="#7ee0b0" />}

      {/* Cross button, pinned just above the game's own buttons (over the chasm), so on a phone it
          never covers the torch clock or an explorer. */}
      {ready && !busy && !over && (
        <Html calculatePosition={(_el, _cam, size) => [size.width / 2, size.height - 62 - size.height * 0.13]} zIndexRange={[5, 0]}>
          <button
            onClick={go}
            style={{
              transform: 'translate(-50%, -50%)',
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 17,
              padding: '8px 16px',
              borderRadius: 999,
              border: '2px solid rgba(255,255,255,.8)',
              background: picked.length ? 'linear-gradient(#ffe08a,#f4b03e)' : 'linear-gradient(#ffffff,#e8dccb)',
              color: '#1f2937',
              boxShadow: '0 4px 0 rgba(0,0,0,.2), 0 10px 20px rgba(0,0,0,.25)',
              whiteSpace: 'nowrap',
              cursor: picked.length ? 'pointer' : 'default',
              opacity: picked.length ? 1 : 0.85,
            }}
          >
            {picked.length ? (
              <>
                {state.torch === 'L' ? 'Cross ➜' : '⬅ Cross back'}
                <span style={{ opacity: 0.75, fontSize: 13, marginLeft: 6 }}>{pickedMinutes} min</span>
              </>
            ) : (
              <span style={{ fontSize: 14 }}>Pick 1 or 2 explorers</span>
            )}
          </button>
        </Html>
      )}

      {/* Torch clock, pinned under the top bar */}
      {ready && (
      <Html calculatePosition={(_el, _cam, size) => [size.width / 2, 92]} zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            transform: 'translateX(-50%)',
            fontFamily: FONT,
            color: '#fff',
            background: 'rgba(30,14,24,.55)',
            border: '1.5px solid rgba(255,210,150,.35)',
            borderRadius: 18,
            padding: '6px 14px 8px',
            minWidth: 190,
            textAlign: 'center',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 8px 24px rgba(0,0,0,.3)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.8 }}>🔥 Torch time</div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
            <span ref={clockText}>0</span>
            <span style={{ opacity: 0.7, fontSize: 15 }}> / {TORCH_MINUTES} min</span>
          </div>
          <div style={{ marginTop: 4, height: 7, borderRadius: 9, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
            <div ref={clockBar} style={{ height: '100%', width: '100%', borderRadius: 9 }} />
          </div>
        </div>
      </Html>
      )}

      <Burst trigger={burst} position={[6.8, 1.8, -1.8]} />
    </group>
  );
}
