import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, ComicWord, DizzyStars, FocusCam, Shake, sfx, usePath, usePhases, type Vec3 } from '@riddle/fx';
import { Bubble, HintRing, toon } from '@riddle/props';
import { Html, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { mosaicTexture, outlineTexture, pieceGeometry } from './art';
import { ISLAND_TOP, Lagoon, WATER_Y } from './Lagoon';
import { MAX_SLIDES, SIZE, canSlide, colOf, rowOf, slideDir, type Move, type State } from './rules';
import { Shelly, TUMBLE, type ShellyMode, type TumblePath } from './Shelly';

const SLIDE_MS = 300;
export const MOVE_MS = SLIDE_MS + 60;

/** Distance between cell centres on the stone table. */
const PITCH = 1.06;
const TABLE_TOP = ISLAND_TOP + 0.36;
const TILE_H = 0.24;
const TILE_Y = TABLE_TOP + TILE_H / 2;
const cellPos = (cell: number): Vec3 => [(colOf(cell) - 1) * PITCH, TILE_Y, (rowOf(cell) - 1) * PITCH];

const SHELLY: TumblePath = {
  home: [-2.85, ISLAND_TOP, 1.2],
  edge: [-3.55, ISLAND_TOP, 1.95],
  splash: [-4.55, WATER_Y, 2.7],
};
const SHELLY_YAW = 0.75;
/** The missing ninth piece waits on a lily pad until the picture is ready for it. */
const SPARE_PAD: Vec3 = [4.55, WATER_Y + 0.06, 0.9];
const SPARE_FLOAT: Vec3 = [SPARE_PAD[0], SPARE_PAD[1] + 0.16, SPARE_PAD[2]];
const DIR_YAW = { up: 0, down: Math.PI, right: -Math.PI / 2, left: Math.PI / 2 } as const;

export function Scene({ state, status, play, busy, hint, resetCount }: SceneProps<State, Move>) {
  const over = status.kind !== 'playing';
  const won = status.kind === 'won';
  const lostNow = status.kind === 'lost' && !busy;
  const wonNow = won && !busy;
  const left = MAX_SLIDES - state.slides;

  // When the current ending started (for frame-driven animation).
  const [since, setSince] = useState(() => performance.now());
  useEffect(() => {
    setSince(performance.now());
  }, [lostNow, wonNow]);

  // ---- Fail beats: yawn, roll, splash, then fast asleep ----
  const phase = usePhases(lostNow, [
    ['yawn', TUMBLE.yawn * 1000],
    ['roll', (TUMBLE.spinEnd - TUMBLE.yawn) * 1000],
    ['splash', 900],
    ['after', 60000],
  ]);
  const [shake, setShake] = useState(0);
  const [splash, setSplash] = useState(0);
  const [party, setParty] = useState(0);
  useEffect(() => {
    if (phase === 'yawn') sfx.sadTrombone();
    if (phase === 'roll') sfx.boing();
    if (phase === 'splash') {
      sfx.splash();
      setShake((s) => s + 1);
      setSplash((s) => s + 1);
    }
    if (phase === 'after') sfx.squeak();
  }, [phase]);

  // ---- Win: the spare piece hops in, the picture glows, everyone parties ----
  useEffect(() => {
    if (!wonNow) return;
    const t = setTimeout(() => {
      setParty((p) => p + 1);
      sfx.win();
    }, 900);
    return () => clearTimeout(t);
  }, [wonNow]);

  const mode: ShellyMode = lostNow ? 'tumble' : wonNow ? 'happy' : !over && left <= 10 ? 'impatient' : 'idle';

  // Shake a tile that can't move, so the tap still gets an answer.
  const [nope, setNope] = useState<{ piece: number; at: number } | null>(null);
  const tap = (cell: number) => {
    if (busy || over) return;
    if (!canSlide(state, cell)) {
      sfx.denied();
      setNope({ piece: state.tiles[cell], at: performance.now() });
      return;
    }
    play({ cell });
  };

  // Drei <Html> mounted on the very first render can stay empty, so show the meter a moment later.
  const [uiReady, setUiReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setUiReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  const shellyHead: Vec3 = [SHELLY.home[0], SHELLY.home[1] + 1.1, SHELLY.home[2]];
  const splashAt: Vec3 = [SHELLY.splash[0], WATER_Y + 0.6, SHELLY.splash[2]];
  const focus: Vec3 = [(SHELLY.home[0] + SHELLY.splash[0]) / 2, 0.3, (SHELLY.home[2] + SHELLY.splash[2]) / 2];

  return (
    <Shake trigger={shake} intensity={0.1}>
      <Lagoon party={wonNow} />
      <FocusCam target={focus} active={lostNow} closer={0.35} />

      <StoneTable won={wonNow} since={since} />
      <Portrait won={wonNow} />

      {state.tiles.map((piece, cell) =>
        piece === 0 ? null : (
          <Tile
            key={piece}
            piece={piece}
            cell={cell}
            resetCount={resetCount}
            slidable={!busy && !over && canSlide(state, cell)}
            dirYaw={DIR_YAW[slideDir(state, cell)]}
            onTap={() => tap(cell)}
            disabled={busy || over}
            wonSince={wonNow ? since : null}
            nopeAt={nope?.piece === piece ? nope.at : 0}
          />
        ),
      )}
      <SparePiece won={wonNow} resetCount={resetCount} since={since} />

      {hint && !busy && !over && <HintRing position={[cellPos(hint.cell)[0], TILE_Y + TILE_H / 2 + 0.03, cellPos(hint.cell)[2]]} radius={0.52} />}

      <Shelly mode={mode} since={since} path={SHELLY} yaw={SHELLY_YAW} />

      {uiReady && !over && <PatienceMeter position={[SHELLY.home[0], SHELLY.home[1] + 1.55, SHELLY.home[2]]} left={left} />}
      {!over && left <= 5 && left > 0 && <Bubble position={[SHELLY.home[0] + 0.5, SHELLY.home[1] + 1.05, SHELLY.home[2]]}>*yaaawn*</Bubble>}

      {phase === 'yawn' && <ComicWord position={shellyHead} text="YAAAWN!" color="#c4b5fd" />}
      {phase === 'roll' && <ComicWord position={[SHELLY.edge[0], 1.3, SHELLY.edge[2]]} text="WHEEE!" color="#ffd166" tilt={-8} />}
      {phase === 'splash' && <ComicWord position={[splashAt[0], 1.4, splashAt[2]]} text="SPLOOSH!" color="#7dd3fc" />}
      {phase === 'after' && (
        <>
          <Bubble position={[splashAt[0] + 0.3, 1.0, splashAt[2]]}>Zzz… 💤</Bubble>
          <DizzyStars position={[SHELLY.splash[0], WATER_Y + 0.75, SHELLY.splash[2]]} radius={0.38} />
        </>
      )}
      <Burst trigger={splash} position={splashAt} colors={['#e0f7ff', '#9be3ff', '#5cc8f0', '#ffffff']} count={90} power={0.55} size={0.8} />
      <Burst trigger={party} position={[0, 1.4, 0]} />
      {wonNow && <Bubble position={[SHELLY.home[0], SHELLY.home[1] + 1.6, SHELLY.home[2]]} tone="gold">That's me! 🐢</Bubble>}
    </Shake>
  );
}

/** The carved stone table with a sunken 3x3 bed and glowing jade corner gems. */
function StoneTable({ won, since }: { won: boolean; since: number }) {
  const gems = useRef<THREE.MeshStandardMaterial>(null);
  const gemMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#58e0c0', emissive: '#2fe0b5', emissiveIntensity: 1.2, roughness: 0.3, flatShading: true }), []);
  gems.current = gemMat;
  useFrame(({ clock }) => {
    const age = (performance.now() - since) / 1000;
    gemMat.emissiveIntensity = won ? 3 + Math.sin(age * 8) * 1.2 : 1.1 + Math.sin(clock.elapsedTime * 1.5) * 0.3;
  });
  const W = PITCH * SIZE + 0.34;
  const rim = 0.17;
  return (
    <group>
      {/* pedestal */}
      <mesh position-y={ISLAND_TOP + 0.08} receiveShadow castShadow material={toon('#7d7889')}>
        <cylinderGeometry args={[2.55, 2.7, 0.16, 8]} />
      </mesh>
      <RoundedBox args={[W + 0.2, 0.22, W + 0.2]} radius={0.08} smoothness={2} position-y={TABLE_TOP - 0.11} receiveShadow castShadow material={toon('#a59e8e')} />
      {/* sunken bed */}
      <mesh position-y={TABLE_TOP + 0.005} receiveShadow material={toon('#24322f')}>
        <boxGeometry args={[W - rim, 0.01, W - rim]} />
      </mesh>
      {/* rim walls */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0, TABLE_TOP + 0.08, s * (W / 2)]} castShadow receiveShadow material={toon('#b8b09d')}>
            <boxGeometry args={[W + 0.2, 0.16, rim]} />
          </mesh>
          <mesh position={[s * (W / 2), TABLE_TOP + 0.08, 0]} castShadow receiveShadow material={toon('#b8b09d')}>
            <boxGeometry args={[rim, 0.16, W]} />
          </mesh>
        </group>
      ))}
      {/* jade gems on the corners */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[(sx * W) / 2, TABLE_TOP + 0.24, (sz * W) / 2]} material={gemMat}>
          <octahedronGeometry args={[0.13, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** The finished picture, carved into a standing stone behind the table: the goal to copy. */
function Portrait({ won }: { won: boolean }) {
  const tex = useMemo(() => mosaicTexture(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.6 }), [tex]);
  useFrame(({ clock }) => {
    mat.emissiveIntensity = won ? 0.9 + Math.sin(clock.elapsedTime * 6) * 0.25 : 0.45;
  });
  return (
    <group position={[0, ISLAND_TOP, -2.75]}>
      <RoundedBox args={[2.0, 2.35, 0.32]} radius={0.1} smoothness={2} position-y={1.2} castShadow receiveShadow material={toon('#9b9486')} />
      <mesh position={[0, 2.38, 0]} rotation-z={Math.PI / 2} castShadow material={toon('#9b9486')}>
        <cylinderGeometry args={[0.35, 0.35, 2.0, 10, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh position={[0, 1.33, 0.165]} material={mat}>
        <planeGeometry args={[1.6, 1.6]} />
      </mesh>
      {/* a little plaque */}
      <RoundedBox args={[0.9, 0.22, 0.06]} radius={0.04} smoothness={2} position={[0, 0.3, 0.18]} material={toon('#d29a3c', { metal: 0.4, rough: 0.5 })} />
      <Html position={[0, 0.3, 0.22]} center transform scale={0.18} zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'Fredoka, system-ui, sans-serif', fontWeight: 700, fontSize: 40, color: '#3b2610', whiteSpace: 'nowrap' }}>Shelly</div>
      </Html>
    </group>
  );
}

interface TileProps {
  piece: number;
  cell: number;
  resetCount: number;
  slidable: boolean;
  dirYaw: number;
  disabled: boolean;
  wonSince: number | null;
  nopeAt: number;
  onTap(): void;
}

function Tile({ piece, cell, resetCount, slidable, dirYaw, disabled, wonSince, nopeAt, onTap }: TileProps) {
  const ref = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const outline = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => mosaicTexture(), []);
  const geo = useMemo(() => pieceGeometry(piece, 0.88), [piece]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.55 }), [tex]);
  const stone = useMemo(() => toon(['#b9b2a2', '#b3ad9f', '#bdb6a4'][piece % 3]), [piece]);
  const home = cell === piece - 1;

  usePath(
    ref,
    [
      {
        to: cellPos(cell),
        durationMs: SLIDE_MS,
        height: 0.05,
        onStart: sfx.poof,
        onEnd: () => (home ? sfx.select() : sfx.click()),
      },
    ],
    `${cell}|${resetCount}`,
    { face: false },
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = inner.current;
    if (!g) return;
    // "Can't move" wobble.
    const n = (performance.now() - nopeAt) / 1000;
    g.rotation.z = n < 0.45 ? Math.sin(n * 40) * 0.08 * (1 - n / 0.45) : 0;
    // Win wave: tiles pop up one after another from the back-left corner, glowing.
    let lift = 0;
    let glow = home ? 0.38 : 0.3;
    if (wonSince != null) {
      const k = (performance.now() - wonSince) / 1000 - 0.75 - (rowOf(piece - 1) + colOf(piece - 1)) * 0.11;
      if (k > 0) {
        lift = k < 0.45 ? Math.sin((k / 0.45) * Math.PI) * 0.35 : 0;
        glow = k < 0.45 ? 0.3 + Math.sin((k / 0.45) * Math.PI) * 1.6 : 0.75 + Math.sin(t * 3 + piece) * 0.1;
      }
    }
    g.position.y = lift;
    mat.emissiveIntensity = glow;
    if (outline.current) outline.current.opacity = 0.55 + Math.sin(t * 5) * 0.3;
  });

  return (
    <group ref={ref}>
      <group ref={inner}>
        <Clickable onClick={onTap} disabled={disabled} hoverScale={slidable ? 1.05 : 1.02}>
          <RoundedBox args={[0.98, TILE_H, 0.98]} radius={0.07} smoothness={2} castShadow receiveShadow material={stone} />
          <mesh geometry={geo} material={mat} position-y={TILE_H / 2 + 0.003} rotation-x={-Math.PI / 2} receiveShadow />
        </Clickable>
        {slidable && (
          <group rotation-y={dirYaw} position-y={TILE_H / 2 + 0.008}>
            <mesh rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshBasicMaterial ref={outline} map={outlineTexture()} transparent toneMapped={false} depthWrite={false} color="#fff2a8" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

/** Piece ★ (bottom-right of the picture) bobs on a lily pad, then hops into place on a win. */
function SparePiece({ won, resetCount, since }: { won: boolean; resetCount: number; since: number }) {
  const ref = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const tex = useMemo(() => mosaicTexture(), []);
  const geo = useMemo(() => pieceGeometry(9, 0.88), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.55 }), [tex]);
  usePath(
    ref,
    won
      ? [{ to: cellPos(8), durationMs: 650, height: 1.4, delayMs: 100, onStart: sfx.boing, onEnd: sfx.select }]
      : [{ to: SPARE_FLOAT, durationMs: 300 }],
    `${won}|${resetCount}`,
    { face: false },
  );
  useFrame(({ clock }) => {
    const b = bob.current;
    if (!b) return;
    const t = clock.elapsedTime;
    if (won) {
      b.position.y = 0;
      b.rotation.set(0, 0, 0);
      const k = (performance.now() - since) / 1000 - 0.75 - 4 * 0.11;
      mat.emissiveIntensity = k > 0 && k < 0.45 ? 0.3 + Math.sin((k / 0.45) * Math.PI) * 1.6 : 0.75;
    } else {
      b.position.y = Math.sin(t * 1.3) * 0.04;
      b.rotation.set(Math.sin(t * 1.1) * 0.05, t * 0.15, Math.sin(t * 0.9) * 0.05);
      mat.emissiveIntensity = 0.4 + Math.sin(t * 2.5) * 0.15;
    }
  });
  return (
    <>
      <group position={SPARE_PAD}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow material={toon('#4fbf55', { flat: false })}>
          <circleGeometry args={[0.8, 22, 0.3, Math.PI * 2 - 0.6]} />
        </mesh>
      </group>
      <group ref={ref}>
        <group ref={bob}>
          <RoundedBox args={[0.98, TILE_H, 0.98]} radius={0.07} smoothness={2} castShadow material={toon('#c4bca8')} />
          <mesh geometry={geo} material={mat} position-y={TILE_H / 2 + 0.003} rotation-x={-Math.PI / 2} />
        </group>
      </group>
    </>
  );
}

function PatienceMeter({ position, left }: { position: Vec3; left: number }) {
  const frac = Math.max(0, left / MAX_SLIDES);
  const color = frac > 0.4 ? '#6ee7b7' : frac > 0.17 ? '#fcd34d' : '#fb7185';
  return (
    <Html position={position} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          fontFamily: 'Fredoka, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 13,
          color: '#1f2937',
          background: 'rgba(255,255,255,.92)',
          borderRadius: 999,
          padding: '5px 10px 6px',
          boxShadow: '0 4px 0 rgba(0,0,0,.15), 0 8px 18px rgba(0,0,0,.25)',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        <div>🐢 Shelly's patience: {left}</div>
        <div style={{ marginTop: 4, width: 120, height: 7, borderRadius: 99, background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{ width: `${frac * 100}%`, height: '100%', background: color, transition: 'width .3s, background .3s' }} />
        </div>
      </div>
    </Html>
  );
}
