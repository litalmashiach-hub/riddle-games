import type { SceneProps } from '@riddle/engine';
import { Sparkles } from '@react-three/drei';
import { Burst, sfx, type Vec3 } from '@riddle/fx';
import { Farmer, HintRing, RiverValley, Sheep, groundHeight } from '@riddle/props';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Jug } from './Jug';
import { Overlay, Pill } from './Overlay';
import { Pouring } from './Pouring';
import { DIMS, FILL_BASE, HOME, MOVE_MS, PIER_LIP_X, PIER_Y, PIER_Z, type Anim } from './layout';
import { canDo, CAPACITY, GOAL, JUGS, otherJug, type JugId, type Move, type State } from './rules';
import { Butterflies, Cobbles, GoalSign, Pump, RiverTarget, Well } from './Yard';

export { MOVE_MS };

const sameMove = (a: Move | null, b: Move | null) => !!a && !!b && a.kind === b.kind && a.jug === b.jug;

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** The jug the player has picked up (UI only, not a move). */
  const [selected, setSelected] = useState<JugId | null>(null);
  const [burst, setBurst] = useState(0);
  const [settled, setSettled] = useState(true);
  const won = status.kind === 'won';
  const over = status.kind !== 'playing';
  const locked = busy || over;

  // One shared clock for the jugs, the stream and the pump.
  const lastCount = useRef(moveCount);
  const idRef = useRef(0);
  const anim = useRef<Anim>({ id: 0, forward: false, move: null, prev: state, next: state, start: -1e9 });
  // Computed during render (so the very first frame of a move is right), once per move.
  // Keyed, so StrictMode's double render does not turn a move into a "no-op".
  const animKey = useRef('');
  const key = `${moveCount}|${resetCount}`;
  if (animKey.current !== key) {
    const forward = animKey.current !== '' && moveCount > lastCount.current && !!lastMove && !!previous;
    animKey.current = key;
    lastCount.current = moveCount;
    idRef.current += 1;
    anim.current = {
      id: idRef.current,
      forward,
      move: forward ? lastMove : null,
      prev: previous ?? state,
      next: state,
      start: performance.now(),
    };
  }

  useEffect(() => {
    setSelected(null);
    if (!anim.current.forward) return;
    setSettled(false);
    const t = setTimeout(() => setSettled(true), MOVE_MS);
    return () => clearTimeout(t);
  }, [moveCount, resetCount]);

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => setBurst((b) => b + 1), anim.current.forward ? MOVE_MS - 200 : 0);
    return () => clearTimeout(t);
  }, [won]);

  const winner: JugId | null = won ? (state.big === GOAL ? 'big' : 'small') : null;
  const celebrate = won && settled;

  const pick = (j: JugId) => {
    if (locked) return;
    if (selected === j) {
      sfx.deselect();
      setSelected(null);
      return;
    }
    if (selected && selected !== j) {
      // Tapping the other jug while one is held pours into it.
      act({ kind: 'pour', jug: selected });
      return;
    }
    sfx.select();
    setSelected(j);
  };
  const act = (m: Move) => {
    if (locked) return;
    if (!canDo(state, m)) {
      sfx.denied();
      return;
    }
    play(m);
  };
  const atPump = () => (selected ? act({ kind: 'fill', jug: selected }) : sfx.denied());
  const atRiver = () => (selected ? act({ kind: 'empty', jug: selected }) : sfx.denied());

  // Hint: first point at the jug to pick up, then at where it goes.
  let hintAt: { p: Vec3; r: number } | null = null;
  if (hint && !busy) {
    if (selected !== hint.jug) hintAt = { p: HOME[hint.jug], r: DIMS[hint.jug].r + 0.25 };
    else if (hint.kind === 'fill') hintAt = { p: FILL_BASE, r: 0.45 };
    else if (hint.kind === 'empty') hintAt = { p: [PIER_LIP_X + 0.3, PIER_Y, PIER_Z], r: 0.5 };
    else hintAt = { p: HOME[otherJug(hint.jug)], r: DIMS[otherJug(hint.jug)].r + 0.25 };
  }

  const farmerPos: Vec3 = [6.75, groundHeight(6.75, 0.55) + 0.05, 0.55];

  return (
    <group>
      <RiverValley />
      <Cobbles />
      <Well position={[6.55, 0.22, -1.85]} />
      <Pump anim={anim} onClick={atPump} disabled={locked} />
      <GoalSign position={[3.6, groundHeight(3.6, -2.0), -2.0]} rotation={0.3} />
      <RiverTarget onClick={atRiver} disabled={locked} />
      <Butterflies />
      <Pouring anim={anim} />

      {JUGS.map((j) => (
        <Jug
          key={j}
          id={j}
          anim={anim}
          state={state}
          selected={selected === j && !busy}
          glow={celebrate && winner === j}
          disabled={locked}
          onClick={() => pick(j)}
        />
      ))}

      {/* Shadow-catching rings where the jugs live. */}
      {JUGS.map((j) => (
        <mesh key={j} position={[HOME[j][0], HOME[j][1] + 0.004, HOME[j][2]]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[DIMS[j].r + 0.04, DIMS[j].r + 0.09, 40]} />
          <meshBasicMaterial color={j === 'small' ? '#3aa58d' : '#e07a5f'} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}

      {selected && !busy && !over && <ActionMenu jug={selected} state={state} hint={hint} onAct={act} />}
      {selected && !busy && <HintRing position={[HOME[selected][0], HOME[selected][1] + 0.02, HOME[selected][2]]} radius={DIMS[selected].r + 0.2} color="#7ee0b0" />}
      {hintAt && <HintRing position={[hintAt.p[0], hintAt.p[1] + 0.03, hintAt.p[2]]} radius={hintAt.r} />}

      <group position={farmerPos} rotation-y={-1.15}>
        <Farmer seated={false} mood={celebrate ? 'happy' : 'idle'} seed={2} />
      </group>
      <group position={[7.4, groundHeight(7.4, -0.6), -0.6]} rotation-y={-1.9}>
        <Sheep mood={celebrate ? 'happy' : 'idle'} seed={1} />
      </group>
      <group position={[7.6, groundHeight(7.6, 1.5), 1.5]} rotation-y={-2.6} scale={0.9}>
        <Sheep mood={celebrate ? 'happy' : 'idle'} seed={4} />
      </group>

      {celebrate && winner && (
        <>
          <Overlay position={[HOME[winner][0], HOME[winner][1] + DIMS[winner].h + 0.85, HOME[winner][2]]}>
            <Pill tone="gold">4 L! 🎉</Pill>
          </Overlay>
          <HintRing position={[HOME[winner][0], HOME[winner][1] + 0.03, HOME[winner][2]]} radius={DIMS[winner].r + 0.3} color="#ffd166" />
          <Sparkles count={40} scale={[1.2, 1.4, 1.2]} position={[HOME[winner][0], HOME[winner][1] + 0.6, HOME[winner][2]]} size={6} speed={0.8} color="#ffd166" />
        </>
      )}
      <Burst trigger={burst} position={[HOME.big[0] - 0.6, 1.4, HOME.big[2]]} />
    </group>
  );
}

const btn = (on: boolean, glow: boolean): CSSProperties => ({
  fontFamily: 'Fredoka, system-ui, sans-serif',
  fontWeight: 700,
  fontSize: 15,
  padding: '7px 13px',
  borderRadius: 999,
  border: glow ? '2px solid #fff3b0' : '2px solid rgba(255,255,255,.8)',
  background: !on ? 'rgba(229,231,235,.75)' : glow ? 'linear-gradient(#ffe08a,#f4b03e)' : 'linear-gradient(#ffffff,#dbeafe)',
  color: on ? '#1f2937' : '#9ca3af',
  boxShadow: on ? '0 3px 0 rgba(0,0,0,.2), 0 8px 16px rgba(0,0,0,.22)' : 'none',
  whiteSpace: 'nowrap',
  cursor: on ? 'pointer' : 'default',
  animation: glow ? 'jugs-pulse 1s ease-in-out infinite' : undefined,
});

/** Floating buttons above the held jug: fill, empty, pour. */
function ActionMenu({ jug, state, hint, onAct }: { jug: JugId; state: State; hint: Move | null; onAct(m: Move): void }) {
  const to = otherJug(jug);
  const items: { m: Move; label: string }[] = [
    { m: { kind: 'fill', jug }, label: '💧 Fill at pump' },
    { m: { kind: 'pour', jug }, label: `Pour into ${CAPACITY[to]} L ${to === 'big' ? '➜' : '⬅'}` },
    { m: { kind: 'empty', jug }, label: '🌊 Empty in river' },
  ];
  const home = HOME[jug];
  return (
    <Overlay position={[home[0], home[1] + DIMS[jug].h + 0.62, home[2]]} zIndex={6} interactive anchor="bottom">
      <style>{`@keyframes jugs-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}@keyframes jugs-pop{from{transform:scale(0)}to{transform:scale(1)}}`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', animation: 'jugs-pop .3s cubic-bezier(.34,1.56,.64,1)' }}>
        {items.map(({ m, label }) => {
          const on = canDo(state, m);
          return (
            <button key={m.kind} disabled={!on} style={btn(on, sameMove(hint, m))} onClick={() => onAct(m)}>
              {label}
            </button>
          );
        })}
      </div>
    </Overlay>
  );
}
