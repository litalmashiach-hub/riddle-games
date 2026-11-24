import type { GuideStep } from '@riddle/engine';
import { useFrame, useThree } from '@react-three/fiber';
import { motion } from 'motion/react';
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';

/**
 * The first-play guide's ring and its few words. A screen overlay: the ring takes no taps, so a tap on the
 * thing it rings reaches the scene underneath; only the Skip button is a button. Its place on the screen is
 * written each frame by <GuideTracker> inside the canvas, so it follows the camera without re-rendering.
 */
export function GuideOverlay({ step, ring, onSkip }: { step: GuideStep; ring: RefObject<HTMLDivElement | null>; onSkip(): void }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[7]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.5, duration: 0.5 } }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      data-testid="first-play-guide"
      role="note"
      aria-label="First move"
    >
      {/* Hidden until the tracker has placed it, so it never flashes in a corner. */}
      <div ref={ring} className="guide-ring" style={{ visibility: 'hidden' }}>
        <span className="guide-ripple" />
        <span className="guide-arrow" />
      </div>
      <div className="absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+4.75rem)] flex justify-center px-4 short:top-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Darker than the game's glass, so the words read over bright water and mist alike. */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/35 bg-slate-900/60 py-1 pl-4 pr-1 font-display text-base font-semibold shadow-lg backdrop-blur-md short:text-[15px]">
          <span data-testid="first-play-guide-say" className="whitespace-nowrap">{step.say}</span>
          <button onClick={onSkip} className="min-h-[2.5rem] rounded-full px-3.5 text-sm font-bold text-white/80 active:bg-white/20" aria-label="Skip the guide">
            Skip
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const point = new THREE.Vector3();
const edge = new THREE.Vector3();
const right = new THREE.Vector3();

/** Inside the canvas: puts the ring over the step's point, sized to the thing, every frame. */
export function GuideTracker({ step, ring }: { step: GuideStep; ring: RefObject<HTMLDivElement | null> }) {
  const camera = useThree((st) => st.camera);
  const size = useThree((st) => st.size);
  const last = useRef('');
  useFrame(() => {
    const el = ring.current;
    if (!el) return;
    point.set(...step.at).project(camera);
    // The radius is measured across the screen, along the camera's own right-hand direction.
    right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(step.radius);
    edge.set(...step.at).add(right).project(camera);
    const x = ((point.x + 1) / 2) * size.width;
    const y = ((1 - point.y) / 2) * size.height;
    const r = Math.max(26, Math.min(size.height * 0.3, Math.abs(edge.x - point.x) * 0.5 * size.width));
    const behind = point.z > 1;
    const css = `${x.toFixed(1)}|${y.toFixed(1)}|${r.toFixed(1)}|${behind}`;
    if (css === last.current) return;
    last.current = css;
    el.style.visibility = behind ? 'hidden' : 'visible';
    el.style.width = el.style.height = `${(r * 2).toFixed(1)}px`;
    el.style.transform = `translate(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px)`;
    el.dataset.x = x.toFixed(1);
    el.dataset.y = y.toFixed(1);
    el.dataset.r = r.toFixed(1);
  });
  return null;
}
