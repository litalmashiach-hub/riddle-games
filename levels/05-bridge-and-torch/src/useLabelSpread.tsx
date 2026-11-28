import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, type CSSProperties } from 'react';
import { spreadLabels, type LabelBox, type Offset } from './labelSpread';

/** Space kept free at the screen's edges. */
const EDGE = 6;
/** A label moved further than this from its character gets a thin line back to them. */
const STEM_MIN = 7;

interface Entry {
  el: HTMLElement | null;
  ref: (el: HTMLElement | null) => void;
  /** Where the label is drawn now, and where it is heading, relative to its own spot. */
  now: Offset;
  target: Offset;
  /** Not shown on the last frame. */
  fresh: boolean;
}

/** Something on the screen that labels keep off, like a character's body. `id` is the label that may cover it. */
export interface LabelObstacle {
  id?: string;
  box: LabelBox;
}

export interface LabelSpread {
  /** Ref for the element wrapped around one label. The same function every time for the same id. */
  ref(id: string): (el: HTMLElement | null) => void;
}

/**
 * Keeps the labels above characters from covering each other.
 *
 * Wrap each label's content in `<div ref={spread.ref(id)}>` and put a `<LabelStem />` inside it.
 * Every frame the labels' boxes are read from the page; when some overlap they slide apart (see
 * `spreadLabels`), and a label that had to move away from its character points back at them.
 * Mark a label that is hidden with `data-off` so that it takes up no room.
 *
 * `obstacles`, read every frame, are screen boxes that labels keep off where they can (see `spreadLabels`):
 * a label drawn over another character would take the touches meant for that character.
 */
export function useLabelSpread(obstacles?: () => LabelObstacle[]): LabelSpread {
  const canvas = useThree((s) => s.gl.domElement);
  const entries = useMemo(() => new Map<string, Entry>(), []);
  const memo = useMemo(() => ({ key: '' }), []);

  useFrame((_, dtRaw) => {
    const live: Entry[] = [];
    const ids: string[] = [];
    const boxes: LabelBox[] = [];
    let key = '';
    for (const [id, e] of entries) {
      const el = e.el;
      if (!el || !el.isConnected || el.dataset.off != null) {
        e.now = { dx: 0, dy: 0 };
        e.target = { dx: 0, dy: 0 };
        e.fresh = true;
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // The box as it would be without our own shift.
      const box = { x: r.left - e.now.dx, y: r.top - e.now.dy, w: r.width, h: r.height };
      live.push(e);
      ids.push(id);
      boxes.push(box);
      key += `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.w)},${Math.round(box.h)};`;
    }

    const blocks = (obstacles?.() ?? []).map((o) => ({ box: o.box, owner: o.id == null ? undefined : ids.indexOf(o.id) }));
    for (const { box } of blocks) key += `|${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.w)},${Math.round(box.h)}`;

    // Only work the places out again when something moved by a pixel or more.
    if (key !== memo.key) {
      memo.key = key;
      const c = canvas.getBoundingClientRect();
      const bounds = { left: c.left + EDGE, top: c.top + EDGE, right: c.right - EDGE, bottom: c.bottom - EDGE };
      const out = spreadLabels(
        boxes,
        bounds,
        live.map((e) => e.target),
        { obstacles: blocks },
      );
      live.forEach((e, i) => (e.target = { dx: Math.round(out[i].dx), dy: Math.round(out[i].dy) }));
    }

    const k = Math.min(1, Math.max(dtRaw, 1e-3) * 14);
    live.forEach((e, i) => {
      const el = e.el!;
      // A label that has just come up starts in its place; after that it slides.
      const step = e.fresh ? 1 : k;
      e.fresh = false;
      let dx = e.now.dx + (e.target.dx - e.now.dx) * step;
      let dy = e.now.dy + (e.target.dy - e.now.dy) * step;
      if (Math.abs(e.target.dx - dx) < 0.3) dx = e.target.dx;
      if (Math.abs(e.target.dy - dy) < 0.3) dy = e.target.dy;
      e.now = { dx, dy };
      el.style.transform = dx || dy ? `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` : '';

      // The line from the label's edge back to the spot above its character's head.
      const stem = el.querySelector<HTMLElement>('[data-label-stem]');
      if (!stem) return;
      const { w, h } = boxes[i];
      // From the label's centre to a point just under where it would have sat.
      const vx = -dx;
      const vy = -dy + h * 0.5;
      const t = Math.min(vx ? w / 2 / Math.abs(vx) : Infinity, vy ? h / 2 / Math.abs(vy) : Infinity);
      const len = Math.hypot(vx, vy) * (1 - t);
      if (!(t < 1) || len < STEM_MIN) {
        stem.style.opacity = '0';
        return;
      }
      stem.style.opacity = '1';
      stem.style.width = `${len.toFixed(1)}px`;
      // The line goes behind any other label it crosses, so it never strikes through their text.
      const cx = boxes[i].x + dx + w / 2;
      const cy = boxes[i].y + dy + h / 2;
      const d = Math.hypot(vx, vy);
      const cuts: [number, number][] = [];
      live.forEach((o, j) => {
        if (j === i) return;
        const cut = segmentInBox(cx + vx * t, cy + vy * t, (vx / d) * len, (vy / d) * len, {
          x: boxes[j].x + o.now.dx - 2,
          y: boxes[j].y + o.now.dy - 2,
          w: boxes[j].w + 4,
          h: boxes[j].h + 4,
        });
        if (cut) cuts.push(cut);
      });
      stem.style.maskImage = stem.style.webkitMaskImage = cuts.length
        ? cuts
            .map(([a, b]) => `linear-gradient(90deg, #000 ${(a * 100).toFixed(1)}%, transparent ${(a * 100).toFixed(1)}%, transparent ${(b * 100).toFixed(1)}%, #000 ${(b * 100).toFixed(1)}%)`)
            .join(', ')
        : '';
      stem.style.transform = `translate(${(vx * t).toFixed(1)}px, ${(vy * t).toFixed(1)}px) rotate(${Math.atan2(vy, vx).toFixed(3)}rad)`;
    });
  });

  return useMemo<LabelSpread>(
    () => ({
      ref(id) {
        let e = entries.get(id);
        if (!e) {
          const made: Entry = {
            el: null,
            // A label that drei builds again can report its new element before the old one reports that it
            // has gone, so "gone" is not trusted here: the frame loop checks that the element is on the page.
            ref: (el) => {
              if (el) made.el = el;
            },
            now: { dx: 0, dy: 0 },
            target: { dx: 0, dy: 0 },
            fresh: true,
          };
          entries.set(id, made);
          e = made;
        }
        return e.ref;
      },
    }),
    [entries],
  );
}

/** The part of the line from (x, y) along (dx, dy) that lies inside `box`, as fractions of its length. */
function segmentInBox(x: number, y: number, dx: number, dy: number, box: LabelBox): [number, number] | null {
  let a = 0;
  let b = 1;
  for (const [p, d, lo, hi] of [
    [x, dx, box.x, box.x + box.w],
    [y, dy, box.y, box.y + box.h],
  ]) {
    if (Math.abs(d) < 1e-6) {
      if (p < lo || p > hi) return null;
      continue;
    }
    const t0 = (lo - p) / d;
    const t1 = (hi - p) / d;
    a = Math.max(a, Math.min(t0, t1));
    b = Math.min(b, Math.max(t0, t1));
  }
  return b - a > 0.01 ? [a, b] : null;
}

/** Style for the element that `spread.ref` goes on. */
export const LABEL_WRAP: CSSProperties = { position: 'relative', willChange: 'transform' };

/** The thin line from a moved label back to its character. Drawn by `useLabelSpread`; hidden until needed. */
export function LabelStem({ color = 'rgba(255,255,255,.9)' }: { color?: string }) {
  return (
    <span
      data-label-stem=""
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        height: 2,
        marginTop: -1,
        width: 0,
        borderRadius: 2,
        background: color,
        boxShadow: '0 0 2px rgba(0,0,0,.55)',
        transformOrigin: '0 50%',
        opacity: 0,
        pointerEvents: 'none',
        maskComposite: 'intersect',
        WebkitMaskComposite: 'source-in',
      }}
    />
  );
}
