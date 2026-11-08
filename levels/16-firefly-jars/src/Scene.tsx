import type { SceneProps } from '@riddle/engine';
import { Burst, ComicWord, DizzyStars, FightCloud, FocusCam, Shake, sfx, usePhases, type Vec3 } from '@riddle/fx';
import { HintRing } from '@riddle/props';
import { useEffect, useRef, useState } from 'react';
import { Fireflies, type Phase } from './Fireflies';
import { Frog } from './Frog';
import { JarRow, Raft } from './Jars';
import { Lagoon } from './Lagoon';
import { EMOJI, GLOW, HOVER_Y, JAR_COUNT, JAR_POS, JAR_R, MOVE_MS } from './layout';
import { Overlay, Pill } from './Overlay';
import { CAPACITY, PATIENCE, canMove, type Color, type Move, type State } from './rules';
import { flySound, grumbleSound, jarDoneSound, landSound, liftSound, swarmSound } from './audio';

export { MOVE_MS };

type FailPhase = 'windup' | 'fight' | 'flee' | 'after';
const FAIL_PHASES: [FailPhase, number][] = [
  ['windup', 900],
  ['fight', 1700],
  ['flee', 700],
  ['after', 60000],
];
/** Total fail scene before the "Oh no!" screen (index.ts uses it). */
export const FAIL_MS = 900 + 1700 + 700 + 1300;

const SWARM: Vec3 = [0, 3.5, 0.4];
const FROG_POS: Vec3 = [4.0, 0.52, 0.8];

export function Scene({ state, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  /** The jar whose top firefly is lifted out (UI only, not a move). */
  const [selected, setSelected] = useState<number | null>(null);
  const [nope, setNope] = useState<{ n: number; jar: number; text: string }>({ n: 0, jar: 0, text: '' });
  const [frogHop, setFrogHop] = useState(0);
  const [shake, setShake] = useState(0);
  const [burst, setBurst] = useState(0);
  const [done, setDone] = useState<{ n: number; jar: number; color: Color }>({ n: 0, jar: 0, color: 'gold' });
  const [settled, setSettled] = useState(true);
  const won = status.kind === 'won';
  const over = status.kind !== 'playing';
  const locked = busy || over;

  // Forward move, or undo / restart (those fly back quickly)?
  const lastCount = useRef(moveCount);
  const lastReset = useRef(resetCount);
  const quick = moveCount < lastCount.current || resetCount !== lastReset.current;
  useEffect(() => {
    lastCount.current = moveCount;
    lastReset.current = resetCount;
  });

  useEffect(() => {
    setSelected(null);
    setSettled(false);
    const t = setTimeout(() => setSettled(true), MOVE_MS);
    return () => clearTimeout(t);
  }, [moveCount, resetCount]);

  useEffect(() => {
    if (!won) return;
    const t = setTimeout(() => {
      setBurst((b) => b + 1);
      sfx.win();
    }, MOVE_MS - 150);
    return () => clearTimeout(t);
  }, [won]);

  // The fail scene: the fireflies huff, swarm into a squabbling cloud, then storm off.
  const fail = usePhases<FailPhase>(status.kind === 'lost' && !busy, FAIL_PHASES);
  useEffect(() => {
    if (fail === 'windup') grumbleSound();
    if (fail === 'fight') {
      swarmSound(2300);
      sfx.scuffle();
      setShake((n) => n + 1);
    }
    if (fail === 'flee') sfx.poof();
    if (fail === 'after') sfx.sadTrombone();
  }, [fail]);

  const celebrate = won && settled;
  const phase: Phase = fail === 'fight' || fail === 'flee' || fail === 'after' ? 'lost' : celebrate ? 'won' : 'play';
  const grump = won ? 0 : fail ? 1 : Math.min(1, state.moves / PATIENCE);
  const left = PATIENCE - state.moves;

  const refuse = (jar: number, text: string) => {
    sfx.denied();
    setNope((n) => ({ n: n.n + 1, jar, text }));
  };

  const tapJar = (j: number) => {
    if (locked) return;
    if (selected === null) {
      if (state.jars[j].length === 0) return refuse(j, 'Empty jar!');
      liftSound();
      setSelected(j);
      return;
    }
    if (selected === j) {
      sfx.deselect();
      setSelected(null);
      return;
    }
    const m = { from: selected, to: j };
    if (!canMove(state, m)) {
      const full = state.jars[j].length >= CAPACITY;
      grumbleSound();
      return refuse(j, full ? 'Jar is full!' : 'Same colours only!');
    }
    flySound();
    play(m);
  };

  // Clear the "nope" bubble after a moment.
  const [showNope, setShowNope] = useState(false);
  useEffect(() => {
    if (nope.n === 0) return;
    setShowNope(true);
    const t = setTimeout(() => setShowNope(false), 1100);
    return () => clearTimeout(t);
  }, [nope.n]);

  // Where may the lifted firefly go?
  const targets = Array.from({ length: JAR_COUNT }, (_, j) => (selected === null || selected === j || locked ? null : canMove(state, { from: selected, to: j })));

  // Hint: ring the jar to lift from, then the jar to drop on.
  let hintJar: number | null = null;
  if (hint && !busy && !over) hintJar = selected === hint.from ? hint.to : hint.from;

  const jp = (j: number, dy = 0): Vec3 => [JAR_POS[j][0], JAR_POS[j][1] + dy, JAR_POS[j][2]];

  return (
    <Shake trigger={shake} intensity={0.14} durationMs={600}>
      <group>
        <Lagoon />
        <Raft />
        <JarRow jars={state.jars} selected={selected} targets={targets} disabled={locked} won={celebrate} onJar={tapJar} />
        <Fireflies
          jars={state.jars}
          selected={busy ? null : selected}
          grump={grump}
          phase={phase}
          shake={nope.n}
          quick={quick}
          onLand={(_, c) => landSound(c)}
          onComplete={(jar, color) => {
            jarDoneSound(color);
            setFrogHop((n) => n + 1);
            setDone((d) => ({ n: d.n + 1, jar, color }));
          }}
        />

        <group position={FROG_POS} rotation-y={-0.5}>
          <group>
            <Frog mood={celebrate ? 'happy' : fail === 'after' ? 'dizzy' : 'idle'} hop={frogHop} nope={nope.n} />
          </group>
        </group>
        {fail === 'after' && <DizzyStars position={[FROG_POS[0], FROG_POS[1] + 0.95, FROG_POS[2]]} />}

        {hintJar !== null && <HintRing position={jp(hintJar, 0.03)} radius={JAR_R + 0.3} />}

        {/* Patience meter: the fireflies get grumpier with every move. */}
        {!over && (
          <Overlay position={[0, 0.2, 1.75]} shrink>
            <PatienceMeter left={left} />
          </Overlay>
        )}

        {showNope && !over && (
          <Overlay key={nope.n} position={jp(nope.jar, 2.75)}>
            <Pill tone="red">{nope.text}</Pill>
          </Overlay>
        )}

        {done.n > 0 && !over && <JarDonePop key={done.n} jar={done.jar} color={done.color} />}
        <Burst trigger={done.n} position={jp(done.jar, 1.4)} count={70} colors={[GLOW[done.color], '#ffffff', '#fff3b0']} power={0.55} size={0.7} />

        {/* Fail scene */}
        <FocusCam target={fail === 'after' ? [2.2, 1.3, 0.6] : [SWARM[0], SWARM[1] - 0.9, SWARM[2]]} active={fail != null} closer={0.8} />
        {fail === 'windup' && <ComicWord position={[0, HOVER_Y + 0.9, 0.3]} text="HMPH!" color="#ff8fab" size={40} tilt={-6} />}
        <FightCloud position={SWARM} active={fail === 'fight'} scale={1.1} color="#e9e6ff" limbColors={['#ffc53d', '#ff5fa8', '#4dff9a', '#46c8ff']} />
        {fail === 'fight' && <ComicWord position={[SWARM[0] - 1.6, SWARM[1] + 1.1, SWARM[2]]} text="BZZZT!" />}
        {fail === 'flee' && <ComicWord position={[SWARM[0] + 2.2, SWARM[1] + 0.8, SWARM[2]]} text="We quit!" color="#9fe7ff" size={36} tilt={8} />}
        {fail === 'after' && <ComicWord position={[FROG_POS[0] - 1.1, FROG_POS[1] + 1.7, FROG_POS[2]]} text="Oops!" color="#ff8fab" size={36} tilt={6} />}

        {celebrate && (
          <Overlay position={[0, 0.2, 1.75]}>
            <Pill tone="gold">All sorted! ✨</Pill>
          </Overlay>
        )}
        <Burst trigger={burst} position={[0, 2.6, 0.2]} />
      </group>
    </Shake>
  );
}

function JarDonePop({ jar, color }: { jar: number; color: Color }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 1400);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  const [x, y, z] = JAR_POS[jar];
  return (
    <Overlay position={[x, y + 2.75, z]}>
      <Pill tone="gold">{EMOJI[color]} Full jar!</Pill>
    </Overlay>
  );
}

function PatienceMeter({ left }: { left: number }) {
  const k = Math.max(0, left) / PATIENCE;
  const face = k > 0.66 ? '😊' : k > 0.4 ? '😐' : k > 0.2 ? '😠' : '😡';
  const color = k > 0.66 ? '#6ee7a8' : k > 0.4 ? '#ffd166' : k > 0.2 ? '#ff9f5a' : '#ff5c7a';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px 5px 8px',
        borderRadius: 999,
        background: 'rgba(20,18,48,.62)',
        border: '2px solid rgba(255,255,255,.35)',
        boxShadow: '0 6px 18px rgba(0,0,0,.35)',
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontWeight: 700,
        color: '#fff',
        fontSize: 15,
        whiteSpace: 'nowrap',
        animation: k <= 0.2 ? 'ff-wobble .5s ease-in-out infinite' : undefined,
      }}
    >
      <style>{`@keyframes ff-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}`}</style>
      <span style={{ fontSize: 22 }}>{face}</span>
      <span>Firefly patience</span>
      <span style={{ width: 92, height: 10, borderRadius: 99, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${k * 100}%`, background: color, borderRadius: 99, transition: 'width .4s, background .4s', boxShadow: `0 0 10px ${color}` }} />
      </span>
      <span style={{ minWidth: 20, textAlign: 'right' }}>{Math.max(0, left)}</span>
    </div>
  );
}
