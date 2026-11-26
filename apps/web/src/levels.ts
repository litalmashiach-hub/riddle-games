import type { RiddleLevel, WorldId } from '@riddle/engine';

/**
 * Every built level, by number. Each level's code (its rules and 3D scene) is loaded only when that level
 * opens, so the level map does not wait for 30 scenes and three.js to be read first. The files are part of
 * the build (and of the app), so no network is needed. A level without a line here shows as a "coming soon" card.
 *
 * To add a level: create levels/NN-name (see docs/adding-a-level.md),
 * add it to apps/web/package.json and add its line here.
 */
const BUILT: Record<number, () => Promise<{ default: RiddleLevel }>> = {
  1: () => import('@riddle/level-01-wolf-two-sheep'),
  2: () => import('@riddle/level-02-wolf-goat-cabbage'),
  3: () => import('@riddle/level-03-two-jugs'),
  4: () => import('@riddle/level-04-tower-of-hanoi'),
  5: () => import('@riddle/level-05-bridge-and-torch'),
  6: () => import('@riddle/level-06-explorers-guardians'),
  7: () => import('@riddle/level-07-jealous-couples'),
  8: () => import('@riddle/level-08-three-jugs'),
  9: () => import('@riddle/level-09-bridge-five'),
  10: () => import('@riddle/level-10-four-pillar-tower'),
  11: () => import('@riddle/level-11-family-crossing'),
  12: () => import('@riddle/level-12-twelve-coins'),
  13: () => import('@riddle/level-13-leapfrog-lagoon'),
  14: () => import('@riddle/level-14-firefly-lanterns'),
  15: () => import('@riddle/level-15-slippery-pond'),
  16: () => import('@riddle/level-16-firefly-jars'),
  17: () => import('@riddle/level-17-moonbeam-mirrors'),
  18: () => import('@riddle/level-18-log-jam'),
  19: () => import('@riddle/level-19-picture-tiles'),
  20: () => import('@riddle/level-20-berry-bridges'),
  21: () => import('@riddle/level-21-cricket-swap'),
  22: () => import('@riddle/level-22-pancake-stack'),
  23: () => import('@riddle/level-23-frog-parade'),
  24: () => import('@riddle/level-24-frosty-maze'),
  25: () => import('@riddle/level-25-firefly-rainbow'),
  26: () => import('@riddle/level-26-moonbeam-maze'),
  27: () => import('@riddle/level-27-timber-tangle'),
  28: () => import('@riddle/level-28-family-portrait'),
  29: () => import('@riddle/level-29-cricket-crossing'),
  30: () => import('@riddle/level-30-moonlit-tower'),
};

export interface LevelEntry {
  number: number;
  id: string;
  title: string;
  world: WorldId;
  tagline: string;
  /** Loads the level's code; only on a level that is built. */
  load?: () => Promise<RiddleLevel>;
}

const PLAN: Omit<LevelEntry, 'load'>[] = [
  { number: 1, id: 'wolf-two-sheep', title: 'Wolf and Two Sheep', world: 'meadow', tagline: 'Never leave the wolf with a lonely sheep.' },
  { number: 2, id: 'wolf-goat-cabbage', title: 'Wolf, Goat and Cabbage', world: 'meadow', tagline: 'Everyone wants to eat someone.' },
  { number: 3, id: 'two-jugs', title: 'Two Jugs', world: 'meadow', tagline: 'Measure exactly 4 litres with a 3 and a 5.' },
  { number: 4, id: 'tower-of-hanoi', title: 'Tower of Hanoi', world: 'temple', tagline: 'Move the jade tower, one disc at a time.' },
  { number: 5, id: 'bridge-and-torch', title: 'Bridge and Torch', world: 'temple', tagline: 'Four explorers, one torch, 17 minutes.' },
  { number: 6, id: 'explorers-guardians', title: 'Explorers and Guardians', world: 'temple', tagline: 'Never let the guardians outnumber you.' },
  { number: 7, id: 'jealous-couples', title: 'Three Jealous Couples', world: 'sky', tagline: 'A balloon for two and a lot of jealousy.' },
  { number: 8, id: 'three-jugs', title: 'Three Jugs', world: 'sky', tagline: 'Split 8 litres of potion into two fours.' },
  { number: 9, id: 'bridge-five', title: 'Bridge of Five', world: 'sky', tagline: 'Five travellers, one lantern, 30 minutes.' },
  { number: 10, id: 'four-pillar-tower', title: 'Four-Pillar Tower', world: 'citadel', tagline: 'Hanoi with an extra pillar and a bigger stack.' },
  { number: 11, id: 'family-crossing', title: 'Family Crossing', world: 'citadel', tagline: 'A family, a guard and a thief on one raft.' },
  { number: 12, id: 'twelve-coins', title: 'The Twelve Coins', world: 'citadel', tagline: 'One fake coin. Three weighings.' },
  { number: 13, id: 'leapfrog-lagoon', title: 'Leapfrog Lagoon', world: 'lagoon', tagline: 'Three green frogs, three orange frogs, one empty lily pad.' },
  { number: 14, id: 'firefly-lanterns', title: 'Firefly Lanterns', world: 'lagoon', tagline: 'Every tap flips a lantern and its neighbours.' },
  { number: 15, id: 'slippery-pond', title: 'Slippery Pond', world: 'lagoon', tagline: 'Once you start sliding, you cannot stop.' },
  { number: 16, id: 'firefly-jars', title: 'Firefly Jars', world: 'lagoon', tagline: 'One kind of firefly in every jar.' },
  { number: 17, id: 'moonbeam-mirrors', title: 'Moonbeam Mirrors', world: 'lagoon', tagline: 'Bounce the moonbeam onto every flower.' },
  { number: 18, id: 'log-jam', title: 'Log Jam', world: 'lagoon', tagline: 'Slide the logs aside and free the duck raft.' },
  { number: 19, id: 'picture-tiles', title: 'Picture Tiles', world: 'lagoon', tagline: 'Slide the stones back into the turtle picture.' },
  { number: 20, id: 'berry-bridges', title: 'Berry Bridges', world: 'lagoon', tagline: 'Cross every bridge once. Each one sinks behind you.' },
  { number: 21, id: 'cricket-swap', title: 'Cricket Swap', world: 'lagoon', tagline: 'Two striped crickets, two spotted ones, and every leap is an L.' },
  { number: 22, id: 'pancake-stack', title: 'Pancake Stack', world: 'lagoon', tagline: 'Flip the top of the stack until the biggest is at the bottom.' },
  { number: 23, id: 'frog-parade', title: 'Frog Parade', world: 'lagoon', tagline: 'Four green frogs, four orange frogs, and still only one empty pad.' },
  { number: 24, id: 'frosty-maze', title: 'Frosty Maze', world: 'lagoon', tagline: 'The fish are in the middle of the ice, and the way in is anything but straight.' },
  { number: 25, id: 'firefly-rainbow', title: 'Firefly Rainbow', world: 'lagoon', tagline: 'Five kinds of firefly now, and only two jars to spare.' },
  { number: 26, id: 'moonbeam-maze', title: 'Moonbeam Maze', world: 'lagoon', tagline: 'Five moon-flowers, eleven crystals and one very light sleeper.' },
  { number: 27, id: 'timber-tangle', title: 'Timber Tangle', world: 'lagoon', tagline: 'A tighter knot of logs, and Dottie is no more patient than before.' },
  { number: 28, id: 'family-portrait', title: 'Family Portrait', world: 'lagoon', tagline: 'Shelly has a new mosaic of the whole family, and it is in a worse muddle.' },
  { number: 29, id: 'cricket-crossing', title: 'Cricket Crossing', world: 'lagoon', tagline: 'Three striped crickets, three spotted ones and twelve toadstools to cross.' },
  { number: 30, id: 'moonlit-tower', title: 'Moonlit Tower', world: 'lagoon', tagline: 'The jade tower again, by night, and one disc taller.' },
];

export const LEVELS: LevelEntry[] = PLAN.map((p) => {
  const load = BUILT[p.number];
  return load ? { ...p, load: () => load().then((m) => m.default) } : p;
});

export const WORLD_ORDER: WorldId[] = ['meadow', 'temple', 'sky', 'citadel', 'lagoon'];
