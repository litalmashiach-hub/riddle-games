import type { WorldId } from '@riddle/engine';
import { Environment, Lightformer, Sky } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useState, type ReactNode } from 'react';
import { PostFX } from './PostFX';
import { useSettings } from './settings';
import { WORLDS } from './worlds';

/**
 * True once the canvas has its event element, which is one commit after it mounts.
 *
 * drei's <Html> labels attach to that element and fall back to another one until it exists. A label
 * mounted too early therefore moves once, and drei then builds a second React root on the same DOM
 * node. The first root's late clean-up empties the node, so the label goes blank, and React throws
 * "removeChild ... not a child of this node" when that label is later taken away. Holding the scene
 * back until the element is known means every label attaches once and keeps a single root.
 */
function useCanvasConnected() {
  const connected = useThree((s) => Boolean(s.events.connected));
  // Latched, so a later reconnect can never unmount the scene and lose its state.
  const [ready, setReady] = useState(connected);
  useEffect(() => {
    if (connected) setReady(true);
  }, [connected]);
  return ready || connected;
}

/**
 * Lighting, sky, fog, reflections and post-processing for a world.
 * The shell wraps every level scene in this, so levels only build their diorama.
 */
export function WorldStage({ world, children }: { world: WorldId; children: ReactNode }) {
  const look = WORLDS[world];
  const quality = useSettings((s) => s.quality);
  const high = quality === 'high';
  const ready = useCanvasConnected();
  return (
    <>
      <color attach="background" args={[look.fog]} />
      <fog attach="fog" args={[look.fog, look.fogNear, look.fogFar]} />
      <Sky distance={450} sunPosition={look.sun} {...look.sky} />
      <hemisphereLight args={[look.hemiSky, look.hemiGround, look.hemiIntensity]} />
      <directionalLight
        position={look.sun}
        color={look.sunColor}
        intensity={look.sunIntensity}
        castShadow
        shadow-mapSize={high ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* Soft studio reflections, generated in-browser (no HDR download). */}
      <Environment resolution={high ? 256 : 64} frames={1}>
        <Lightformer intensity={2} color={look.hemiSky} position={[0, 6, -8]} scale={[20, 6, 1]} />
        <Lightformer intensity={1.2} color={look.sunColor} position={[8, 4, 4]} scale={[6, 6, 1]} />
        <Lightformer intensity={0.6} color={look.hemiGround} position={[-8, -2, 2]} scale={[10, 4, 1]} rotation-y={Math.PI / 2} />
      </Environment>
      {ready && children}
      <PostFX />
    </>
  );
}
