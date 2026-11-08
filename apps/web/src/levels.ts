import type { RiddleLevel, WorldId } from '@riddle/engine';
import wolfTwoSheep from '@riddle/level-01-wolf-two-sheep';
import towerOfHanoi from '@riddle/level-04-tower-of-hanoi';
import wolfGoatCabbage from '@riddle/level-02-wolf-goat-cabbage';
import twoJugs from '@riddle/level-03-two-jugs';
import bridgeAndTorch from '@riddle/level-05-bridge-and-torch';
import explorersGuardians from '@riddle/level-06-explorers-guardians';
import bridgeFive from '@riddle/level-09-bridge-five';
import fourPillarTower from '@riddle/level-10-four-pillar-tower';
import familyCrossing from '@riddle/level-11-family-crossing';
import twelveCoins from '@riddle/level-12-twelve-coins';
import leapfrogLagoon from '@riddle/level-13-leapfrog-lagoon';
import fireflyLanterns from '@riddle/level-14-firefly-lanterns';
import pictureTiles from '@riddle/level-19-picture-tiles';
import jealousCouples from '@riddle/level-07-jealous-couples';
import threeJugs from '@riddle/level-08-three-jugs';

import fireflyJars from '@riddle/level-16-firefly-jars';
/**
 * Every level in the game, in order. A level that is built is listed with its package;
 * the rest show as "coming soon" cards.
 *
 * To add a level: create levels/NN-name (see docs/adding-a-level.md),
 * add it to apps/web/package.json, import it here and put it in BUILT.
 */
const BUILT: RiddleLevel[] = [wolfTwoSheep, wolfGoatCabbage, twoJugs, towerOfHanoi, bridgeAndTorch, explorersGuardians, jealousCouples, bridgeFive, fourPillarTower, familyCrossing, twelveCoins, threeJugs, leapfrogLagoon, fireflyLanterns, pictureTiles, fireflyJars];

export interface LevelEntry {
  number: number;
  id: string;
  title: string;
  world: WorldId;
  tagline: string;
  level?: RiddleLevel;
}

const PLAN: Omit<LevelEntry, 'level'>[] = [
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
  { number: 16, id: 'firefly-jars', title: 'Firefly Jars', world: 'lagoon', tagline: 'One colour of firefly in every jar.' },
  { number: 17, id: 'moonbeam-mirrors', title: 'Moonbeam Mirrors', world: 'lagoon', tagline: 'Bounce the moonbeam onto every flower.' },
  { number: 18, id: 'log-jam', title: 'Log Jam', world: 'lagoon', tagline: 'Slide the logs aside and free the duck raft.' },
  { number: 19, id: 'picture-tiles', title: 'Picture Tiles', world: 'lagoon', tagline: 'Slide the stones back into the turtle picture.' },
];

export const LEVELS: LevelEntry[] = PLAN.map((p) => ({ ...p, level: BUILT.find((b) => b.number === p.number) }));

export const WORLD_ORDER: WorldId[] = ['meadow', 'temple', 'sky', 'citadel', 'lagoon'];
