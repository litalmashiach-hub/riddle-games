import type { Vec3 } from '@riddle/fx';
import { CAPACITY, type Color } from './rules';

export const MOVE_MS = 1000;
export const LOSE_MS = 3600;

export const JAR_COUNT = 6;
export const JAR_R = 0.5;
/** Height of one firefly "floor" inside a jar. */
export const SLOT_H = 0.44;
export const JAR_BASE_Y = 0.55; // raft deck height
export const JAR_H = SLOT_H * CAPACITY + 0.32;
export const JAR_TOP = JAR_BASE_Y + JAR_H;
/** Height a picked-up firefly hovers at, and the flight cruise height. */
export const HOVER_Y = JAR_TOP + 0.55;

/** Jars stand in a gentle smile-shaped arc on the raft, facing the camera. */
export const JAR_POS: Vec3[] = Array.from({ length: JAR_COUNT }, (_, i) => {
  const t = i - (JAR_COUNT - 1) / 2; // -2.5..2.5
  return [t * 1.36, JAR_BASE_Y, -Math.abs(t) * Math.abs(t) * 0.09 + 0.25] as Vec3;
});

export const slotPos = (jar: number, slot: number): Vec3 => {
  const [x, , z] = JAR_POS[jar];
  return [x, JAR_BASE_Y + 0.08 + SLOT_H * (slot + 0.5), z];
};

export const hoverPos = (jar: number): Vec3 => {
  const [x, , z] = JAR_POS[jar];
  return [x, HOVER_Y, z];
};

/** Glow colours (linear, brighter than 1 so bloom picks them up) and matching UI colours. */
export const GLOW: Record<Color, string> = {
  gold: '#ffc53d',
  pink: '#ff5fa8',
  mint: '#4dff9a',
  sky: '#46c8ff',
};
export const EMOJI: Record<Color, string> = { gold: '💛', pink: '💗', mint: '💚', sky: '💙' };
