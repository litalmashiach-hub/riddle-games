import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useState, type ReactNode } from 'react';
import { clickGuard, LiftPress, liftTapped, PRESS_SLOP } from './pressOnLift';

/** Lifts that a Clickable has already taken: one inside another doesn't take the same lift again. */
const taken = new WeakSet<Event>();

/**
 * Wraps a 3D object so it shows a hand cursor and a hover lift, and reports taps.
 *
 * A tap counts when the finger lifts, if it went down on this object and moved no more than a few pixels
 * (see pressOnLift.ts): iOS sends no click for a press held a little long. The click that follows is then
 * held off, so it acts once. A click with no lift seen here (another object held the pointer) still counts,
 * as before.
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
        if (!disabled) onClick();
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (!disabled && e.delta <= PRESS_SLOP) onClick();
      }}
    >
      {children}
    </group>
  );
}
