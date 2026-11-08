import type { WorldId } from '@riddle/engine';

/** Look of each world: sky, fog, light colors. Levels in a world share it. */
export interface WorldLook {
  name: string;
  sun: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  sky: { turbidity: number; rayleigh: number; mieCoefficient: number; mieDirectionalG: number };
  fog: string;
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  /** CSS gradient for menus and loading screens. */
  uiGradient: string;
  accent: string;
}

export const WORLDS: Record<WorldId, WorldLook> = {
  meadow: {
    name: 'Meadow River',
    sun: [12, 9, 6],
    sunColor: '#fff1d6',
    sunIntensity: 2.6,
    sky: { turbidity: 6, rayleigh: 1.6, mieCoefficient: 0.004, mieDirectionalG: 0.85 },
    fog: '#cfe6ee',
    fogNear: 28,
    fogFar: 70,
    hemiSky: '#bfe3ff',
    hemiGround: '#6a8f3a',
    hemiIntensity: 0.9,
    uiGradient: 'linear-gradient(160deg,#9be7c4 0%,#4fb3d9 55%,#2b5e9e 100%)',
    accent: '#ffd166',
  },
  temple: {
    name: 'Ancient Temple',
    sun: [-8, 6, 4],
    sunColor: '#ffb070',
    sunIntensity: 2.2,
    sky: { turbidity: 10, rayleigh: 3, mieCoefficient: 0.01, mieDirectionalG: 0.9 },
    fog: '#e3b98a',
    fogNear: 22,
    fogFar: 60,
    hemiSky: '#ffd9a8',
    hemiGround: '#6b4a2b',
    hemiIntensity: 0.7,
    uiGradient: 'linear-gradient(160deg,#f6c177 0%,#c96f3b 55%,#5a2a1c 100%)',
    accent: '#7ee0b0',
  },
  sky: {
    name: 'Sky Islands',
    sun: [6, 14, -6],
    sunColor: '#ffffff',
    sunIntensity: 2.8,
    sky: { turbidity: 2, rayleigh: 0.8, mieCoefficient: 0.003, mieDirectionalG: 0.8 },
    fog: '#dbe9ff',
    fogNear: 30,
    fogFar: 90,
    hemiSky: '#e6f0ff',
    hemiGround: '#9fb6e0',
    hemiIntensity: 1.1,
    uiGradient: 'linear-gradient(160deg,#c7d2fe 0%,#818cf8 55%,#3730a3 100%)',
    accent: '#fbbf24',
  },
  citadel: {
    name: 'Clockwork Citadel',
    sun: [4, 4, 10],
    sunColor: '#ffcf8a',
    sunIntensity: 1.8,
    sky: { turbidity: 14, rayleigh: 4, mieCoefficient: 0.02, mieDirectionalG: 0.95 },
    fog: '#3b2f3a',
    fogNear: 18,
    fogFar: 55,
    hemiSky: '#ffb36b',
    hemiGround: '#2a1f2b',
    hemiIntensity: 0.6,
    uiGradient: 'linear-gradient(160deg,#fcd34d 0%,#b45309 50%,#1f1320 100%)',
    accent: '#f59e0b',
  },
};
