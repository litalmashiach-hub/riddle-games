import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';

export type Vec3 = [number, number, number];

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** One leg of a path. */
export interface PathSegment {
  to: Vec3;
  /** Peak height of the arc. 0 = glide. */
  height?: number;
  durationMs: number;
  /** Wait before this leg starts. */
  delayMs?: number;
  /** Called when this leg ends (good for a sound). */
  onEnd?: () => void;
  /** Called when this leg starts. */
  onStart?: () => void;
  /**
   * Ride along with another object for this leg (e.g. a passenger in a boat): the position is
   * `follow.position + offset` every frame, so the two can never drift apart. `to` is ignored.
   */
  follow?: RefObject<THREE.Object3D | null>;
  offset?: Vec3;
}

/**
 * Plays a sequence of hops/glides on an object whenever `key` changes.
 * On the first render the object is placed at the last segment's end, no animation.
 * Use this so that nothing teleports.
 */
export function usePath(
  ref: RefObject<THREE.Object3D | null>,
  segments: PathSegment[],
  key: string,
  opts: { face?: boolean; faceOffset?: number } = {},
) {
  const { face = true, faceOffset = 0 } = opts;
  const run = useRef<{ segs: PathSegment[]; start: number; from: THREE.Vector3; index: number; started: boolean } | null>(null);
  const segsRef = useRef(segments);
  segsRef.current = segments;
  const first = useRef(true);

  useEffect(() => {
    const obj = ref.current;
    const segs = segsRef.current;
    if (!obj || segs.length === 0) return;
    if (first.current) {
      first.current = false;
      obj.position.set(...segs[segs.length - 1].to);
      return;
    }
    run.current = { segs, start: performance.now(), from: obj.position.clone(), index: 0, started: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useFrame(() => {
    const r = run.current;
    const obj = ref.current;
    if (!r || !obj || r.index >= r.segs.length) return;
    const seg = r.segs[r.index];
    const elapsed = performance.now() - r.start - (seg.delayMs ?? 0);
    if (elapsed < 0) return;
    if (!r.started) {
      r.started = true;
      seg.onStart?.();
    }
    const t = Math.min(elapsed / Math.max(seg.durationMs, 1), 1);
    if (seg.follow?.current) {
      const [ox, oy, oz] = seg.offset ?? [0, 0, 0];
      obj.position.copy(seg.follow.current.position).add(new THREE.Vector3(ox, oy, oz));
      if (t >= 1) {
        seg.onEnd?.();
        r.from = obj.position.clone();
        r.start = performance.now();
        r.index += 1;
        r.started = false;
      }
      return;
    }
    const to = new THREE.Vector3(...seg.to);
    obj.position.lerpVectors(r.from, to, easeInOut(t));
    obj.position.y += Math.sin(Math.PI * t) * (seg.height ?? 0);
    if (face) {
      const dx = to.x - r.from.x;
      const dz = to.z - r.from.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.05) {
        let d = Math.atan2(dx, dz) + faceOffset - obj.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        obj.rotation.y += d * 0.15;
      }
    }
    if (t >= 1) {
      seg.onEnd?.();
      r.from = to.clone();
      r.start = performance.now();
      r.index += 1;
      r.started = false;
    }
  });
}

/** Single hop to `target` whenever it changes. */
export function useHopTo(
  ref: RefObject<THREE.Object3D | null>,
  target: Vec3,
  opts: { height?: number; durationMs?: number; delayMs?: number; face?: boolean } = {},
) {
  usePath(ref, [{ to: target, height: opts.height ?? 0.8, durationMs: opts.durationMs ?? 600, delayMs: opts.delayMs }], target.join(','), {
    face: opts.face,
  });
}

/** Gently turn an object to a yaw angle each frame. */
export function useFaceYaw(ref: RefObject<THREE.Object3D | null>, yaw: number, speed = 4) {
  useFrame((_, dt) => {
    const o = ref.current;
    if (!o) return;
    let d = yaw - o.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    o.rotation.y += d * Math.min(1, dt * speed);
  });
}

/** Seeded random numbers, so scenery is the same on every load. */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
