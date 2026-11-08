import { useFrame, useThree } from '@react-three/fiber';
import type { Vec3 } from '@riddle/fx';
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';

/**
 * HTML pinned to a point in the 3D scene.
 * Like drei's <Html center>, but its DOM root is created in a plain effect, so it always
 * mounts under React StrictMode (drei's version sometimes never shows up there).
 */
export function Overlay({
  position = [0, 0, 0],
  follow,
  children,
  zIndex = 5,
  interactive = false,
  anchor = 'center',
  shrink = false,
}: {
  position?: Vec3;
  /** Pin to this object (plus `position` as an offset) instead of a fixed point. */
  follow?: RefObject<THREE.Object3D | null>;
  children: ReactNode;
  zIndex?: number;
  interactive?: boolean;
  /** 'bottom' puts the point under the HTML instead of at its middle. */
  anchor?: 'center' | 'bottom';
  /** Scale down on narrow (phone) screens. */
  shrink?: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const el = useRef<HTMLDivElement | null>(null);
  const root = useRef<Root | null>(null);
  const v = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const parent = gl.domElement.parentNode as HTMLElement | null;
    if (!parent) return;
    const div = document.createElement('div');
    div.style.cssText = `position:absolute;top:0;left:0;z-index:${zIndex};pointer-events:${interactive ? 'auto' : 'none'};will-change:transform;visibility:hidden;`;
    parent.appendChild(div);
    const r = createRoot(div);
    el.current = div;
    root.current = r;
    return () => {
      el.current = null;
      root.current = null;
      div.remove();
      // Unmount after React finishes the current render.
      setTimeout(() => r.unmount(), 0);
    };
  }, [gl, zIndex, interactive]);

  useEffect(() => {
    root.current?.render(<div style={{ transform: `${anchor === 'bottom' ? 'translate(-50%,-100%)' : 'translate(-50%,-50%)'}${shrink ? ` scale(${Math.min(1, Math.max(0.62, size.width / 760))})` : ''}`, transformOrigin: anchor === 'bottom' ? '50% 100%' : '50% 50%' }}>{children}</div>);
  });

  useFrame(() => {
    const div = el.current;
    if (!div) return;
    v.set(...position);
    if (follow?.current) follow.current.localToWorld(v);
    v.project(camera);
    const behind = v.z > 1;
    div.style.visibility = behind ? 'hidden' : 'visible';
    div.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px,${((1 - v.y) / 2) * size.height}px,0)`;
  });

  return null;
}

/** A pill bubble, same look as the shared props Bubble. */
export function Pill({ children, tone = 'white' }: { children: ReactNode; tone?: 'white' | 'gold' }) {
  return (
    <div
      style={{
        background: tone === 'gold' ? '#ffd166' : '#ffffff',
        color: '#1f2937',
        padding: '4px 14px',
        borderRadius: 999,
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontWeight: 700,
        fontSize: 22,
        boxShadow: '0 6px 16px rgba(0,0,0,.3)',
        whiteSpace: 'nowrap',
        animation: 'jugs-pop .35s cubic-bezier(.34,1.56,.64,1)',
      }}
    >
      <style>{`@keyframes jugs-pop{from{transform:scale(0)}to{transform:scale(1)}}`}</style>
      {children}
    </div>
  );
}
