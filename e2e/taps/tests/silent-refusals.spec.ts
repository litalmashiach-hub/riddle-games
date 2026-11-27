import { LEVELS } from '../../levels';
import { SETTINGS_KEY, expect, passRulesCard, playMove, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { READ_SCENE, Taps, snapshot, waitCameraStill, waitIdle, type Vec3 } from '../harness';
import { slot as torchSlot } from '../../../levels/05-bridge-and-torch/src/layout';
import { slot as lanternSlot } from '../../../levels/09-bridge-five/src/layout';
import { cellPos } from '../../../levels/15-slippery-pond/src/layout';
import { SIZE, type State as PondState } from '../../../levels/15-slippery-pond/src/rules';
import { JAM as JAM_18, type Jam, type State as JamState } from '../../../levels/18-log-jam/src/rules';
import { jam as JAM_27 } from '../../../levels/27-timber-tangle/src/rules';
import { BOARD as BOARD_21, freeLeaps, type Board, type State as CricketState } from '../../../levels/21-cricket-swap/src/rules';
import { BOARD as BOARD_29 } from '../../../levels/29-cricket-crossing/src/rules';

/**
 * Every tap that the rules refuse with only the "that won't work" blip also shows the refusal mark
 * (RefusalMark in packages/props): a red pill with a cross and a few words, over the thing tapped.
 * The game is played with its sound off here, as a player who can't hear would have it, so the mark is
 * the only answer.
 *
 * For each case the level is brought to the state the case needs by the debug hook (the setup moves are
 * not what is tested), then the refused tap is a real touch on the 3D scene or the page's button.
 * Each case checks that the mark comes up with its words, in view and taking no touch; that the tap
 * made no move; that the mark clears by itself; and, with the device's Reduce Motion on, that the mark
 * does not move at all (no animation), while with it off it gives its short shake.
 */

interface Case {
  level: string;
  what: string;
  say: string;
  /** Moves played through the debug hook first. */
  setup?: unknown[];
  /** The refused touch. */
  tap(taps: Taps, state: any): Promise<void>;
}

async function tapFigure(taps: Taps, place: Vec3, what: string, within = 1.2) {
  const t = await taps.targetNear(place, { handler: 'onClick', within });
  expect(t, `a figure that listens stands at ${what}'s place`).toBeTruthy();
  await taps.tapTarget(t!, what);
}

const tapPillar = (p: number) => async (taps: Taps) => {
  const t = await taps.targetNear([[-2.7, 0, 2.7][p], 0, 0], { handler: 'onClick', within: 0.3 });
  expect(t, 'the pillar listens').toBeTruthy();
  await taps.tapTarget(t!, `pillar ${p + 1}`);
};

/** An ice cell neither in the otter's row nor in its column. Every pond is SIZE by SIZE (rules.ts), so levels 15 and 24 share the layout. */
const offLine = async (taps: Taps, s: PondState) => {
  const x = s.x + 1 < SIZE ? s.x + 1 : s.x - 1;
  const y = s.y + 1 < SIZE ? s.y + 1 : s.y - 1;
  await taps.tapWorld(cellPos(x, y), `the ice at column ${x + 1}, row ${y + 1}`);
};

/** A log (not the raft) that has nowhere to slide at the start. */
const stuckLog = (jam: Jam) => async (taps: Taps, s: JamState) => {
  const HALF = 3;
  const i = jam.pieces.findIndex((_, k) => k > 0 && jam.reach(s.pos, k).length === 0);
  expect(i, 'a log that cannot move at the start').toBeGreaterThan(0);
  const pc = jam.pieces[i];
  const along = s.pos[i] + pc.len / 2 - HALF;
  const cell = pc.line - HALF + 0.5;
  await taps.tapWorld(pc.axis === 'h' ? [along, 0.44, cell] : [cell, 0.44, along], `log ${i}`);
};

/** Pick a cricket that has two leaps (so the tap only chooses it), then tap an empty toadstool it can't reach. */
const unreachable = (board: Board) => async (taps: Taps, s: CricketState) => {
  const GAP = 1.55;
  const CAP_TOP = 0.62;
  const cap = (c: number): Vec3 => [((c % board.cols) - (board.cols - 1) / 2) * GAP, CAP_TOP, (Math.floor(c / board.cols) - (board.rows - 1) / 2) * GAP - 0.15];
  const cells = [...s.board].map((_, c) => c);
  const from = cells.find((c) => s.board[c] !== '.' && freeLeaps(s, c, board).length >= 2);
  expect(from, 'a cricket with two leaps open').toBeDefined();
  const to = cells.find((c) => s.board[c] === '.' && !board.jars.includes(c) && !freeLeaps(s, from!, board).includes(c));
  expect(to, 'an empty toadstool that cricket cannot reach').toBeDefined();
  const [x, y, z] = cap(from!);
  await taps.tapWorld([x, y + 0.25, z], 'the cricket');
  await taps.page.waitForTimeout(400);
  await taps.tapWorld(cap(to!), 'the toadstool out of reach');
};

/** What the page recorded of a refusal mark: its look the moment it came up, and how long it stayed. */
interface Seen {
  say: string;
  text: string;
  pointer: string;
  visibility: string;
  animation: string;
  colour: string;
  background: string;
  rect: { x: number; y: number; width: number; height: number };
  inView: boolean;
  removedAfterMs: number | null;
}

/** Records every refusal mark as it comes up and goes, in `window.__refusals`. */
const WATCH_REFUSALS = () => {
  const w = window as any;
  w.__refusals = [];
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        const pill = n instanceof HTMLElement ? n.querySelector<HTMLElement>('[data-refusal]') : null;
        if (!pill) continue;
        const holder = n as HTMLElement;
        const cs = getComputedStyle(pill);
        const b = pill.getBoundingClientRect();
        const entry = {
          say: pill.dataset.refusal,
          text: pill.textContent,
          pointer: getComputedStyle(holder).pointerEvents,
          visibility: getComputedStyle(holder).visibility,
          animation: cs.animationName,
          colour: cs.color,
          background: cs.backgroundColor,
          rect: { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) },
          inView: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && b.width > 0,
          removedAfterMs: null as number | null,
          at: performance.now(),
          node: holder,
        };
        w.__refusals.push(entry);
      }
      for (const n of r.removedNodes) {
        const e = w.__refusals.find((x: any) => x.node === n);
        if (e) e.removedAfterMs = Math.round(performance.now() - e.at);
      }
    }
  }).observe(document, { childList: true, subtree: true });
};

const CASES: Case[] = [
  {
    level: 'wolf-two-sheep',
    what: 'an animal on the far bank',
    say: 'The boat is on the other side',
    setup: [{ passenger: 'wolf' }],
    tap: (taps) => tapFigure(taps, [-3.9, 0, 1.4], 'a sheep on the far bank'),
  },
  {
    level: 'wolf-goat-cabbage',
    what: 'an animal on the far bank',
    say: 'The boat is on the other side',
    setup: [{ passenger: 'goat' }],
    tap: (taps) => tapFigure(taps, [-4.3, 0, -0.7], 'the wolf on the far bank'),
  },
  { level: 'tower-of-hanoi', what: 'an empty pillar', say: 'No disc on this pillar', tap: tapPillar(1) },
  { level: 'moonlit-tower', what: 'an empty pillar', say: 'No disc on this pillar', tap: tapPillar(2) },
  {
    level: 'bridge-and-torch',
    what: 'an explorer on the far side',
    say: 'The torch is on the other side',
    setup: [{ walkers: ['pip'] }],
    tap: async (taps) => {
      const t = await taps.targetNear(torchSlot('juno', 'L'), { handler: 'onClick', within: 0.1 });
      expect(t, "Juno's figure").toBeTruthy();
      await taps.tapTarget(t!, 'Juno on the far side');
    },
  },
  {
    level: 'bridge-and-torch',
    what: 'a third explorer',
    say: 'Only two fit on the bridge',
    tap: async (taps) => {
      for (const e of ['pip', 'juno', 'bram'] as const) {
        const t = await taps.targetNear(torchSlot(e, 'L'), { handler: 'onClick', within: 0.1 });
        expect(t, `${e}'s figure`).toBeTruthy();
        await taps.tapTarget(t!, e);
        // Let the picked one reach the bridgehead before the next touch.
        if (e !== 'bram') await taps.page.waitForTimeout(900);
      }
    },
  },
  {
    level: 'bridge-and-torch',
    what: 'Cross with nobody picked',
    say: 'Pick who crosses first',
    tap: (taps) => taps.page.getByRole('button', { name: 'Pick 1 or 2 explorers' }).tap(),
  },
  {
    level: 'bridge-five',
    what: 'a traveller on the far side',
    say: 'The lantern is on the other side',
    setup: [{ walkers: ['zip'] }],
    tap: async (taps) => {
      const t = await taps.targetNear(lanternSlot('mira', 'L'), { handler: 'onClick', within: 0.1 });
      expect(t, "Mira's figure").toBeTruthy();
      await taps.tapTarget(t!, 'Mira on the far side');
    },
  },
  {
    level: 'bridge-five',
    what: 'Cross with nobody picked',
    say: 'Pick who crosses first',
    tap: (taps) => taps.page.getByRole('button', { name: 'Tap 1 or 2 travellers' }).tap(),
  },
  {
    level: 'twelve-coins',
    what: 'a coin after the last weighing',
    say: 'No weighings left',
    setup: [
      { kind: 'weigh', left: [0, 1, 2, 3], right: [4, 5, 6, 7] },
      { kind: 'weigh', left: [0, 1, 2], right: [8, 9, 10] },
      { kind: 'weigh', left: [0], right: [11] },
    ],
    tap: async (taps) => {
      // The coins fly home after a weighing; tap coin 6 once it is back on the table.
      await taps.page.waitForTimeout(2500);
      await tapFigure(taps, [((5 % 6) - 2.5) * 0.8, 0.95, 1.15], 'coin 6', 0.6);
    },
  },
  { level: 'slippery-pond', what: 'ice not in line', say: 'Tap in line with the otter', tap: offLine },
  { level: 'frosty-maze', what: 'ice not in line', say: 'Tap in line with the otter', tap: offLine },
  { level: 'log-jam', what: 'a log that cannot move', say: "This log can't move", tap: stuckLog(JAM_18) },
  { level: 'timber-tangle', what: 'a log that cannot move', say: "This log can't move", tap: stuckLog(JAM_27) },
  { level: 'cricket-swap', what: 'a toadstool out of reach', say: 'Out of reach', tap: unreachable(BOARD_21) },
  { level: 'cricket-crossing', what: 'a toadstool out of reach', say: 'Out of reach', tap: unreachable(BOARD_29) },
];

for (const motion of ['no-preference', 'reduce'] as const) {
  test.describe(motion === 'reduce' ? 'with Reduce Motion on' : 'with Reduce Motion off', () => {
    test.use({ reducedMotion: motion });
    for (const c of CASES) {
      const level = LEVELS.find((l) => l.id === c.level)!;
      const nn = String(level?.number).padStart(2, '0');
      test(`level ${nn} ${c.level}: a tap on ${c.what} shows "${c.say}"`, async ({ page }) => {
        expect(level, `level ${c.level} is in the game`).toBeTruthy();
        const taps = new Taps(page, level, page.viewportSize()!);
        await page.addInitScript(READ_SCENE);
        await page.addInitScript(WATCH_REFUSALS);
        // Sound off, as a player who can't hear it has it: the mark must answer alone.
        await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ quality: 'low', sound: false })), SETTINGS_KEY);
        await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
        await page.goto(`?debug&quality=low#/level/${level.id}`);
        await waitForSession(page, level.id);
        await passRulesCard(page, level.title);
        await page.waitForFunction(() => window.__taps.ready());
        for (const [i, m] of (c.setup ?? []).entries()) await playMove(page, m, i + 1);
        await waitCameraStill(page);
        await waitIdle(page);

        const before = await snapshot(page);
        await c.tap(taps, before.state);

        const mark = page.locator(`[data-refusal="${c.say.replace(/"/g, '\\"')}"]`);
        await expect(mark, 'the refusal mark comes up with its words').toBeVisible({ timeout: 5_000 });
        await page.screenshot({ path: test.info().outputPath(`${nn}-${c.level}-${motion}.png`) });
        // How the mark looked the moment it came up, as the page recorded it (it may be gone by now on a slow machine).
        const seen = await page.evaluate(() => ((window as any).__refusals as (Seen & { node: unknown })[]).map(({ node: _node, ...r }) => r) as Seen[]);
        expect(seen.map((r) => r.say), 'one mark came up, with these words').toEqual([c.say]);
        const [look] = seen;
        expect(look.text).toBe(`\u2715${c.say}`);
        expect(look.pointer, 'the mark takes no touch').toBe('none');
        expect(look.visibility).toBe('visible');
        expect(look.inView, `the mark lies in the screen (${JSON.stringify(look.rect)})`).toBe(true);
        expect(look.colour).toBe('rgb(255, 255, 255)');
        expect(look.background).toBe('rgb(200, 36, 63)');
        if (motion === 'reduce') expect(look.animation, 'with Reduce Motion on the mark does not move').toBe('none');
        else expect(look.animation, 'with Reduce Motion off the mark gives a short shake').toBe('riddle-refuse');

        const after = await snapshot(page);
        expect(after.moves.length, 'the refused tap made no move').toBe(before.moves.length);
        expect(after.state).toEqual(before.state);

        await expect(mark, 'the mark clears by itself').toHaveCount(0, { timeout: 5_000 });
        const gone = await page.evaluate(() => ((window as any).__refusals as (Seen & { node: unknown })[]).map(({ node: _node, ...r }) => r) as Seen[]);
        expect(gone[0].removedAfterMs, 'the mark stays up long enough to read').toBeGreaterThan(1000);
      });
    }
  });
}
