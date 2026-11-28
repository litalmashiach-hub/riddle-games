import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import * as THREE from 'three';

/**
 * Name labels that take taps, as level 5's do (see levels/05-bridge-and-torch/src/Scene.tsx; level 9 has the same file).
 *
 * The labels are what a player reads, so they are what a player taps. The label spreader moves a label away from
 * its owner, often over someone else, so a tap that went through the label to the scene picked whoever stood under
 * it. Here each label is a button that picks its own owner. An unseen pad makes each label at least 44 points high
 * and wide without moving the drawn label, so the label spreader sees the same boxes as before. Where two labels'
 * pads meet, the label nearest the finger takes the tap, and each frame a pad is cut back where it would cover
 * another label's drawing, so a touch on a label's own drawing always reaches that label.
 *
 * The pad is unseen, so it must not take a tap from a figure that the player can see: a touch on a pad, off every
 * label's drawing, that lands on a drawn figure (one of `figures`) picks that figure, as a touch on the scene would.
 */
export interface LabelTaps<K extends string> {
  /** Ref for the drawn label of `id`. */
  label(id: K): (el: HTMLElement | null) => void;
  /** Ref for the unseen touch pad of `id`. */
  pad(id: K): (el: HTMLElement | null) => void;
  /** A press on the label of `id` with no finger (VoiceOver, a switch, a key): picks `id`. */
  press(id: K): void;
  /**
   * A tap at (x, y) on the label of `id`: picks the owner of the label under the finger; off every label's
   * drawing, the figure drawn under the finger, or else the owner of the label nearest the finger.
   */
  tap(id: K, x: number, y: number): void;
}

export function useLabelTaps<K extends string>(
  ids: readonly K[],
  pick: (id: K) => void,
  /** Each one's figure in the scene, for a touch on a pad that lands on a figure. */
  figures: { current: Partial<Record<K, THREE.Object3D>> },
): LabelTaps<K> {
  const getThree = useThree((s) => s.get);
  const labels = useRef<Partial<Record<K, HTMLElement>>>({});
  const pads = useRef<Partial<Record<K, HTMLElement>>>({});
  // The newest pick, so the refs and taps below can stay the same functions from one render to the next.
  const pickNow = useRef(pick);
  pickNow.current = pick;

  useFrame(() => {
    for (const e of ids) {
      const pad = pads.current[e];
      const own = labels.current[e];
      if (!pad || !own || !pad.isConnected) continue;
      const p = pad.getBoundingClientRect();
      const r = own.getBoundingClientRect();
      // How far each side may be cut: never into the label's own drawing.
      const room = { top: Math.max(0, r.top - p.top), bottom: Math.max(0, p.bottom - r.bottom), left: Math.max(0, r.left - p.left), right: Math.max(0, p.right - r.right) };
      const cut = { top: 0, bottom: 0, left: 0, right: 0 };
      for (const k of ids) {
        const other = k === e ? undefined : labels.current[k];
        if (!other || !other.isConnected || !takesTaps(other)) continue;
        const o = other.getBoundingClientRect();
        if (o.width === 0 || o.right <= p.left || o.left >= p.right || o.bottom <= p.top || o.top >= p.bottom) continue;
        const up = o.top + o.height / 2 < r.top + r.height / 2;
        const leftOf = o.left + o.width / 2 < r.left + r.width / 2;
        const v = up ? o.bottom - p.top : p.bottom - o.top;
        const h = leftOf ? o.right - p.left : p.right - o.left;
        const vFits = v <= (up ? room.top : room.bottom) + 0.5;
        const hFits = h <= (leftOf ? room.left : room.right) + 0.5;
        if (vFits && (!hFits || v * p.width <= h * p.height)) {
          if (up) cut.top = Math.max(cut.top, v + 1);
          else cut.bottom = Math.max(cut.bottom, v + 1);
        } else if (hFits) {
          if (leftOf) cut.left = Math.max(cut.left, h + 1);
          else cut.right = Math.max(cut.right, h + 1);
        }
      }
      const clip = cut.top || cut.bottom || cut.left || cut.right ? `inset(${cut.top}px ${cut.right}px ${cut.bottom}px ${cut.left}px)` : '';
      if (pad.style.clipPath !== clip) pad.style.clipPath = clip;
    }
  });

  return useMemo<LabelTaps<K>>(() => {
    const labelRefs = new Map<K, (el: HTMLElement | null) => void>();
    const padRefs = new Map<K, (el: HTMLElement | null) => void>();
    const refFor = (map: Map<K, (el: HTMLElement | null) => void>, store: { current: Partial<Record<K, HTMLElement>> }, id: K) => {
      let f = map.get(id);
      if (!f) {
        // Only a new element is stored: drei can build a label again and report the new one before the old one goes.
        f = (el) => {
          if (el) store.current[id] = el;
        };
        map.set(id, f);
      }
      return f;
    };
    return {
      label: (id) => refFor(labelRefs, labels, id),
      pad: (id) => refFor(padRefs, pads, id),
      press(id) {
        pickNow.current(id);
      },
      tap(id, x, y) {
        // The label that took the tap keeps it when the finger is on its drawing: where two labels overlap, it is
        // the one drawn on top, the one the player sees.
        let best = id;
        let onDrawing = false;
        let bestD = Infinity;
        for (const k of [id, ...ids.filter((x) => x !== id)]) {
          const el = labels.current[k];
          if (!el || !el.isConnected || !takesTaps(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
          if (d < bestD) {
            bestD = d;
            best = k;
          }
          if (d === 0) onDrawing = true;
        }
        if (!onDrawing) {
          const { camera, gl } = getThree();
          best = figureAt(gl.domElement, camera, figures.current, x, y) ?? best;
        }
        pickNow.current(best);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const ray = new THREE.Raycaster();
const hits: THREE.Intersection[] = [];

/**
 * Whose figure is drawn at screen point (x, y), nearest the camera first, or null. Only meshes that are drawn
 * count, by three.js's own mesh test: an unseen tap padding around a figure is no part of what the player sees.
 */
function figureAt<K extends string>(canvas: HTMLElement, camera: THREE.Camera, figures: Partial<Record<K, THREE.Object3D>>, x: number, y: number): K | null {
  const r = canvas.getBoundingClientRect();
  if (r.width === 0) return null;
  ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
  let best: K | null = null;
  let bestD = Infinity;
  for (const [k, root] of Object.entries(figures) as [K, THREE.Object3D | undefined][]) {
    if (!root) continue;
    root.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
      if (mat && (mat.visible === false || (mat.transparent && mat.opacity < 0.05))) return;
      hits.length = 0;
      THREE.Mesh.prototype.raycast.call(m, ray, hits);
      for (const h of hits)
        if (h.distance < bestD) {
          bestD = h.distance;
          best = k;
        }
    });
  }
  return best;
}

/** A label whose button is switched off, or that is hidden, takes no tap and needs no room kept for it. */
function takesTaps(label: HTMLElement): boolean {
  const b = label.closest('button');
  return !!b && !b.disabled && getComputedStyle(b).pointerEvents !== 'none' && getComputedStyle(b).visibility !== 'hidden';
}

const BUTTON: CSSProperties = {
  position: 'relative',
  display: 'block',
  margin: 0,
  padding: 0,
  border: 0,
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

/**
 * A name label as a button. `children` is the drawn label. The button stops the pointer events from reaching the
 * scene (whose own tap handling listens on the canvas's parent), so a tap on a label never also picks whoever
 * stands behind it.
 */
export function LabelButton<K extends string>({
  taps,
  id,
  name,
  pressed,
  live,
  children,
}: {
  taps: LabelTaps<K>;
  id: K;
  /** The spoken name. */
  name: string;
  pressed: boolean;
  /** False while a move plays, the level is over or the label is hidden: then it takes no tap. */
  live: boolean;
  children: ReactNode;
}) {
  const down = useRef<{ x: number; y: number; at: number } | null>(null);
  return (
    <button
      type="button"
      // The spoken name comes from Scene.tsx, in plain words (no arrow or emoji).
      aria-label={`${name}`}
      aria-pressed={pressed}
      disabled={!live}
      onPointerDown={(ev) => {
        ev.stopPropagation();
        // Where the finger came down. The browser may move a tap's click towards the middle of the nearest
        // button ("touch adjustment"), so the click's own place is not where the finger was.
        down.current = { x: ev.clientX, y: ev.clientY, at: performance.now() };
      }}
      onPointerUp={(ev) => ev.stopPropagation()}
      onClick={(ev) => {
        ev.stopPropagation();
        const d = down.current;
        down.current = null;
        // A click with no pointer before it (VoiceOver, a switch, a key) is a press of this label.
        if (ev.detail === 0 && !d) taps.press(id);
        else if (d && performance.now() - d.at < 2000) taps.tap(id, d.x, d.y);
        // A tap's click with no finger down on this label: the browser moved a touch on the scene nearby onto
        // this label ("touch adjustment"). The scene has that touch already, so the label lets it be.

      }}
      style={{ ...BUTTON, pointerEvents: live ? 'auto' : 'none', cursor: live ? 'pointer' : 'default' }}
    >
      {/* The touch area: 44 points high (and wide) around the drawn label, without moving it. */}
      <span aria-hidden data-touch-pad="" ref={taps.pad(id)} style={{ position: 'absolute', left: '50%', top: '50%', width: 'max(100%, 44px)', height: 44, transform: 'translate(-50%, -50%)' }} />
      <span ref={taps.label(id)} style={{ display: 'block', position: 'relative' }}>
        {children}
      </span>
    </button>
  );
}
