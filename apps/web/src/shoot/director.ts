/**
 * TEST ONLY, branch store-screenshots-test, never for merging.
 * Sets up the App Store screenshot scenes in the real app build, one after another, through the game's own
 * debug hook (window.__riddle, the session of the level on screen): it opens a level by its address, closes the
 * rules card with Escape, plays the first moves of the solver's shortest solution, and presses H for the hint
 * where a shot needs it. It paints nothing. It tells the UI test which scene is up through one accessibility
 * label on an element that sits outside the screen.
 */
import { solve } from '@riddle/engine';

export interface Shot {
  name: string;
  /** Level id, or 'map'. */
  level: string;
  /** Moves of the shortest solution to play before the shot. */
  moves?: number;
  /** Play this many more moves while the pictures are taken (for a shot in motion). */
  liveMoves?: number;
  hint?: boolean;
  /** For the map: the level card to scroll to the middle of the screen. */
  scrollTo?: string;
  /** How long the scene is held for the pictures, ms. */
  holdMs?: number;
}

export const SHOTS: Shot[] = [
  { name: '01-river', level: 'wolf-goat-cabbage', moves: 0, liveMoves: 1 },
  { name: '02-hanoi', level: 'tower-of-hanoi', moves: 4, liveMoves: 1 },
  { name: '03-coins', level: 'twelve-coins', moves: 1, liveMoves: 1 },
  { name: '04-balloon', level: 'jealous-couples', moves: 2, liveMoves: 1 },
  { name: '05-moonbeam', level: 'moonbeam-maze', moves: 6 },
  { name: '06-pancakes', level: 'pancake-stack', moves: 3 },
  { name: '07-hint', level: 'bridge-and-torch', moves: 1, hint: true },
  { name: '08-map', level: 'map', scrollTo: 'Leapfrog Lagoon' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(test: () => boolean, ms: number, step = 100) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return true;
    await sleep(step);
  }
  return false;
}

let marker: HTMLDivElement | null = null;
/** One label for the UI test, off the screen and transparent. */
function signal(text: string) {
  if (!marker) {
    marker = document.createElement('div');
    marker.setAttribute('role', 'img');
    // No background, no border, no text: it paints no pixel, but the accessibility tree has it.
    marker.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;pointer-events:none;';
    document.body.appendChild(marker);
  }
  marker.setAttribute('aria-label', text);
  console.log('SHOOT ' + text);
}

const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
const session = () => (window as any).__riddle as { getState(): any } | undefined;

async function setUp(shot: Shot) {
  if (shot.level === 'map') {
    location.hash = '#/';
    await sleep(2500);
    if (shot.scrollTo) {
      // The sideways map already opens on the level the player is up to; the tall map opens at its top.
      const title = [...document.querySelectorAll('h3, div, span, p')].find((e) => e.childElementCount === 0 && e.textContent?.trim() === shot.scrollTo);
      title?.scrollIntoView({ inline: 'center', block: 'center' });
    }
    await sleep(1500);
    return;
  }
  location.hash = `#/level/${shot.level}`;
  await until(() => session()?.getState().level.id === shot.level, 120_000);
  await until(() => !document.querySelector('[aria-label="Loading level"]'), 180_000, 250);
  await sleep(1200);
  // Close the rules card, and make sure it is gone.
  for (let i = 0; i < 20 && document.body.innerText.includes("Let's go!"); i++) {
    key('Escape');
    await sleep(1500);
  }
  // The camera's fly-in takes 2.2 s once the scene is drawn; the HUD fades in with the card's leaving.
  await sleep(4000);
  const st = session()!.getState();
  const sol = solve(st.level.rules)!;
  for (let i = 0; i < (shot.moves ?? 0); i++) {
    await until(() => !session()!.getState().busy, 20_000, 50);
    session()!.getState().play(sol.moves[i]);
  }
  await until(() => !session()!.getState().busy, 20_000, 50);
  await sleep(1500);
}

export async function runShots(only?: string[], defaultHold = 40_000) {
  (window as any).__sceneWaitMs = 600_000; // a slow simulator is not a stuck scene
  signal('shoot-start');
  for (const shot of SHOTS) {
    if (only && !only.includes(shot.name)) continue;
    await setUp(shot);
    signal(`shoot-${shot.name}`);
    const end = Date.now() + (shot.holdMs ?? defaultHold);
    if (shot.liveMoves) {
      await sleep(3000);
      const st = session()!.getState();
      const sol = solve(st.level.rules, st.history[st.history.length - 1])!;
      for (let i = 0; i < shot.liveMoves; i++) {
        await until(() => !session()!.getState().busy, 20_000, 50);
        session()!.getState().play(sol.moves[i]);
      }
      // The pictures are taken from outside at their own pace: show the move again and again (undo, then redo).
      while (Date.now() < end) {
        await until(() => !session()!.getState().busy, 20_000, 50);
        await sleep(1500);
        if (Date.now() >= end) break;
        session()!.getState().undo();
        await sleep(700);
        session()!.getState().redo();
      }
    }
    if (shot.hint) key('h');
    while (Date.now() < end) {
      await sleep(500);
      // The hint toast leaves after 5 s; ask again so it stays up while the pictures are taken.
      if (shot.hint && !document.body.innerText.includes('💡')) key('h');
    }
  }
  signal('shoot-done');
}

