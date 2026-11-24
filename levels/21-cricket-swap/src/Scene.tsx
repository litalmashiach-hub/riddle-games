import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, sfx, type Vec3 } from '@riddle/fx';
import { HintRing } from '@riddle/props';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Backdrop } from './Backdrop';
import { Cricket, LEAP_MS } from './Cricket';
import { CAP_TOP, capPos } from './layout';
import { Patch } from './Patch';
import { CELLS, START, freeLeaps, type Colour, type Move, type State } from './rules';

export const MOVE_MS = LEAP_MS + 140;

/** The four crickets keep their identity between moves, so each one visibly leaps (the rules only know colours). */
const COLOURS: Colour[] = ['A', 'A', 'B', 'B'];
const START_CELLS = COLOURS.map((c, i) => START.split('').flatMap((ch, cell) => (ch === c ? [cell] : []))[i % 2]);

/** After any change to the board, work out which cricket sits where, moving as few of them as possible. */
function follow(where: number[], board: string): number[] {
  const next = where.slice();
  const taken = new Set<number>();
  const loose: number[] = [];
  next.forEach((cell, id) => {
    if (board[cell] === COLOURS[id] && !taken.has(cell)) taken.add(cell);
    else loose.push(id);
  });
  for (const id of loose) {
    const cell = board.split('').findIndex((ch, c) => ch === COLOURS[id] && !taken.has(c));
    next[id] = cell;
    taken.add(cell);
  }
  return next;
}

export function Scene({ state, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  // Was the latest change a new move (a big leap) or an undo / restart (hop back quickly)?
  const track = useRef({ count: moveCount, reset: resetCount, forward: false, where: follow(START_CELLS, state.board) });
  if (track.current.count !== moveCount || track.current.reset !== resetCount) {
    track.current = {
      count: moveCount,
      reset: resetCount,
      forward: resetCount === track.current.reset && moveCount > track.current.count,
      where: follow(track.current.where, state.board),
    };
  }
  const { forward, where } = track.current;

  const over = status.kind !== 'playing';
  const won = status.kind === 'won' && !busy;
  const locked = busy || over;

  // The cricket the player has picked, when it has two toadstools to choose from.
  const [chosen, setChosen] = useState(-1);
  useEffect(() => setChosen(-1), [moveCount, resetCount]);
  const [nope, setNope] = useState({ cell: -1, n: 0 });

  const tap = (cell: number) => {
    if (locked) return;
    if (state.board[cell] === '.') {
      // An empty toadstool: leap there if the chosen cricket can.
      if (chosen >= 0 && freeLeaps(state, chosen).includes(cell)) play({ from: chosen, to: cell });
      else if (chosen >= 0) sfx.denied();
      return;
    }
    if (cell === chosen) {
      setChosen(-1);
      sfx.deselect();
      return;
    }
    const options = freeLeaps(state, cell);
    if (options.length === 0) {
      sfx.denied();
      setNope((p) => ({ cell, n: p.n + 1 }));
      setChosen(-1);
    } else if (options.length === 1) play({ from: cell, to: options[0] });
    else {
      setChosen(cell);
      sfx.select();
    }
  };

  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!won) return;
    setBurst((b) => b + 1);
    sfx.boing();
  }, [won]);

  const showHint = hint && !locked ? hint : null;
  const landing = chosen >= 0 && !locked ? freeLeaps(state, chosen) : [];

  return (
    <group>
      <Backdrop />
      <Patch party={won} />

      {Array.from({ length: CELLS }, (_, cell) => {
        if (cell === 4) return null;
        const [x, y, z] = capPos(cell);
        return (
          <group key={cell} position={[x, 0, z]}>
            <Clickable onClick={() => tap(cell)} disabled={locked} hoverScale={1}>
              {/* Tall enough to cover a cricket, but low enough not to catch taps meant for the row behind. */}
              <mesh position-y={state.board[cell] === '.' ? 0.4 : 0.6} visible={false}>
                <cylinderGeometry args={[0.68, 0.68, state.board[cell] === '.' ? 0.8 : 1.2, 10]} />
              </mesh>
            </Clickable>
            {landing.includes(cell) && !(showHint && showHint.to === cell) && <LandRing y={y + 0.012} />}
          </group>
        );
      })}

      {where.map((cell, id) => (
        <Cricket key={id} colour={COLOURS[id]} spot={capPos(cell)} slow={forward} chosen={chosen === cell && !locked} nope={nope.cell === cell ? nope.n : 0} happy={won} seed={id * 1.7} />
      ))}

      {showHint && <HintRing position={ring(showHint.from)} radius={0.62} />}
      {showHint && <HintRing position={ring(showHint.to)} radius={0.46} />}

      <Burst trigger={burst} position={[0, 1.6, 0]} />
    </group>
  );
}

const ring = (cell: number): Vec3 => [capPos(cell)[0], CAP_TOP + 0.015, capPos(cell)[2]];

/** A soft ring on each toadstool the chosen cricket can leap to. */
function LandRing({ y }: { y: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    (m.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(clock.elapsedTime * 5) * 0.25;
    m.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.06);
  });
  return (
    <mesh ref={ref} position-y={y} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.3, 0.44, 30]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.6} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
