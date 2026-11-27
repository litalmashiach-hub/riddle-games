import { useFrame, useThree } from '@react-three/fiber';
import { useReducedMotion, type Vec3 } from '@riddle/fx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ringBands } from './hintMark';

/*
 * The seen twin of the "that won't work" blip (sfx.denied). A tap that the rules refuse plays the blip,
 * and with it a small red "✕" pill over the thing tapped, with a few words that say why. A player with
 * the sound off, or who can't hear it, still gets an answer to the tap.
 *
 * - It takes no touch (pointer-events: none) and changes nothing in the play: it only shows.
 * - It sits above the piece. Where that would cover a Hint ring that the scene names in `avoid`, it moves to
 *   the side or below instead, so the gold mark always stays in view.
 * - Its words are spoken through one live region (role "status", polite) that lasts as long as the scene,
 *   so it is in the page before the tap and VoiceOver reads each new note. The cross is hidden from it.
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

/** A Hint ring on the ground that the note must not cover: its middle and the radius given to its HintRing. */
export interface AvoidRing {
  at: Vec3;
  radius: number;
}

/** How far from its middle a HintRing of this radius is drawn, dark edge and pulse included. */
export const ringReach = (radius: number) => {
  const b = ringBands(radius);
  return (b.outer + b.edge) * 1.08;
};

/**
 * The mark itself. Put it anywhere inside the scene's Canvas, and keep it there while the scene lives:
 * it holds the lasting live region the notes are spoken through, so that region is in the page before any tap.
 */
export function RefusalMark({ refusal, avoid }: { refusal: Refusal | null; avoid?: AvoidRing[] }) {
  const gl = useThree((s) => s.gl);
  const [region, setRegion] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const parent = gl.domElement.parentNode as HTMLElement | null;
    if (!parent) return;
    const div = document.createElement('div');
    div.dataset.refusalSpoken = '';
    div.setAttribute('role', 'status');
    div.setAttribute('aria-live', 'polite');
    div.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:6;pointer-events:none;';
    parent.appendChild(div);
    setRegion(div);
    return () => {
      div.remove();
      setRegion(null);
    };
  }, [gl]);
  if (!refusal || !region) return null;
  return <RefusalPill key={refusal.n} region={region} at={refusal.at} say={refusal.say} avoid={avoid} />;
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

const KEYFRAMES =
  '@keyframes riddle-refuse{0%{transform:translateX(0) scale(.6)}20%{transform:translateX(-7px) scale(1.06)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}100%{transform:translateX(0) scale(1)}}';

/** The gap, in pixels, kept between the note and a ring it steps aside from. */
const CLEAR = 4;

const KEYFRAMES_ID = 'riddle-refuse-keyframes';

function RefusalPill({ region, at, say, avoid }: { region: HTMLDivElement; at: Vec3; say: string; avoid?: AvoidRing[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const still = useReducedMotion();
  const el = useRef<HTMLDivElement | null>(null);
  const v = useMemo(() => new THREE.Vector3(), []);

  const toScreen = (p: Vec3) => {
    v.set(p[0], p[1], p[2]).project(camera);
    return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, behind: v.z > 1 };
  };

  /** A ring's box on the screen, from the four points of its rim. */
  const ringBox = ({ at: c, radius }: AvoidRing): Box => {
    const r = ringReach(radius);
    const pts = [
      [c[0] - r, c[2]],
      [c[0] + r, c[2]],
      [c[0], c[2] - r],
      [c[0], c[2] + r],
    ].map(([x, z]) => toScreen([x, c[1], z]));
    return { l: Math.min(...pts.map((p) => p.x)) - CLEAR, r: Math.max(...pts.map((p) => p.x)) + CLEAR, t: Math.min(...pts.map((p) => p.y)) - CLEAR, b: Math.max(...pts.map((p) => p.y)) + CLEAR };
  };

  const place = () => {
    const div = el.current;
    if (!div) return;
    const p = toScreen(at);
    div.style.visibility = p.behind ? 'hidden' : 'visible';
    const w = (div.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
    const h = (div.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    // Kept wholly on the screen: a figure near the edge (a small phone held sideways) still gets all its words.
    // (x, y) is the note's bottom middle.
    const fit = (x: number, y: number) => ({
      x: Math.min(Math.max(x, EDGE + w / 2), size.width - EDGE - w / 2),
      y: Math.min(Math.max(y, EDGE + h), size.height - EDGE),
    });
    // Above the piece first; where that covers a Hint ring, beside it, then below it (under the toadstool's
    // foot), whichever covers no ring. If every place covers one, the one that covers least.
    const ground = toScreen([at[0], 0, at[2]]);
    const gap = 10;
    const tries = [
      fit(p.x, p.y),
      fit(p.x + gap + w / 2, p.y + h / 2),
      fit(p.x - gap - w / 2, p.y + h / 2),
      fit(p.x, ground.y + h + gap),
    ];
    const rings = (avoid ?? []).map(ringBox);
    let best = tries[0];
    let least = Infinity;
    for (const t of tries) {
      const box = { l: t.x - w / 2, r: t.x + w / 2, t: t.y - h, b: t.y };
      const covered = rings.reduce((sum, ring) => sum + overlap(box, ring), 0);
      if (covered < least) {
        least = covered;
        best = t;
      }
      if (covered === 0) break;
    }
    div.style.transform = `translate3d(${best.x}px,${best.y}px,0)`;
    div.dataset.refusalPlace = String(tries.indexOf(best));
  };

  // Plain page elements laid over the canvas, made in an effect (no drei <Html>, which can come up
  // blank when it mounts and unmounts often, and no React root of its own).
  useEffect(() => {
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;visibility:hidden;';
    const lift = document.createElement('div');
    lift.style.transform = 'translate(-50%,-100%)';
    const pill = document.createElement('div');
    pill.dataset.refusal = say;
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
    // The shake's keyframes go in the page's head, once, and not in the live region, where a screen
    // reader could take the style's text for part of the note.
    if (!document.getElementById(KEYFRAMES_ID)) {
      const style = document.createElement('style');
      style.id = KEYFRAMES_ID;
      style.textContent = KEYFRAMES;
      document.head.appendChild(style);
    }
    lift.append(pill);
    div.append(lift);
    // Into the lasting live region, so VoiceOver speaks the words as they are added.
    region.appendChild(div);
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
  }, [region]);

  useFrame(place);
  return null;
}
