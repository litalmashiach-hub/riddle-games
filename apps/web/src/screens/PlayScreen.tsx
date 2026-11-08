import { createSession, starsFor, type RiddleLevel } from '@riddle/engine';
import { WORLDS, WorldStage, sfx, useSettings } from '@riddle/fx';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import * as THREE from 'three';
import { Button } from '../components/Button';
import { BulbIcon, HomeIcon, InfoIcon, RedoIcon, RestartIcon, SoundIcon, UndoIcon } from '../components/Icons';
import { Stars } from '../components/Stars';

interface Props {
  level: RiddleLevel;
  onExit(): void;
  onNext?: () => void;
  onSolved(stars: number): void;
}

export function PlayScreen({ level, onExit, onNext, onSolved }: Props) {
  const session = useMemo(() => createSession(level), [level]);
  // `?debug` exposes the session for automated play-tests: window.__riddle.getState().play(move)
  useEffect(() => {
    if (new URLSearchParams(location.search).has('debug')) (window as any).__riddle = session;
  }, [session]);
  const s = useStore(session);
  const state = s.history[s.history.length - 1];
  const previous = s.history.length > 1 ? s.history[s.history.length - 2] : null;
  const lastMove = s.moves.length ? s.moves[s.moves.length - 1] : null;
  const moveCount = s.moves.length;
  const [showRules, setShowRules] = useState(true);
  const [hintText, setHintText] = useState<string | null>(null);
  const { quality, sound, toggleSound, setQuality } = useSettings();
  const look = WORLDS[level.world];
  const stars = s.status.kind === 'won' ? starsFor(moveCount, level.bestMoves, s.hintsUsed) : 0;

  // End-of-level sounds and saving.
  useEffect(() => {
    if (!s.ended) return;
    if (s.status.kind === 'won') {
      sfx.win();
      onSolved(stars);
    } else if (s.status.kind === 'lost') sfx.lose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ended]);

  useEffect(() => {
    if (!hintText) return;
    const t = setTimeout(() => setHintText(null), 5000);
    return () => clearTimeout(t);
  }, [hintText]);

  // Keyboard: Z / Ctrl+Z undo, Y redo, R restart, H hint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'z') session.getState().undo();
      else if (k === 'y') session.getState().redo();
      else if (k === 'r') session.getState().restart();
      else if (k === 'h') setHintText(session.getState().askHint());
      else if (k === 'escape') setShowRules(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);

  const Scene = level.Scene;
  const cam = level.camera ?? { position: [0, 8, 12] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 42 };

  return (
    <div className="relative h-full w-full select-none overflow-hidden" style={{ background: look.fog }}>
      <Canvas
        shadows
        flat
        dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: cam.position, fov: cam.fov ?? 42, near: 0.1, far: 500 }}
      >
        <Suspense fallback={null}>
          <WorldStage world={level.world}>
            <Scene
              state={state}
              previous={previous}
              lastMove={lastMove}
              status={s.status}
              play={s.play}
              busy={s.busy || showRules}
              hint={s.hint}
              resetCount={s.resetCount}
              moveCount={moveCount}
            />
          </WorldStage>
          <CameraRig position={cam.position} target={cam.target} />
        </Suspense>
      </Canvas>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Button onClick={onExit} aria-label="Back to levels" className="!px-3">
            <HomeIcon />
          </Button>
          <div className="glass hidden rounded-2xl px-4 py-1.5 sm:block">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/75">Level {level.number} · {look.name}</div>
            <div className="font-display text-lg font-semibold leading-tight">{level.title}</div>
          </div>
        </div>
        <div className="glass pointer-events-auto rounded-2xl px-4 py-1.5 text-center">
          <div className="font-display text-2xl font-bold leading-none tabular-nums">{moveCount}</div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/75">{level.moveNoun} · best {level.bestMoves}</div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Button onClick={() => setQuality(quality === 'high' ? 'low' : 'high')} className="!px-3 text-xs" aria-label="Graphics quality">
            {quality === 'high' ? 'HD' : 'SD'}
          </Button>
          <Button onClick={toggleSound} className="!px-3" aria-label={sound ? 'Mute' : 'Unmute'}>
            <SoundIcon on={sound} />
          </Button>
          <Button onClick={() => setShowRules(true)} className="!px-3" aria-label="Rules">
            <InfoIcon />
          </Button>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="glass pointer-events-auto flex gap-2 rounded-3xl p-2">
          <Button onClick={s.undo} disabled={moveCount === 0} aria-label="Undo"><UndoIcon /><span className="hidden sm:inline">Undo</span></Button>
          <Button onClick={s.redo} disabled={s.future.length === 0} aria-label="Redo"><RedoIcon /></Button>
          <Button onClick={s.restart} disabled={moveCount === 0 && s.future.length === 0} aria-label="Restart"><RestartIcon /><span className="hidden sm:inline">Restart</span></Button>
          <Button tone="gold" onClick={() => setHintText(s.askHint())} disabled={s.status.kind !== 'playing' || s.busy} aria-label="Hint"><BulbIcon /><span className="hidden sm:inline">Hint</span></Button>
        </div>
      </div>

      {/* Hint toast */}
      <AnimatePresence>
        {hintText && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
            <div className="rounded-2xl bg-amber-300 px-5 py-3 font-display text-lg font-semibold text-amber-950 shadow-xl">💡 {hintText}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules */}
      <AnimatePresence>
        {showRules && (
          <Modal key="rules">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: look.accent }}>Level {level.number} · {look.name}</div>
            <h2 className="mt-1 font-display text-3xl font-bold">{level.title}</h2>
            <ul className="mt-4 space-y-2 text-left">
              {level.instructions.map((t, i) => (
                <li key={i} className="flex gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold">{i + 1}</span><span>{t}</span></li>
              ))}
            </ul>
            <div className="mt-4 rounded-2xl bg-black/20 p-3 text-left text-sm text-white/85">
              {level.controls.map((t, i) => (<p key={i}>{t}</p>))}
            </div>
            <p className="mt-3 text-sm text-white/75">Solve it in {level.bestMoves} {level.moveNoun} for three stars.</p>
            <Button tone="gold" className="mt-5 w-full !py-3 text-lg" onClick={() => setShowRules(false)}>Let's go!</Button>
          </Modal>
        )}

        {s.ended && s.status.kind === 'won' && (
          <Modal key="won">
            <div className="text-6xl">🎉</div>
            <h2 className="mt-2 font-display text-4xl font-bold">Solved!</h2>
            <div className="mt-3 flex justify-center"><Stars count={stars} size={52} animate /></div>
            <p className="mt-3 text-white/85">
              {moveCount} {level.moveNoun}{s.hintsUsed ? ` · ${s.hintsUsed} hint${s.hintsUsed > 1 ? 's' : ''}` : ''}. {stars === 3 ? 'Perfect, that is the shortest solution!' : `The best is ${level.bestMoves}. Can you do it?`}
            </p>
            <div className="mt-5 grid gap-2">
              {onNext && <Button tone="gold" className="!py-3 text-lg" onClick={onNext}>Next level</Button>}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={s.restart}>Play again</Button>
                <Button onClick={onExit}>All levels</Button>
              </div>
            </div>
          </Modal>
        )}

        {s.ended && s.status.kind === 'lost' && (
          <Modal key="lost" tone="red">
            <div className="text-6xl">😱</div>
            <h2 className="mt-2 font-display text-4xl font-bold">Oh no!</h2>
            <p className="mt-3 text-lg text-white/90">{s.status.reason}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button tone="gold" onClick={s.undo}><UndoIcon />Undo</Button>
              <Button onClick={s.restart}><RestartIcon />Restart</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ children, tone }: { children: React.ReactNode; tone?: 'red' }) {
  return (
    <motion.div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/35 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className={`glass w-full max-w-md rounded-[2rem] p-6 text-center ${tone === 'red' ? '!bg-rose-900/40' : ''}`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Orbit within a small range around the target, with a short fly-in on start. */
function CameraRig({ position, target }: { position: [number, number, number]; target: [number, number, number] }) {
  const controls = useRef<any>(null);
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const start = useRef(performance.now());
  const end = useMemo(() => new THREE.Vector3(...position), [position]);
  const from = useMemo(() => end.clone().multiplyScalar(1.7).add(new THREE.Vector3(6, 4, 0)), [end]);

  // Pull back on tall, narrow screens so the whole diorama fits.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    cam.zoom = aspect < 1 ? Math.max(0.55, aspect * 0.95) : 1;
    cam.updateProjectionMatrix();
  }, [camera, size]);

  useFrame(() => {
    const t = Math.min((performance.now() - start.current) / 2200, 1);
    if (t < 1) {
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(from, end, e);
      controls.current?.target.set(...target);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      target={target}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={end.length() * 0.6}
      maxDistance={end.length() * 1.4}
      minPolarAngle={0.35}
      maxPolarAngle={1.25}
      minAzimuthAngle={-0.7}
      maxAzimuthAngle={0.7}
    />
  );
}
