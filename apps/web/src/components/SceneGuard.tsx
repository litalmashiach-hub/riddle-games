import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { hasTestFlag } from '../appShell';
import { returnFocus } from '../focusReturn';
import { Button } from './Button';
import { HomeIcon, RestartIcon } from './Icons';

/**
 * How long a lost 3D context may stay lost before the player is told. The browser often hands it
 * back within a moment (iOS does so when the app returns from the background), and then nothing shows.
 */
export const CONTEXT_LOST_GRACE_MS = 2500;

/**
 * How long a scene may take for its first drawing before the player is told. A slow device may need
 * well over ten seconds, and until then the loading sign beats the card. The play-through tests
 * (`?debug`, never in the app build) may set another wait, so that they do not hang on the test machine's speed.
 */
export const SCENE_WAIT_MS = 30000;
export const sceneWaitMs = (): number => (hasTestFlag('debug') && (window as any).__sceneWaitMs) || SCENE_WAIT_MS;

interface Props {
  children: ReactNode;
  /** Back to the level map. */
  onExit(): void;
  /** Called when the scene is about to be built again, so the shell can show its loading curtain. */
  onRetry?(): void;
  /** The scene has not been drawn within its wait (see SCENE_WAIT_MS) and still is not. */
  stuck?: boolean;
}

/**
 * Stands around the 3D canvas, so that the player never looks at a blank level.
 *
 * Three things can go wrong with a scene. The device may give no 3D context, or the scene may throw
 * while it is made: both end up as a render error here. Or the context is lost while playing and
 * does not come back. Or the scene is simply never drawn: the shell says so with `stuck`. Either way
 * a card says so in plain words, with two ways out: build the scene again, or go back to the map.
 * The play session lives outside, so trying again keeps the moves.
 */
export function SceneGuard({ children, onExit, onRetry, stuck = false }: Props) {
  // A new attempt gets a new key: the boundary and the whole canvas are thrown away and made afresh.
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [lost, setLost] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // These two events do not bubble, but they can be caught on the way down to the canvas.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onLost = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setLost(true), CONTEXT_LOST_GRACE_MS);
    };
    const onRestored = () => {
      clearTimeout(timer);
      setLost(false);
    };
    el.addEventListener('webglcontextlost', onLost, true);
    el.addEventListener('webglcontextrestored', onRestored, true);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('webglcontextlost', onLost, true);
      el.removeEventListener('webglcontextrestored', onRestored, true);
    };
  }, [attempt]);

  const onError = useCallback(() => setFailed(true), []);
  const retry = () => {
    onRetry?.();
    setFailed(false);
    setLost(false);
    setAttempt((n) => n + 1);
  };

  return (
    <>
      <div ref={box} className="absolute inset-0">
        <SceneBoundary key={attempt} onError={onError}>
          {children}
        </SceneBoundary>
      </div>
      {(failed || lost || stuck) && <SceneMessage onRetry={retry} onExit={onExit} />}
    </>
  );
}

/** Catches an error thrown while the canvas or the scene in it is made or drawn, and shows nothing in its place. */
class SceneBoundary extends Component<{ children: ReactNode; onError(error: unknown): void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Kept in the console for whoever looks into it; the player gets the card.
    console.warn('The 3D scene could not be drawn.', error, info.componentStack);
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The card itself. It lies over everything else on the play screen, the rules card too. So while it is up,
 * everything under it is out of reach for VoiceOver and the keyboard as well as for a finger: the card takes
 * the focus, and what lies beside it in the page is made inert. Otherwise the focus stays in the covered rules
 * card, which says of itself that it is the only thing on the screen, and VoiceOver never gets to "Try again".
 * When the card goes, the focus goes back to where it was, or to the rules card or a button of the play screen.
 */
function SceneMessage({ onRetry, onExit }: { onRetry(): void; onExit(): void }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = card.current;
    const root = el?.parentElement;
    if (!el || !root) return;
    const opener = document.activeElement;
    // The loading sign and the hint's line are words alone, with nothing to press: they stay as they are.
    const under = [...root.children].filter((c) => c !== el && !c.hasAttribute('inert') && c.getAttribute('role') !== 'status');
    for (const c of under) c.setAttribute('inert', '');
    el.focus({ preventScroll: true });
    return () => {
      for (const c of under) c.removeAttribute('inert');
      returnFocus({ from: null, opener, root, fallbacks: ['[role="dialog"]', 'button[aria-label="Rules"]', 'button[aria-label="Back to levels"]'] });
    };
  }, []);
  return (
    <div
      ref={card}
      role="alertdialog"
      aria-modal="true"
      tabIndex={-1}
      aria-labelledby="scene-message-title"
      aria-describedby="scene-message-text"
      className="absolute inset-0 z-30 flex items-center justify-center outline-none bg-slate-950/90 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="panel flex max-h-full w-full max-w-md flex-col overflow-y-auto overscroll-contain rounded-[2rem] p-5 text-center sm:p-6 short:p-4">
        <h2 id="scene-message-title" className="font-display text-3xl font-bold short:text-2xl">
          <span className="block text-5xl short:mr-2 short:inline short:text-2xl" aria-hidden>🙈</span>
          This level can't be shown
        </h2>
        <p id="scene-message-text" className="mt-3 text-white/85 short:mt-2">
          Your device didn't draw the 3D scene this time. Your moves are kept. Try again, or go back and pick a level.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2 short:mt-3">
          <Button tone="gold" className="!py-3" onClick={onRetry}><RestartIcon />Try again</Button>
          <Button className="!py-3" onClick={onExit}><HomeIcon />All levels</Button>
        </div>
      </div>
    </div>
  );
}
