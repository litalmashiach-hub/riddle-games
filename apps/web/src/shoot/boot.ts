/**
 * TEST ONLY, branch store-screenshots-test. Imported first by main.tsx, before the game reads its saved data.
 * In the app build (and on the website with ?shoot) it saves a progress of levels 1 to 12 solved and HD graphics,
 * then starts the scene director once the game is up.
 */
import { APP_SHELL } from '../appShell';

const params = new URLSearchParams(location.search);
export const SHOOTING = APP_SHELL || params.has('shoot');

if (SHOOTING) {
  const stars: Record<string, number> = {
    'wolf-two-sheep': 3, 'wolf-goat-cabbage': 3, 'two-jugs': 2, 'tower-of-hanoi': 3, 'bridge-and-torch': 2,
    'explorers-guardians': 3, 'jealous-couples': 3, 'three-jugs': 2, 'bridge-five': 3, 'four-pillar-tower': 3,
    'family-crossing': 2, 'twelve-coins': 3,
  };
  try {
    localStorage.setItem('riddle-games:progress:v1', JSON.stringify({ stars }));
    if (!params.get('quality')) localStorage.setItem('riddle-games:settings:v1', JSON.stringify({ quality: 'high', sound: false }));
  } catch {
    /* ignore */
  }
  const only = (params.get('shoot') ?? import.meta.env.VITE_SHOOT_ONLY ?? '').split(',').filter(Boolean);
  const hold = Number(params.get('hold') ?? import.meta.env.VITE_SHOOT_HOLD) || undefined;
  setTimeout(() => {
    void import('./director').then((d) => d.runShots(only && only.length ? only : undefined, hold));
  }, 4000);
}
