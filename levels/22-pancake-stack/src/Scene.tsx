import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, DizzyStars, Shake, sfx, tapPadRaycast, usePhases } from '@riddle/fx';
import { HintRing } from '@riddle/props';
import { useEffect, useRef, useState } from 'react';
import { Backdrop } from './Backdrop';
import { Chef, type ChefMood } from './Chef';
import { Kitchen } from './Kitchen';
import { BATTER_BOTTOM, BATTER_TOP, CHEF, CHEF_HAT, CRUST_LIFT, CRUST_THICK, SLOT, THICK, radiusOf, slotY } from './layout';
import { FLIP_MS, Stack, type StackGag } from './Stack';
import { PANCAKES, type Move, type State } from './rules';

/** Invisible tap padding (see tapPadRaycast in @riddle/fx): it lies behind every pancake's own shape. */
const slicePad = tapPadRaycast();

export const MOVE_MS = FLIP_MS + 120;
/** Beats of the toppling gag. */
const FAIL: ['wobble' | 'topple' | 'flopped', number][] = [
  ['wobble', 1100],
  ['topple', 800],
  ['flopped', 60000],
];
export const END_DELAY_MS = 1100 + 800 + 1000;

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  // Was the latest change a new move (flip with the spatula) or an undo / restart (slide back quickly)?
  const dir = useRef({ count: moveCount, reset: resetCount, forward: false });
  if (dir.current.count !== moveCount || dir.current.reset !== resetCount) {
    dir.current = { count: moveCount, reset: resetCount, forward: resetCount === dir.current.reset && moveCount > dir.current.count };
  }
  const forward = dir.current.forward && !!lastMove && !!previous;

  const over = status.kind !== 'playing';
  const won = status.kind === 'won' && !busy;
  const lost = status.kind === 'lost' && !busy;
  const fail = usePhases(lost, FAIL);
  const gag: StackGag = fail;

  // The chef swings his spatula; the stack lands with a soft thud.
  const [swing, setSwing] = useState(0);
  useEffect(() => {
    if (!forward) return;
    setSwing((s) => s + 1);
    sfx.hop();
    const t = setTimeout(() => sfx.poof(), FLIP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount, resetCount]);

  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!won) return;
    setBurst((b) => b + 1);
    sfx.boing();
  }, [won]);

  const [shake, setShake] = useState(0);
  useEffect(() => {
    if (fail === 'wobble') sfx.squeak();
    if (fail === 'topple') {
      sfx.boing();
      setShake((s) => s + 1);
    }
    if (fail === 'flopped') {
      sfx.poof();
      sfx.sadTrombone();
    }
  }, [fail]);

  const [nope, setNope] = useState(0);
  const locked = busy || over;
  const tap = (pos: number) => {
    if (locked) return;
    // The spatula goes under the tapped pancake: it flips with everything above it.
    if (pos === 0) {
      sfx.denied();
      setNope((n) => n + 1);
    } else play({ count: pos + 1 });
  };

  const hintCount = hint && !locked ? hint.count : 0;
  const mood: ChefMood = won ? 'happy' : fail === 'wobble' ? 'worried' : fail ? 'dizzy' : 'idle';

  return (
    <Shake trigger={shake} intensity={0.1}>
      <Backdrop />
      <Kitchen flips={state.flips} party={won} />
      <Stack stack={state.stack} before={forward ? previous!.stack : null} flip={forward ? { id: `${moveCount}|${resetCount}`, count: lastMove!.count } : null} hintCount={hintCount} gag={gag} party={won} />

      {/*
        One tap target per pancake: its own shape, so a tap picks exactly the pancake you see, and a slightly wider slice of padding.
        A small pancake squeezed between two bigger ones would be a thin sliver to hit, so its slice fills the whole gap.
      */}
      {state.stack.map((size, pos) => {
        const above = pos > 0 ? radiusOf(state.stack[pos - 1]) : 0;
        const below = pos < PANCAKES - 1 ? radiusOf(state.stack[pos + 1]) : Infinity;
        const own = radiusOf(size);
        const r = Math.max(own, Math.min(above, below)) + 0.06;
        return (
          <group key={pos} position={[0, slotY(pos), 0]}>
            <Clickable onClick={() => tap(pos)} disabled={locked} hoverScale={1}>
              {/* The pancake's own shape, unseen (the drawn one lives in Stack and turns over there): under the finger, the pancake you see is the one that is picked. */}
              <mesh visible={false} rotation-y={(size - 1) * 0.5}>
                <cylinderGeometry args={[own * BATTER_TOP, own * BATTER_BOTTOM, THICK, 18]} />
              </mesh>
              <mesh visible={false} position-y={CRUST_LIFT} rotation-y={(size - 1) * 0.5}>
                <cylinderGeometry args={[own, own, CRUST_THICK, 18]} />
              </mesh>
              {/* The wider slice is padding: it decides only where no pancake is under the finger. */}
              <mesh visible={false} raycast={slicePad}>
                <cylinderGeometry args={[r, r, SLOT, 14]} />
              </mesh>
            </Clickable>
          </group>
        );
      })}
      {hintCount > 0 && <HintRing position={[0, slotY(hintCount - 1) - SLOT / 2 + 0.02, 0]} radius={radiusOf(state.stack[hintCount - 1]) + 0.32} />}

      <group position={CHEF} scale={1.3}>
        <Chef mood={mood} swing={swing} nope={nope} />
      </group>
      {fail === 'flopped' && <DizzyStars position={[CHEF_HAT[0], CHEF_HAT[1] + 0.55, CHEF_HAT[2]]} radius={0.42} />}

      <Burst trigger={burst} position={[0, 3, 0]} />
    </Shake>
  );
}
