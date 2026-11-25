import { createSession, guideStepFor, starsFor, type RiddleLevel } from '@riddle/engine';
import { WORLDS, WorldStage, sfx, useSettings } from '@riddle/fx';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import * as THREE from 'three';
import { sceneTaps, watchMoves } from '../haptics';
import { hasTestFlag } from '../appShell';
import { Button } from '../components/Button';
import { GuideOverlay, GuideTracker } from '../components/FirstPlayGuide';
import { SceneGuard, sceneWaitMs } from '../components/SceneGuard';
import { BulbIcon, HomeIcon, InfoIcon, RedoIcon, RestartIcon, SoundIcon, UndoIcon } from '../components/Icons';
import { Stars } from '../components/Stars';
import { hintLine, hintOutlived, winLine } from '../hint';

/** Tablets have very sharp screens; 1.5x looks the same to the eye and runs much smoother. */
const TOUCH = typeof window !== 'undefined' && navigator.maxTouchPoints > 0;

interface Props {
  level: RiddleLevel;
  onExit(): void;
  onNext?: () => void;
  onSolved(stars: number): void;
  /** True once this level's first-play guide has been shown on this device. */
  guideSeen?: boolean;
  /** Called the moment the first-play guide shows, so it is never shown again. */
  onGuideSeen?: () => void;
}

export function PlayScreen({ level, onExit, onNext, onSolved, guideSeen = false, onGuideSeen }: Props) {
  const session = useMemo(() => createSession(level), [level]);
  // `?debug` exposes the session for automated play-tests: window.__riddle.getState().play(move)
  useEffect(() => {
    if (hasTestFlag('debug')) (window as any).__riddle = session;
  }, [session]);
  // The app's touch response for each move (nothing on the website).
  useEffect(() => watchMoves(session), [session]);
  const s = useStore(session);
  const state = s.history[s.history.length - 1];
  const previous = s.history.length > 1 ? s.history[s.history.length - 2] : null;
  const lastMove = s.moves.length ? s.moves[s.moves.length - 1] : null;
  const moveCount = s.moves.length;
  const [showRules, setShowRules] = useState(true);
  // False until the scene has drawn its first frames; a curtain in the world's colours covers the wait.
  const [sceneReady, setSceneReady] = useState(false);
  // True when the scene's first drawing has taken longer than its wait: the guard then says so, over the curtain.
  const [sceneStuck, setSceneStuck] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const { quality, sound, toggleSound, setQuality } = useSettings();
  const look = WORLDS[level.world];
  const stars = s.status.kind === 'won' ? starsFor(moveCount, level.bestMoves, s.hintsUsed) : 0;

  // First-play guide: only on a level that has one, only if it was never shown here, and only until the first
  // move, a skip, or leaving the level. Decided once, on opening, so marking it seen does not take it away.
  const [guideOn, setGuideOn] = useState(() => !!level.guide && !guideSeen);
  const [picked, setPicked] = useState<string | null>(null);
  const guideRing = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (moveCount > 0) setGuideOn(false);
  }, [moveCount]);

  // End-of-level sounds and saving.
  useEffect(() => {
    if (!s.ended) return;
    if (s.status.kind === 'won') {
      sfx.win();
      onSolved(stars);
    } else if (s.status.kind === 'lost') sfx.lose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ended]);

  // Upright phones show the whole scene but small: suggest turning sideways, once per visit.
  const [rotateTip, setRotateTip] = useState(false);
  useEffect(() => {
    if (showRules || !window.matchMedia('(orientation: portrait) and (max-width: 600px)').matches) return;
    try {
      if (sessionStorage.getItem('riddle-rotate-tip')) return;
      sessionStorage.setItem('riddle-rotate-tip', '1');
    } catch {
      /* private mode: show it anyway */
    }
    setRotateTip(true);
    const t = setTimeout(() => setRotateTip(false), 4500);
    return () => clearTimeout(t);
  }, [showRules]);

  useEffect(() => {
    if (!hintText) return;
    const t = setTimeout(() => setHintText(null), 5000);
    return () => clearTimeout(t);
  }, [hintText]);
  // The hint leaves with the position it spoke of, and when a win or loss card comes.
  useEffect(() => session.subscribe((now, before) => { if (hintOutlived(before, now)) setHintText(null); }), [session]);

  // Keyboard: Z / Ctrl+Z undo, Y redo, R restart, H hint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'z') session.getState().undo();
      else if (k === 'y') session.getState().redo();
      else if (k === 'r') session.getState().restart();
      else if (k === 'h') setHintText(hintLine(session.getState()));
      else if (k === 'escape') setShowRules(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session]);

  // The HUD steps aside while a card (rules, win or lose) is up: the card has every button the player needs.
  const cardOpen = showRules || (s.ended && s.status.kind !== 'playing');

  const guideStep = guideOn && level.guide && !cardOpen && sceneReady && !rotateTip && !s.busy && moveCount === 0 ? level.guide.steps[guideStepFor(level.guide, picked)] : null;
  const guideShown = guideStep != null;
  useEffect(() => {
    if (guideShown) onGuideSeen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideShown]);

  const Scene = level.Scene;
  const cam: NonNullable<RiddleLevel['camera']> = level.camera ?? { position: [0, 8, 12], target: [0, 0, 0], fov: 42 };

  return (
    <div className="relative h-full w-full select-none overflow-hidden" style={{ background: look.fog }}>
      {/* Never a blank level: a scene that can't be drawn, or loses its 3D context, says so and offers two ways out. */}
      <SceneGuard onExit={onExit} onRetry={() => { setSceneReady(false); setSceneStuck(false); }} stuck={sceneStuck && !sceneReady}>
      <Canvas
        shadows
        flat
        dpr={quality === 'high' ? [1, TOUCH ? 1.5 : 2] : [1, 1.25]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: cam.position, fov: cam.fov ?? 42, near: 0.1, far: 500 }}
        {...sceneTaps}
      >
        <Suspense fallback={null}>
          <WorldStage world={level.world}>
            <Scene
              state={state}
              previous={previous}
              lastMove={lastMove}
              status={s.status}
              play={s.play}
              // Nothing in the scene takes a tap before it can be seen: not behind the rules card, not behind the loading curtain.
              busy={s.busy || showRules || !sceneReady}
              hint={s.hint}
              resetCount={s.resetCount}
              moveCount={moveCount}
              onPick={setPicked}
            />
          </WorldStage>
          <CameraRig position={cam.position} target={cam.target} fitAspect={cam.fitAspect} />
          {guideStep && <GuideTracker step={guideStep} ring={guideRing} />}
          <FirstFrames onReady={() => setSceneReady(true)} onStuck={() => setSceneStuck(true)} />
        </Suspense>
      </Canvas>
      </SceneGuard>

      {/* Curtain while the scene builds */}
      <AnimatePresence>
        {!sceneReady && <LoadingCurtain key="curtain" gradient={look.uiGradient} number={level.number} quiet={showRules} />}
      </AnimatePresence>

      {/* First-play guide: rings the first thing to tap. It takes no taps itself, bar its Skip button. */}
      <AnimatePresence>
        {guideStep && <GuideOverlay key="guide" step={guideStep} ring={guideRing} onSkip={() => setGuideOn(false)} />}
      </AnimatePresence>

      {/* Top bar. Sideways on a phone the counter moves beside the home button, so the top middle stays free for a level's own labels. */}
      <div className={`safe-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 transition-opacity duration-300 sm:p-4 short:justify-start short:pt-2 ${cardOpen ? 'invisible opacity-0' : ''}`}>
        <div className="pointer-events-auto flex items-center gap-2">
          <Button onClick={onExit} aria-label="Back to levels" className="!px-3">
            <HomeIcon />
          </Button>
          <div className="glass hidden rounded-2xl px-4 py-1.5 sm:block short:hidden">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/75">Level {level.number} · {look.name}</div>
            <div className="font-display text-lg font-semibold leading-tight">{level.title}</div>
          </div>
        </div>
        <div className="glass pointer-events-auto rounded-2xl px-4 py-1.5 text-center short:flex short:h-[2.75rem] short:items-baseline short:gap-2 short:px-3.5 short:py-0 short:leading-[2.75rem]">
          <div className="font-display text-2xl font-bold leading-none tabular-nums short:leading-[inherit]">{moveCount}</div>
          <div className="whitespace-nowrap text-[11px] font-bold uppercase tracking-widest text-white/75 short:leading-[inherit]"><span className="hidden sm:inline">{level.moveNoun} · </span>best {level.bestMoves}</div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 short:ml-auto">
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

      {/* Bottom controls. Sideways on a phone they sit in the two bottom corners, under the thumbs, and leave the scene's lower edge clear. */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-300 short:justify-between short:pb-[max(0.5rem,env(safe-area-inset-bottom))] short:pl-[max(0.75rem,env(safe-area-inset-left))] short:pr-[max(0.75rem,env(safe-area-inset-right))] ${cardOpen ? 'invisible opacity-0' : ''}`}>
        <div className="glass pointer-events-auto flex gap-2 rounded-3xl p-2 short:flex-col short:gap-1.5 short:p-1.5">
          <Button onClick={s.undo} disabled={moveCount === 0} aria-label="Undo" className="short:!px-3"><UndoIcon /><span className="hidden sm:inline short:hidden">Undo</span></Button>
          <Button onClick={s.redo} disabled={s.future.length === 0} aria-label="Redo" className="short:!px-3"><RedoIcon /></Button>
          <Button onClick={s.restart} disabled={moveCount === 0 && s.future.length === 0} aria-label="Restart" className="short:!px-3"><RestartIcon /><span className="hidden sm:inline short:hidden">Restart</span></Button>
          <Button tone="gold" className="short:hidden" onClick={() => setHintText(hintLine(s))} disabled={s.status.kind !== 'playing' || s.busy} aria-label="Hint"><BulbIcon /><span className="hidden sm:inline">Hint</span></Button>
        </div>
        <div className="pointer-events-auto hidden short:block">
          <Button tone="gold" className="!rounded-3xl !px-4 !py-3.5" onClick={() => setHintText(hintLine(s))} disabled={s.status.kind !== 'playing' || s.busy} aria-label="Hint"><BulbIcon />Hint</Button>
        </div>
      </div>

      {/* Hint toast */}
      <AnimatePresence>
        {hintText && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="pointer-events-none absolute inset-x-0 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.25rem)] z-10 flex justify-center px-4 short:bottom-[max(0.75rem,env(safe-area-inset-bottom))] short:px-28">
            <div className="rounded-2xl bg-amber-300 px-5 py-2 font-display text-lg font-semibold text-amber-950 shadow-xl max-sm:text-base max-sm:leading-snug short:px-4 short:py-2 short:text-base">💡 {hintText}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn-your-phone tip */}
      <AnimatePresence>
        {rotateTip && (
          <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+5rem)] flex justify-center px-4">
            <div className="glass rounded-2xl px-4 py-2 text-center font-display text-base font-semibold">📱↻ Turn your phone sideways for a bigger view</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules */}
      <AnimatePresence>
        {showRules && (
          <Modal
            key="rules"
            wide
            aside={
              <>
                <div className="rounded-2xl bg-black/25 p-3 text-left text-sm text-white/90">
                  {level.controls.map((t, i) => (<p key={i}>{t}</p>))}
                </div>
                <p className="mt-3 text-sm text-white/75">Solve it in {level.bestMoves} {level.moveNoun} for three stars.</p>
                <Button tone="gold" className="mt-4 w-full !py-3 text-lg short:mt-3" onClick={() => setShowRules(false)}>Let's go!</Button>
                <div className={`mt-2 flex h-4 items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60 transition-opacity duration-500 ${sceneReady ? 'opacity-0' : ''}`} aria-hidden={sceneReady}>
                  <LoadingDots />
                  Setting the scene
                </div>
              </>
            }
          >
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: look.accent }}>Level {level.number} · {look.name}</div>
            <h2 className="mt-1 font-display text-3xl font-bold short:text-2xl">{level.title}</h2>
            <ul className="mt-4 space-y-2 text-left short:mt-3 short:space-y-1.5 short:text-[15px] short:leading-snug">
              {level.instructions.map((t, i) => (
                <li key={i} className="flex gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold short:mt-0">{i + 1}</span><span>{t}</span></li>
              ))}
            </ul>
          </Modal>
        )}

        {s.ended && s.status.kind === 'won' && (
          <Modal key="won">
            <h2 className="font-display text-4xl font-bold short:text-3xl"><span className="block text-6xl short:mr-2 short:inline short:text-3xl">🎉</span>Solved!</h2>
            <div className="mt-3 flex justify-center short:mt-2"><Stars count={stars} size={48} animate /></div>
            <p className="mt-3 text-white/85 short:mt-2">
              {moveCount} {level.moveNoun}{s.hintsUsed ? ` · ${s.hintsUsed} hint${s.hintsUsed > 1 ? 's' : ''}` : ''}. {winLine(moveCount, level.bestMoves, s.hintsUsed)}
            </p>
            <div className="mt-5 grid gap-2 short:mt-3">
              {onNext && <Button tone="gold" className="!py-3 text-lg short:!py-2.5" onClick={onNext}>Next level</Button>}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={s.restart}>Play again</Button>
                <Button onClick={onExit}>All levels</Button>
              </div>
            </div>
          </Modal>
        )}

        {s.ended && s.status.kind === 'lost' && (
          <Modal key="lost" tone="red">
            <h2 className="font-display text-4xl font-bold short:text-3xl"><span className="block text-6xl short:mr-2 short:inline short:text-3xl">😱</span>Oh no!</h2>
            <p className="mt-3 text-lg text-white/90 short:mt-2 short:text-base">{s.status.reason}</p>
            <div className="mt-5 grid grid-cols-2 gap-2 short:mt-4">
              <Button tone="gold" onClick={s.undo}><UndoIcon />Undo</Button>
              <Button onClick={s.restart}><RestartIcon />Restart</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A card over the scene. It never grows past the screen: the body scrolls inside the card when it must,
 * and `aside` (the buttons) stays in view. On a phone held sideways a `wide` card puts `aside` in a second column.
 */
function Modal({ children, aside, tone, wide }: { children: React.ReactNode; aside?: React.ReactNode; tone?: 'red'; wide?: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className={`panel flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-[2rem] text-center ${wide ? 'short:max-w-3xl short:flex-row' : ''} ${tone === 'red' ? 'panel-red' : ''}`}
      >
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 short:p-4 ${aside ? 'pb-3 sm:pb-3' : ''} ${wide ? 'short:pb-4 short:text-left' : ''}`}>{children}</div>
        {aside && (
          <div className={`shrink-0 px-5 pb-5 sm:px-6 sm:pb-6 ${wide ? 'short:flex short:w-[42%] short:flex-col short:justify-center short:overflow-y-auto short:border-l short:border-white/10 short:bg-black/15 short:p-4' : ''}`}>{aside}</div>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Tells the shell once the scene can really be seen. The renderer compiles its shaders in the background and
 * skips what is not ready yet, so the first frames are empty: wait for the compile, then for two drawn frames.
 * The curtain is never lifted from a scene that is not drawn. After a long wait `onStuck` is called instead,
 * and the shell's card offers a new try or the map; a scene that is drawn later after all is still reported.
 */
function FirstFrames({ onReady, onStuck }: { onReady(): void; onStuck(): void }) {
  const gl = useThree((st) => st.gl);
  const scene = useThree((st) => st.scene);
  const camera = useThree((st) => st.camera);
  const frames = useRef(-1);
  const done = useRef(false);
  const finish = useRef(onReady);
  finish.current = onReady;
  const stuck = useRef(onStuck);
  stuck.current = onStuck;
  useEffect(() => {
    const arm = () => {
      if (frames.current < 0) frames.current = 0;
    };
    // One frame first, so everything the scene mounts in its effects is in the graph.
    const raf = requestAnimationFrame(() => gl.compileAsync(scene, camera).then(arm, arm));
    const giveUp = setTimeout(() => done.current || stuck.current(), sceneWaitMs());
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(giveUp);
    };
  }, [gl, scene, camera]);
  useFrame(() => {
    if (done.current || frames.current < 0) return;
    if (++frames.current > 2) {
      done.current = true;
      finish.current();
    }
  });
  return null;
}

const LoadingDots = () => (
  <span className="loading-dots" aria-hidden>
    <i /><i /><i />
  </span>
);

/** Covers the canvas in the world's colours until the scene is ready, then fades away. */
function LoadingCurtain({ gradient, number, quiet }: { gradient: string; number: number; quiet: boolean }) {
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" style={{ background: gradient }} initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} role="status" aria-label="Loading level">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(255_255_255/0.3),transparent_60%)]" />
      <div className="absolute -bottom-[0.18em] right-[4%] font-display text-[min(70vh,24rem)] font-bold leading-none text-white/15">{number}</div>
      {/* The rules card carries its own small indicator; without the card, show one here. */}
      {!quiet && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-3 font-display text-lg font-semibold text-white/90"><LoadingDots />Setting the scene</div>
        </div>
      )}
    </motion.div>
  );
}

/** Most dioramas are framed for a landscape screen about this wide. Narrower screens pull back to keep all of it. */
const DESIGN_ASPECT = 1.7;

/**
 * How to frame the scene on this screen: `zoom` widens the lens a little, `pull` moves the camera back for the rest.
 * Together they keep the full width of the designed view visible on phones held upright.
 */
export function fitFor(width: number, height: number, designAspect = DESIGN_ASPECT) {
  const aspect = width / Math.max(height, 1);
  const need = Math.max(1, designAspect / aspect);
  const zoom = Math.max(1 / need, 0.62);
  // Short landscape phones lose a lot of height to the top and bottom buttons.
  const short = aspect > 1 && height < 480 ? 1.08 : 1;
  // Upright phones look down a little more steeply, so the tall screen is filled with the scene, not foreground.
  const tilt = Math.min(0.22, (need - 1) * 0.12);
  return { zoom, pull: need * zoom * short, tilt };
}

/** Orbit within a small range around the target, with a short fly-in on start. Refits when the screen turns. */
function CameraRig({ position, target, fitAspect }: { position: [number, number, number]; target: [number, number, number]; fitAspect?: number }) {
  const controls = useRef<any>(null);
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const start = useRef(performance.now());
  const flown = useRef(false);
  const fit = fitFor(size.width, size.height, fitAspect);
  const goal = useMemo(() => new THREE.Vector3(...target), [target]);
  const end = useMemo(() => {
    const offset = new THREE.Vector3(...position).sub(goal);
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.phi = Math.max(0.4, sph.phi - fit.tilt);
    return new THREE.Vector3().setFromSpherical(sph).multiplyScalar(fit.pull).add(goal);
  }, [position, goal, fit.pull, fit.tilt]);
  const dist = end.distanceTo(goal);
  const from = useMemo(() => end.clone().sub(goal).multiplyScalar(1.7).add(goal).add(new THREE.Vector3(6, 4, 0)), [end, goal]);

  useEffect(() => {
    if (hasTestFlag('debug')) (window as any).__camera = { camera, controls };
  }, [camera]);

  // Wider lens on narrow screens. After the fly-in, a turned screen keeps the player's angle but refits the distance.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.zoom = fit.zoom;
    cam.updateProjectionMatrix();
    const c = controls.current;
    if (flown.current && c) {
      const offset = cam.position.clone().sub(c.target);
      cam.position.copy(c.target).add(offset.setLength(dist));
      c.update();
    }
  }, [camera, fit.zoom, dist]);

  useFrame(() => {
    if (flown.current) return;
    const t = Math.min((performance.now() - start.current) / 2200, 1);
    const e = 1 - Math.pow(1 - t, 3);
    // On the last frame t is exactly 1, so the camera always lands on its end pose, even at low fps.
    camera.position.lerpVectors(from, end, e);
    controls.current?.target.copy(goal);
    if (t >= 1) flown.current = true;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={target}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      // Pinch range is measured from the scene's centre, so zooming back in always works after zooming out.
      minDistance={dist * 0.55}
      maxDistance={dist * 1.45}
      minPolarAngle={0.35}
      maxPolarAngle={1.25}
      minAzimuthAngle={-0.7}
      maxAzimuthAngle={0.7}
    />
  );
}
