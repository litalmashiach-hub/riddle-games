import { useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useState, type ReactNode } from 'react';

/** Wraps a 3D object so it shows a hand cursor and a hover lift, and reports clicks. */
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
  useCursor(hover && !disabled);
  return (
    <group
      scale={hover && !disabled ? hoverScale : 1}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
    >
      {children}
    </group>
  );
}
