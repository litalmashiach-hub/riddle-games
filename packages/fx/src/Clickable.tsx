import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useState, type ReactNode } from 'react';
import { useHeldTap } from './heldTaps';
import { clickGuard, LiftPress, liftTapped, PRESS_SLOP } from './pressOnLift';

/** Lifts that a Clickable has already taken: one inside another doesn't take the same lift again. */
const taken = new WeakSet<Event>();

/**
 * Wraps a 3D object so it shows a hand cursor and a hover lift, and reports taps.
 *
 * A tap counts when the finger lifts, if it went down on this object and moved no more than a few pixels
 * (see pressOnLift.ts): iOS sends no click for a press held a little long. The click that follows on the
 * scene is then held off, so it acts once; a click elsewhere on the page is never held off. Two fingers on
 * the screen are a camera gesture and no tap, however still. A click with no lift seen here (another object
 * held the pointer) still counts, as before.
 */
export function Clickable({
  onClick,
  disabled,
  children,
  hoverScale = 1.06,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  hoverScale?: number;
}) {
  const [hover, setHover] = useState(false);
  const [press] = useState(() => new LiftPress());
  // A tap while it is disabled and a move is still animating is held, and taken when the move is over (heldTaps.tsx).
  const tap = useHeldTap(onClick, !!disabled);
  useCursor(hover && !disabled);
  return (
    <group
      scale={hover && !disabled ? hoverScale : 1}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        press.press(e.nativeEvent);
        clickGuard().watch(press);
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const lift = e.nativeEvent;
        if (taken.has(lift)) return;
        const was = press.lift(lift);
        if (was === 'none') return;
        taken.add(lift);
        // A drag that began here turned the camera: its click is no tap either.
        clickGuard().holdOffClick(lift);
        if (was !== 'tap') return;
        liftTapped();
        tap();
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.delta <= PRESS_SLOP) tap();
      }}
    >
      {children}
    </group>
  );
}
