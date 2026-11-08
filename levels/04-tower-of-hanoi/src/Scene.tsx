import type { SceneProps } from '@riddle/engine';
import { Burst, ComicWord, DizzyStars, Shake, sfx, usePath, type PathSegment, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing, toon } from '@riddle/props';
import { useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { boing, chime, giggle } from './audio';
import { Guardian, type GuardianMood } from './Guardian';
import { DISCS, PEGS, canMove, top, type Move, type Peg, type State } from './rules';
import { DiscFace, DustPuff, type FaceMood } from './Slapstick';
import { Temple } from './Temple';

const LIFT_MS = 300;
const GLIDE_MS = 520;
const DROP_MS = 340;
export const MOVE_MS = LIFT_MS + GLIDE_MS + DROP_MS + 60;

const PEG_X = [-2.7, 0, 2.7];
/** Top of a pillar's plinth, where the bottom disc rests. */
const BASE_Y = 0.44;
const DISC_H = 0.3;
const ROD_H = 2.35;
/** Height a lifted disc floats at, just above the rod tips. */
const LIFT_Y = BASE_Y + ROD_H + 0.42;
const GOAL: Peg = 2;

// The "bonk" when a disc is dropped on a smaller one: fly over, fall, BOING off, float home.
const BONK_OVER = 240;
const BONK_FALL = 170;
const BONK_UP = 280;
const BONK_HOME = 420;
/** Time from the tap to the impact. */
const BONK_HIT = BONK_OVER + BONK_FALL;
const BONK_MS = BONK_HIT + BONK_UP + BONK_HOME + 40;
/** How long faces, stars and the monkey's giggle last after the tap. */
const DAZE_MS = 2300;

/** A bounced-off drop: the lifted disc tried to land on a smaller one. */
interface Bonk {
  from: Peg;
  to: Peg;
  /** performance.now() of the tap. */
  at: number;
  /** The disc that bounced and the one it bonked. */
  size: number;
  under: number;
}

const discRadius = (size: number) => 0.42 + size * 0.15;
const JADE = ['', '#c8fde3', '#86ecc0', '#45cc9a', '#1fa077'];

function where(s: State, size: number): [Peg, number] {
  for (const p of PEGS) {
    const i = s.pegs[p].indexOf(size);
    if (i >= 0) return [p, i];
  }
  return [0, 0];
}
const restPos = (p: Peg, i: number): Vec3 => [PEG_X[p], BASE_Y + i * DISC_H, 0];

export function Scene({ state, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** The pillar whose top disc the player has lifted (UI only, not a move yet). */
  const [selected, setSelected] = useState<Peg | null>(null);
  const [bonk, setBonk] = useState<Bonk | null>(null);
  /** True from the tap until the bouncing disc is home again: input waits. */
  const [bouncing, setBouncing] = useState(false);
  /** True from the impact until the dizzy faces and giggles are over. */
  const [dazed, setDazed] = useState(false);
  const [boingBubble, setBoingBubble] = useState(false);
  const [shake, setShake] = useState(0);
  const [party, setParty] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastCount = useRef(moveCount);
  const forward = moveCount > lastCount.current;
  useEffect(() => {
    lastCount.current = moveCount;
    setSelected(null);
  }, [moveCount, resetCount]);

  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  useEffect(() => {
    if (!won) {
      setParty(false);
      return;
    }
    const t = setTimeout(() => {
      setParty(true);
      setBurst((b) => b + 1);
    }, MOVE_MS);
    return () => clearTimeout(t);
  }, [won]);

  useEffect(() => {
    if (!bonk) return;
    const timers = [
      setTimeout(() => {
        boing();
        sfx.poof();
        setDazed(true);
        setBoingBubble(true);
        setShake((n) => n + 1);
      }, BONK_HIT),
      setTimeout(giggle, BONK_HIT + 200),
      setTimeout(() => setBoingBubble(false), BONK_HIT + 750),
      setTimeout(() => setBouncing(false), BONK_MS),
      setTimeout(() => {
        setDazed(false);
        setBonk(null);
      }, DAZE_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [bonk]);
  // A restart or undo cancels any bonk in progress.
  useEffect(() => {
    setBonk(null);
    setBouncing(false);
    setDazed(false);
    setBoingBubble(false);
  }, [moveCount, resetCount]);

  const tapPeg = (p: Peg) => {
    if (busy || over || bouncing) return;
    if (selected === null) {
      if (state.pegs[p].length === 0) return void sfx.denied();
      sfx.select();
      setSelected(p);
    } else if (selected === p) {
      sfx.deselect();
      setSelected(null);
    } else if (canMove(state, selected, p)) {
      setSelected(null);
      play({ from: selected, to: p });
    } else {
      // Not allowed: let the player try anyway, and bounce the disc off with a BOING.
      sfx.hop();
      setBouncing(true);
      setDazed(false);
      setBonk({ from: selected, to: p, at: performance.now(), size: top(state, selected)!, under: top(state, p)! });
    }
  };

  const animKey = `${moveCount}|${resetCount}`;
  const lifted = selected !== null ? top(state, selected) : undefined;

  // What the monkey watches: the lifted disc, or where the last disc went.
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const lookPeg = selected ?? (lastMove ? lastMove.to : 0);
  lookAt.set(PEG_X[lookPeg], selected !== null ? LIFT_Y : 1, 0);
  const guardianMood: GuardianMood = party ? 'happy' : dazed ? 'laugh' : 'idle';
  if (bonk && bouncing) lookAt.set(PEG_X[bonk.to], LIFT_Y - 0.6, 0);
  const landY = bonk ? BASE_Y + state.pegs[bonk.to].length * DISC_H + 0.02 : 0;

  // Hint: point at the pillar to lift from, then at the pillar to drop on.
  const hintPeg: Peg | null = hint && !busy ? (selected === hint.from ? hint.to : hint.from) : null;

  return (
    <Shake trigger={shake} intensity={0.06} durationMs={350}>
      <Temple />

      {PEGS.map((p) => (
        <Pillar
          key={p}
          peg={p}
          goal={p === GOAL}
          mode={selected === null ? 'idle' : selected === p ? 'source' : canMove(state, selected, p) ? 'drop' : 'blocked'}
          deniedAt={bonk?.to === p ? bonk.at + BONK_HIT : 0}
          party={party && p === GOAL}
          disabled={busy || over}
          onTap={() => tapPeg(p)}
        />
      ))}

      {Array.from({ length: DISCS }, (_, i) => i + 1).map((size) => (
        <Disc
          key={size}
          size={size}
          state={state}
          lastMove={lastMove}
          forward={forward}
          selected={lifted === size}
          animKey={animKey}
          bonk={bonk && (bonk.size === size || bonk.under === size) ? bonk : null}
          face={party ? 'happy' : dazed && bonk?.size === size ? 'dizzy' : dazed && bonk?.under === size ? 'angry' : 'none'}
          party={party}
        />
      ))}

      <Guardian position={[4.9, 0, -1.7]} scale={1.3} yaw={-0.55} mood={guardianMood} lookAt={lookAt} />
      {bonk && boingBubble && <ComicWord position={[PEG_X[bonk.to] + 0.6, landY + 1.1, 0.4]} text="BOING!" size={40} />}
      {bonk && dazed && !boingBubble && (
        <Bubble position={[PEG_X[bonk.to], landY + 0.55, 0.3]} tone="red">
          Too big!
        </Bubble>
      )}
      {dazed && <Bubble position={[4.9, 3.3, -1.7]} tone="white">Hee hee!</Bubble>}
      {bonk && <DustPuff at={bonk.at + BONK_HIT} position={[PEG_X[bonk.to], landY, 0]} radius={discRadius(bonk.under) * 0.8} />}
      {party && <Bubble position={[4.9, 3.4, -1.7]} tone="gold">Hooray!</Bubble>}

      {hintPeg !== null && <HintRing position={[PEG_X[hintPeg], BASE_Y + 0.02, 0]} radius={1.45} />}
      <Burst trigger={burst} position={[PEG_X[GOAL], 2.6, 0]} />
    </Shake>
  );
}

// ---------------------------------------------------------------------------------------------

type PillarMode = 'idle' | 'source' | 'drop' | 'blocked';
const RUNE_COLOR: Record<PillarMode, string> = { idle: '#7ee0b0', source: '#a8ffd6', drop: '#7ee0b0', blocked: '#ff7b6b' };

function Pillar({
  peg,
  goal,
  mode,
  deniedAt,
  party,
  disabled,
  onTap,
}: {
  peg: Peg;
  goal: boolean;
  mode: PillarMode;
  deniedAt: number;
  party: boolean;
  disabled: boolean;
  onTap(): void;
}) {
  const [hover, setHover] = useState(false);
  useCursor(hover && !disabled);
  const rune = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7ee0b0', emissive: new THREE.Color('#3fd69c'), emissiveIntensity: 1, roughness: 0.4 }), []);
  const orb = useMemo(
    () => new THREE.MeshStandardMaterial({ color: goal ? '#ffd27a' : '#8ff5c8', emissive: new THREE.Color(goal ? '#ffb347' : '#3fe0a0'), emissiveIntensity: 2.5, roughness: 0.25, flatShading: true }),
    [goal],
  );
  useEffect(() => () => {
    rune.dispose();
    orb.dispose();
  }, [rune, orb]);
  const sun = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const sinceDenied = (performance.now() - deniedAt) / 1000;
    const flash = deniedAt && sinceDenied < 0.9 ? 1 - sinceDenied / 0.9 : 0;
    let target = 0.6;
    if (mode === 'source') target = 3;
    else if (mode === 'drop') target = 1.6 + Math.sin(t * 6) * 0.8;
    else if (mode === 'blocked') target = 0.25;
    if (hover && !disabled) target += 1.5;
    if (party) target = 3.5;
    rune.emissiveIntensity = THREE.MathUtils.lerp(rune.emissiveIntensity, target, Math.min(1, dt * 10)) + flash * 3;
    rune.emissive.set(flash > 0 ? '#ff4d4d' : party ? '#ffc04a' : RUNE_COLOR[mode]);
    orb.emissiveIntensity = (goal ? 2.6 : 2) + Math.sin(t * 2 + peg) * 0.5 + (party ? 2 : 0);
    if (sun.current) {
      sun.current.rotation.y += dt * (party ? 4 : 0.5);
      sun.current.position.y = Math.sin(t * 1.5) * 0.06;
    }
    if (beam.current && beamMat.current) {
      const o = THREE.MathUtils.lerp(beamMat.current.opacity, party ? 0.32 : 0, Math.min(1, dt * 2));
      beamMat.current.opacity = o;
      beam.current.visible = o > 0.01;
      beam.current.rotation.y += dt * 0.6;
    }
  });

  const sandstone = toon('#d9a66a', { rough: 0.9 });
  const trim = toon('#b8834f');
  const bronze = toon('#e0a85a', { metal: 0.45, rough: 0.35 });

  return (
    <group position={[PEG_X[peg], 0, 0]}>
      <group
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (!disabled) onTap();
        }}
      >
        {/* Octagonal plinth with a carved rune ring */}
        <mesh position-y={0.17} material={trim} castShadow receiveShadow>
          <cylinderGeometry args={[1.32, 1.42, 0.34, 8]} />
        </mesh>
        <mesh position-y={0.39} material={sandstone} castShadow receiveShadow>
          <cylinderGeometry args={[1.22, 1.3, 0.1, 8]} />
        </mesh>
        <mesh position-y={BASE_Y + 0.003} rotation-x={-Math.PI / 2} material={rune}>
          <ringGeometry args={[1.04, 1.16, 8, 1]} />
        </mesh>
        {/* Bronze rod with collars and a glowing orb cap */}
        <mesh position-y={BASE_Y + ROD_H / 2} material={bronze} castShadow>
          <cylinderGeometry args={[0.085, 0.1, ROD_H, 10]} />
        </mesh>
        {[0.06, ROD_H].map((y) => (
          <mesh key={y} position-y={BASE_Y + y} material={bronze}>
            <cylinderGeometry args={[0.16, 0.16, 0.08, 10]} />
          </mesh>
        ))}
        <mesh position-y={BASE_Y + ROD_H + 0.17} material={orb} castShadow>
          <icosahedronGeometry args={[0.17, 1]} />
        </mesh>
        {/* Big invisible tap target covering the whole pillar and its discs */}
        <mesh position-y={1.6} visible={false}>
          <cylinderGeometry args={[1.35, 1.35, 3.6, 8]} />
        </mesh>
      </group>

      {goal && (
        <>
          <group position-y={LIFT_Y + 0.75}>
            <group ref={sun} rotation-x={Math.PI / 2} scale={1.4}>
              <SunEmblem />
            </group>
          </group>
          <mesh ref={beam} position-y={4.4} visible={false}>
            <cylinderGeometry args={[0.9, 1.3, 8, 16, 1, true]} />
            <meshBasicMaterial ref={beamMat} color="#ffe9a8" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Golden sun disc floating over the goal pillar. */
function SunEmblem() {
  const gold = toon('#ffd27a', { metal: 0.6, rough: 0.3, emissive: '#ffb347', emissiveIntensity: 1.6 });
  return (
    <group>
      <mesh material={gold}>
        <cylinderGeometry args={[0.2, 0.2, 0.06, 12]} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32]} rotation={[0, -a, -Math.PI / 2]} material={gold}>
            <coneGeometry args={[0.06, 0.18, 4]} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------

interface DiscProps {
  size: number;
  state: State;
  lastMove: Move | null;
  forward: boolean;
  selected: boolean;
  animKey: string;
  /** Set when this disc bounced off, or got bonked by, a bigger one. */
  bonk: Bonk | null;
  face: FaceMood;
  party: boolean;
}

function Disc({ size, state, lastMove, forward, selected, animKey, bonk, face, party }: DiscProps) {
  const ref = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const squash = useRef<THREE.Group>(null);
  const [peg, idx] = where(state, size);
  const bouncer = bonk != null && bonk.size === size;
  const bonkAt = bonk?.at ?? 0;
  const rest = restPos(peg, idx);
  const moved = forward && lastMove != null && top(state, lastMove.to) === size;

  const segs = useMemo<PathSegment[]>(() => {
    const cur = ref.current?.position;
    if (moved && lastMove) {
      const alreadyUp = cur != null && cur.y > LIFT_Y - 0.05;
      return [
        { to: [PEG_X[lastMove.from], LIFT_Y, 0], durationMs: alreadyUp ? 1 : LIFT_MS, onStart: alreadyUp ? undefined : sfx.hop },
        { to: [PEG_X[lastMove.to], LIFT_Y, 0], durationMs: GLIDE_MS + (alreadyUp ? LIFT_MS : 0), height: 0.35, onStart: sfx.hop },
        { to: rest, durationMs: DROP_MS, onEnd: () => chime(size) },
      ];
    }
    if (selected && bouncer && bonk) {
      const tx = PEG_X[bonk.to];
      const land = BASE_Y + state.pegs[bonk.to].length * DISC_H + 0.02;
      return [
        { to: [tx, LIFT_Y, 0], durationMs: BONK_OVER, height: 0.3 },
        { to: [tx, land, 0], durationMs: BONK_FALL },
        { to: [tx, LIFT_Y + 0.15, 0], durationMs: BONK_UP },
        { to: [rest[0], LIFT_Y, 0], durationMs: BONK_HOME, height: 0.4 },
      ];
    }
    if (selected) return [{ to: [rest[0], LIFT_Y, 0], durationMs: LIFT_MS }];
    // Undo or restart across pillars: lift over the rods quickly, never through them.
    if (cur && Math.abs(cur.x - rest[0]) > 0.1)
      return [
        { to: [cur.x, LIFT_Y, 0], durationMs: 130 },
        { to: [rest[0], LIFT_Y, 0], durationMs: 220 },
        { to: rest, durationMs: 150 },
      ];
    return [{ to: rest, durationMs: 260 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, selected, bouncer ? bonkAt : 0]);
  usePath(ref, segs, `${animKey}|${selected}|${bouncer ? bonkAt : 0}`, { face: false });

  const inlay = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: new THREE.Color('#ffb347'), emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3, flatShading: true }),
    [],
  );
  useEffect(() => () => inlay.dispose(), [inlay]);

  useFrame(({ clock }, dt) => {
    const g = inner.current;
    const q = squash.current;
    if (!g || !q) return;
    const t = clock.elapsedTime;
    // Lifted: hover and slowly spin.
    q.position.y = selected ? Math.sin(t * 3 + size) * 0.06 : 0;
    g.rotation.y += dt * (selected ? 1.4 : party ? 2.5 : 0);
    // Bonk: squash and stretch like jelly at the impact; the bouncer wobbles home dizzy.
    const since = bonk ? (performance.now() - bonk.at - BONK_HIT) / 1000 : -1;
    let sy = 1;
    if (since >= 0 && since < 0.9) sy = 1 - (bouncer ? 0.45 : 0.3) * Math.cos(since * 26) * Math.exp(-since * 6);
    else if (party) sy = 1 + Math.max(0, Math.sin(t * 8 - size * 0.8)) * 0.12;
    const sxz = 1 / Math.sqrt(sy);
    q.scale.set(sxz, sy, sxz);
    q.rotation.z = bouncer && since > 0 && since < 1.6 ? Math.sin(since * 14) * 0.2 * (1 - since / 1.6) : 0;
    // Win: a golden glow rises up the tower, one disc after another.
    const wave = party ? 2.5 + Math.max(0, Math.sin(t * 4 - (DISCS - size) * 0.9)) * 4 : 0;
    const want = selected ? 3.5 : party ? wave : 1.2;
    inlay.emissiveIntensity = THREE.MathUtils.lerp(inlay.emissiveIntensity, want, Math.min(1, dt * 8));
  });

  const r = discRadius(size);
  const h = DISC_H - 0.02;
  const bevel = 0.055;
  const jade = toon(JADE[size], { rough: 0.32, emissive: JADE[size], emissiveIntensity: 0.12 });
  const gold = toon('#e3a943', { metal: 0.85, rough: 0.28 });
  return (
    <group ref={ref}>
      <group ref={squash}>
      <DiscFace mood={face} y={h / 2} z={r + 0.012} />
      <DizzyStars position={[0, h + 0.3, 0]} radius={r * 0.7} visible={face === 'dizzy'} />
      <group ref={inner}>
        <mesh position-y={bevel / 2} material={jade} castShadow receiveShadow>
          <cylinderGeometry args={[r, r - bevel, bevel, 32]} />
        </mesh>
        <mesh position-y={h / 2} material={jade} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, h - bevel * 2, 32]} />
        </mesh>
        <mesh position-y={h - bevel / 2} material={jade} castShadow receiveShadow>
          <cylinderGeometry args={[r - bevel, r, bevel, 32]} />
        </mesh>
        <mesh position-y={h / 2} rotation-x={Math.PI / 2} material={gold}>
          <torusGeometry args={[r + 0.006, 0.03, 6, 40]} />
        </mesh>
        {/* Glowing gold inlay ring with one notch per disc size, carved into the top */}
        <mesh position-y={h + 0.004} rotation-x={-Math.PI / 2} material={inlay}>
          <ringGeometry args={[r * 0.5, r * 0.62, 32]} />
        </mesh>
        {Array.from({ length: size }, (_, i) => {
          const a = (i / size) * Math.PI * 2 + 0.4;
          const d = r * 0.8;
          return (
            <mesh key={i} position={[Math.cos(a) * d, h + 0.01, Math.sin(a) * d]} rotation-y={-a} material={inlay}>
              <boxGeometry args={[0.07, 0.025, 0.07]} />
            </mesh>
          );
        })}
        <mesh position-y={h + 0.003} rotation-x={-Math.PI / 2} material={toon('#123f33')}>
          <circleGeometry args={[0.15, 16]} />
        </mesh>
      </group>
      </group>
    </group>
  );
}
