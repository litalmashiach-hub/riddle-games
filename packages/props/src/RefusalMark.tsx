import { useFrame, useThree } from '@react-three/fiber';
import { useReducedMotion, type Vec3 } from '@riddle/fx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

/*
 * The seen twin of the "that won't work" blip (sfx.denied). A tap that the rules refuse plays the blip,
 * and with it a small red "✕" pill over the thing tapped, with a few words that say why. A player with
 * the sound off, or who can't hear it, still gets an answer to the tap.
 *
 * - It takes no touch (pointer-events: none) and changes nothing in the play: it only shows.
 * - It sits above the piece, so it never covers a Hint ring on the ground.
 * - It gives a short shake as it comes up. With Reduce Motion on it does not move at all: it is just there,
 *   and then it is gone.
 * - White words on #c8243f read at 5.6 to 1; the white rim keeps the pill apart from any scene behind it.
 * - It draws no frame of its own: the pill is page HTML laid over the scene, placed once as it comes up
 *   and kept in place on each drawn frame, so it shows and clears also when the scene is drawn only on change.
 *
 * Use: `const nope = useRefusal();` then `nope.refuse([x, y, z], 'Out of reach')` beside sfx.denied(),
 * and `<RefusalMark refusal={nope.refusal} />` somewhere in the scene.
 */

/** How long the mark stays up, in milliseconds. */
export const REFUSAL_MS = 1400;

/** The least gap, in pixels, between the mark and the screen's edge. */
const EDGE = 8;

/** The colours of the mark, for anything that shows a refusal in the page's own HTML. */
export const REFUSAL_RED = '#c8243f';

export interface Refusal {
  /** Counts the refusals, so the same one twice still shows twice. */
  n: number;
  /** Where in the scene: the mark's bottom middle sits here. */
  at: Vec3;
  /** A few words: why the tap did nothing. */
  say: string;
}

/** The scene's refusal mark: what is up now, and the call that puts one up. */
export function useRefusal() {
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const count = useRef(0);
  const refuse = useCallback((at: Vec3, say: string) => {
    count.current += 1;
    setRefusal({ n: count.current, at, say });
  }, []);
  const clear = useCallback(() => setRefusal(null), []);
  useEffect(() => {
    if (!refusal) return;
    const t = setTimeout(() => setRefusal((r) => (r?.n === refusal.n ? null : r)), REFUSAL_MS);
    return () => clearTimeout(t);
  }, [refusal]);
  return { refusal, refuse, clear };
}

/** The mark itself. Put it anywhere inside the scene's Canvas. */
export function RefusalMark({ refusal }: { refusal: Refusal | null }) {
  if (!refusal) return null;
  return <RefusalPill key={refusal.n} at={refusal.at} say={refusal.say} />;
}

const KEYFRAMES =
  '@keyframes riddle-refuse{0%{transform:translateX(0) scale(.6)}20%{transform:translateX(-7px) scale(1.06)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}100%{transform:translateX(0) scale(1)}}';

function RefusalPill({ at, say }: { at: Vec3; say: string }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const still = useReducedMotion();
  const el = useRef<HTMLDivElement | null>(null);
  const v = useMemo(() => new THREE.Vector3(), []);

  const place = () => {
    const div = el.current;
    if (!div) return;
    v.set(at[0], at[1], at[2]).project(camera);
    div.style.visibility = v.z > 1 ? 'hidden' : 'visible';
    // Kept wholly on the screen: a figure near the edge (a small phone held sideways) still gets all its words.
    const w = (div.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
    const h = (div.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    const x = Math.min(Math.max(((v.x + 1) / 2) * size.width, EDGE + w / 2), size.width - EDGE - w / 2);
    const y = Math.min(Math.max(((1 - v.y) / 2) * size.height, EDGE + h), size.height - EDGE);
    div.style.transform = `translate3d(${x}px,${y}px,0)`;
  };

  // Plain page elements laid over the canvas, made in an effect (no drei <Html>, which can come up
  // blank when it mounts and unmounts often, and no React root of its own).
  useEffect(() => {
    const parent = gl.domElement.parentNode as HTMLElement | null;
    if (!parent) return;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;top:0;left:0;z-index:6;pointer-events:none;visibility:hidden;';
    const lift = document.createElement('div');
    lift.style.transform = 'translate(-50%,-100%)';
    const pill = document.createElement('div');
    pill.dataset.refusal = say;
    pill.setAttribute('role', 'status');
    Object.assign(pill.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: REFUSAL_RED,
      color: '#ffffff',
      border: '2.5px solid #ffffff',
      padding: '3px 12px 3px 8px',
      borderRadius: '999px',
      fontFamily: 'Fredoka, system-ui, sans-serif',
      fontWeight: '700',
      fontSize: `${Math.round(Math.max(14, Math.min(18, size.width / 48)))}px`,
      lineHeight: '1.2',
      boxShadow: '0 4px 12px rgba(0,0,0,.35)',
      whiteSpace: 'nowrap',
      animation: still ? 'none' : 'riddle-refuse .42s ease-out',
    } satisfies Partial<CSSStyleDeclaration>);
    const cross = document.createElement('span');
    cross.setAttribute('aria-hidden', 'true');
    cross.textContent = '\u2715';
    const words = document.createElement('span');
    words.textContent = say;
    pill.append(cross, words);
    const style = document.createElement('style');
    style.textContent = KEYFRAMES;
    lift.append(pill, style);
    div.append(lift);
    parent.appendChild(div);
    el.current = div;
    place();
    invalidate();
    return () => {
      el.current = null;
      div.remove();
      invalidate();
    };
    // Made once per refusal (the mark is keyed by its count); the words, place and setting are read then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useFrame(place);
  return null;
}
