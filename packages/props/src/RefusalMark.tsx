import { useFrame, useThree } from '@react-three/fiber';
import { useReducedMotion, type Vec3 } from '@riddle/fx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { HINT_MARK } from './HintRing';
import { ringBands } from './hintMark';
import { CLEAR, EDGE, grow, noteBox, overlap, pick, spots, type Box, type Spot } from './refusalPlace';

/*
 * The seen twin of the "that won't work" blip (sfx.denied). A tap that the rules refuse plays the blip,
 * and with it a small red "✕" pill over the thing tapped, with a few words that say why. A player with
 * the sound off, or who can't hear it, still gets an answer to the tap.
 *
 * - It takes no touch (pointer-events: none) and changes nothing in the play: it only shows.
 * - It sits above the piece. Where that would cover one of Hint's marks (any mesh named HINT_MARK, and any
 *   ring the scene names in `avoid`), a button of the scene or the HUD, or a page element marked
 *   `data-refusal-avoid` (the hint's words), it moves to the side, below, or just clear of what it would cover
 *   (refusalPlace.ts), so the gold mark, every button and the hint always stay in view, and the note is never
 *   drawn under the hint.
 * - Its words grow with the player's text size setting, as the shell's do (`--text-grow`, apps/web/src/textSize.ts,
 *   docs/larger-text.md). Grown, they may take two lines, so the note stays narrow enough to step aside.
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

/** The page elements the note steps aside from: every button, and anything marked `data-refusal-avoid`. */
export const AVOID_SELECTOR = 'button, [role="button"], a[href], input, select, [data-refusal-avoid]';

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

const KEYFRAMES =
  '@keyframes riddle-refuse{0%{transform:translateX(0) scale(.6)}20%{transform:translateX(-7px) scale(1.06)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}100%{transform:translateX(0) scale(1)}}';

const KEYFRAMES_ID = 'riddle-refuse-keyframes';

function RefusalPill({ region, at, say, avoid }: { region: HTMLDivElement; at: Vec3; say: string; avoid?: AvoidRing[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const still = useReducedMotion();
  const el = useRef<HTMLDivElement | null>(null);
  const scene = useThree((s) => s.scene);
  const v = useMemo(() => new THREE.Vector3(), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hits = useMemo<THREE.Intersection[]>(() => [], []);

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

  /**
   * The page's buttons (the scene's own and the HUD's) and what the page marks `data-refusal-avoid` (the hint's
   * words, which are drawn above the note and would hide it), as boxes in the canvas's pixels, grown by the clearance.
   */
  const buttonBoxes = (): Box[] => {
    const origin = region.getBoundingClientRect();
    const out: Box[] = [];
    for (const b of document.querySelectorAll<HTMLElement>(AVOID_SELECTOR)) {
      if (region.contains(b)) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (getComputedStyle(b).visibility === 'hidden') continue;
      const box = { l: r.left - origin.left, t: r.top - origin.top, r: r.right - origin.left, b: r.bottom - origin.top };
      if (box.r <= 0 || box.b <= 0 || box.l >= size.width || box.t >= size.height) continue;
      out.push(grow(box, CLEAR));
    }
    return out;
  };

  /** Hint's marks now in view (every one carries the name HINT_MARK), with their screen boxes. */
  const hintMarks = () => {
    const out: { mesh: THREE.Mesh; box: Box }[] = [];
    scene.traverse((o) => {
      if (o.name !== HINT_MARK || !(o as THREE.Mesh).isMesh) return;
      for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return;
      const mesh = o as THREE.Mesh;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      mesh.updateWorldMatrix(true, false);
      const box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
      for (const x of [bb.min.x, bb.max.x])
        for (const y of [bb.min.y, bb.max.y])
          for (const z of [bb.min.z, bb.max.z]) {
            v.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
            const sx = ((v.x + 1) / 2) * size.width;
            const sy = ((1 - v.y) / 2) * size.height;
            box.l = Math.min(box.l, sx);
            box.r = Math.max(box.r, sx);
            box.t = Math.min(box.t, sy);
            box.b = Math.max(box.b, sy);
          }
      // The pulse swells a mark a little past its resting size.
      out.push({ mesh, box: grow(box, CLEAR + 0.06 * Math.max(box.r - box.l, box.b - box.t)) });
    });
    return out;
  };

  /** How much of Hint's marks lies under a note box: points of the band itself, 3 pixels apart, by three.js's own mesh test. */
  const markCover = (box: Box, marks: { mesh: THREE.Mesh; box: Box }[]) => {
    const STEP = 3;
    const near = grow(box, CLEAR);
    let points = 0;
    for (const m of marks) {
      const l = Math.max(near.l, m.box.l);
      const r = Math.min(near.r, m.box.r);
      const t = Math.max(near.t, m.box.t);
      const b = Math.min(near.b, m.box.b);
      if (l >= r || t >= b) continue;
      for (let y = t; y <= b; y += STEP)
        for (let x = l; x <= r; x += STEP) {
          ray.setFromCamera(ndc.set((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1), camera);
          hits.length = 0;
          // The marks take no taps (their own raycast answers nothing), so ask the plain mesh test.
          THREE.Mesh.prototype.raycast.call(m.mesh, ray, hits);
          if (hits.length) points++;
        }
    }
    return points * STEP * STEP;
  };

  const chosen = useRef<{ at: Spot; spot: Spot; when: number; w: number; h: number } | null>(null);

  const place = () => {
    const div = el.current;
    if (!div) return;
    const p = toScreen(at);
    div.style.visibility = p.behind ? 'hidden' : 'visible';
    const pill = (div.firstElementChild as HTMLElement | null) ?? null;
    const w = pill?.offsetWidth ?? 0;
    const h = pill?.offsetHeight ?? 0;
    const now = performance.now();
    const last = chosen.current;
    // Placed again only when the piece has moved on the screen, the note's size changed, or a moment has
    // passed (a mark or a button may have come up): the note does not hop about while it is read.
    if (last && Math.abs(last.at.x - p.x) < 1.5 && Math.abs(last.at.y - p.y) < 1.5 && last.w === w && last.h === h && now - last.when < 300) return;
    const ground = toScreen([at[0], 0, at[2]]);
    const rings = (avoid ?? []).map(ringBox);
    const buttons = buttonBoxes();
    const marks = hintMarks();
    const things = [...rings, ...buttons, ...marks.map((m) => m.box)];
    const list = spots(p, ground.y, w, h, size.width, size.height, things);
    const cost = (s: Spot) => {
      const box = noteBox(s, w, h);
      return rings.reduce((sum, ring) => sum + overlap(box, ring), 0) + buttons.reduce((sum, b) => sum + overlap(box, b), 0) + markCover(box, marks);
    };
    // Kept where it is while that still covers nothing and the piece has not moved.
    let spot: Spot;
    let index: number;
    if (last && last.w === w && last.h === h && Math.abs(last.at.x - p.x) < 1.5 && Math.abs(last.at.y - p.y) < 1.5 && cost(last.spot) === 0) {
      spot = last.spot;
      index = Number(div.dataset.refusalPlace ?? 0);
    } else ({ spot, index } = pick(list, cost));
    chosen.current = { at: { x: p.x, y: p.y }, spot, when: now, w, h };
    div.style.transform = `translate3d(${spot.x}px,${spot.y}px,0)`;
    div.dataset.refusalPlace = String(index);
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
    const grown = (Number(document.documentElement.dataset.textGrow ?? 1) || 1) > 1;
    Object.assign(pill.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: REFUSAL_RED,
      color: '#ffffff',
      border: '2.5px solid #ffffff',
      padding: '3px 12px 3px 8px',
      fontFamily: 'Fredoka, system-ui, sans-serif',
      fontWeight: '700',
      // The game's own size for the screen, grown with the player's text size setting the way the shell's
      // words are (--text-grow, set on <html> by the app; 1 at the standard size and on the website).
      fontSize: `calc(${Math.round(Math.max(14, Math.min(18, size.width / 48)))}px * var(--text-grow, 1))`,
      lineHeight: '1.2',
      boxShadow: '0 4px 12px rgba(0,0,0,.35)',
      // At the standard size, one line. Grown, the words may take two lines, so the note stays narrow
      // enough to step aside from a mark or a button.
      whiteSpace: grown ? 'normal' : 'nowrap',
      width: 'max-content',
      maxWidth: grown ? `${Math.round(Math.min(size.width - 2 * EDGE, Math.max(240, size.width * 0.5)))}px` : 'none',
      textAlign: 'center',
      borderRadius: grown ? '0.9em' : '999px',
      animation: still ? 'none' : 'riddle-refuse .42s ease-out',
    } satisfies Partial<CSSStyleDeclaration>);
    const cross = document.createElement('span');
    cross.setAttribute('aria-hidden', 'true');
    cross.textContent = '\u2715';
    const words = document.createElement('span');
    words.textContent = say;
    pill.append(cross, words);
    // Grown words that take two lines share them evenly.
    if (grown) pill.style.setProperty('text-wrap', 'balance');
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
