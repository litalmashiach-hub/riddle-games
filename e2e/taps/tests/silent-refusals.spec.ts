import { LEVELS } from '../../levels';
import { SETTINGS_KEY, expect, passRulesCard, playMove, seedProgress, test, waitForSession } from '../../tests/fixtures';
import { READ_SCENE, Taps, snapshot, waitCameraStill, waitIdle, type Vec3 } from '../harness';
import { setSystemBodySize, SYSTEM_BODY } from '../../textFit';
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
  /** The note was added inside the lasting live region, the very one that was in the page before the tap. */
  inRegion: boolean;
  sameRegion: boolean;
  /** The note's own role (none: it speaks through the region). */
  ownRole: string | null;
  /** What a screen reader hears from the region: the words, not the hidden cross. */
  spoken: string | null;
  crossHidden: string | null;
  /** Points of Hint's marks under the note, on a 2-point grid, and how many marks were shown then. */
  ringPoints: number;
  marksShown: number;
  /** The words' size, in pixels, and the growth then in force on <html>. */
  fontSize: number;
  growth: number;
  /** The words are shown whole: nothing of them is cut off inside the pill. */
  wordsWhole: boolean;
  /** Buttons of the scene or the HUD that the note covers, with the square pixels covered. */
  buttonsCovered: { name: string; px: number }[];
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
        // The box at full size: the pill itself starts its shake drawn at 60%, its holder never moves.
        const b = (pill.parentElement ?? pill).getBoundingClientRect();
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
          ...(() => {
            const region = holder.parentElement;
            const spokenText = (el: Element): string =>
              [...el.childNodes].map((c) => (c.nodeType === 3 ? c.textContent : c instanceof Element && c.getAttribute('aria-hidden') !== 'true' ? spokenText(c) : '')).join('');
            let ringPoints = 0;
            let marksShown = 0;
            if (w.__taps?.marksAt)
              for (let y = b.top; y <= b.bottom; y += 2)
                for (let x = b.left; x <= b.right; x += 2) {
                  const m = w.__taps.marksAt(x, y);
                  marksShown = m.shown;
                  if (m.crossed) ringPoints++;
                }
            const covered: { name: string; px: number }[] = [];
            for (const el of document.querySelectorAll<HTMLElement>('button, [role="button"], a[href], input, select')) {
              if (region?.contains(el)) continue;
              const r = el.getBoundingClientRect();
              if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility === 'hidden') continue;
              const px = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
              if (px > 0) covered.push({ name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), px: Math.round(px) });
            }
            const words = pill.lastElementChild as HTMLElement | null;
            return {
              fontSize: parseFloat(cs.fontSize),
              growth: Number(document.documentElement.dataset.textGrow ?? 1) || 1,
              wordsWhole: pill.scrollWidth <= pill.clientWidth + 1 && pill.scrollHeight <= pill.clientHeight + 1 && (!words || words.scrollWidth <= words.clientWidth + 1),
              buttonsCovered: covered,
              inRegion: !!region && region.hasAttribute('data-refusal-spoken'),
              sameRegion: !!region && region === w.__spokenBefore,
              ownRole: pill.getAttribute('role'),
              spoken: region ? spokenText(region).trim() : null,
              crossHidden: pill.firstElementChild?.getAttribute('aria-hidden') ?? null,
              ringPoints,
              marksShown,
            };
          })(),
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

        // The live region the notes are spoken through is in the page before the tap (VoiceOver reads
        // changes to a live region that already exists, not one that appears with its words in it).
        const spoken = page.locator('[data-refusal-spoken]');
        await expect(spoken, 'one lasting live region for the notes').toHaveCount(1);
        await expect(spoken).toHaveAttribute('aria-live', 'polite');
        await expect(spoken).toHaveAttribute('role', 'status');
        await expect(spoken).toHaveText('');
        await spoken.evaluate((el) => ((window as any).__spokenBefore = el));

        const before = await snapshot(page);
        await c.tap(taps, before.state);

        const mark = page.locator(`[data-refusal="${c.say.replace(/"/g, '\\"')}"]`);
        await expect(mark, 'the refusal mark comes up with its words').toBeVisible({ timeout: 5_000 });
        await page.screenshot({ path: test.info().outputPath(`${nn}-${c.level}-${motion}.png`) });
        // How the mark looked the moment it came up, as the page recorded it (it may be gone by now on a slow machine).
        const seen = await page.evaluate(() => ((window as any).__refusals as (Seen & { node: unknown })[]).map(({ node: _node, ...r }) => r) as Seen[]);
        expect(seen.map((r) => r.say), 'one mark came up, with these words').toEqual([c.say]);
        const [look] = seen;
        expect(look.sameRegion, 'the note speaks through the region that was there before the tap').toBe(true);
        expect(look.inRegion, 'the note lies inside that live region').toBe(true);
        expect(look.ownRole, 'the note is no live region of its own').toBeNull();
        expect(look.spoken, 'VoiceOver hears the words, not the cross').toBe(c.say);
        expect(look.crossHidden, 'the cross stays hidden from VoiceOver').toBe('true');
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
        await expect(page.locator('[data-refusal-spoken]'), 'the live region stays, empty, for the next note').toHaveText('');
        const gone = await page.evaluate(() => ((window as any).__refusals as (Seen & { node: unknown })[]).map(({ node: _node, ...r }) => r) as Seen[]);
        expect(gone[0].removedAfterMs, 'the mark stays up long enough to read').toBeGreaterThan(1000);
      });
    }
  });
}

/**
 * Level 29 (and 21, which shares its scene): with Hint's rings up, an "Out of reach" note never covers
 * a gold ring. Every empty toadstool the picked cricket can't reach is tapped in turn, and the note's box
 * is searched on a 2-point grid for any point where a ray meets one of Hint's marks.
 */
for (const motion of ['no-preference', 'reduce'] as const) {
  for (const [id, board] of [
    ['cricket-crossing', BOARD_29],
    ['cricket-swap', BOARD_21],
  ] as const) {
    test(`level ${id}: "Out of reach" leaves the Hint rings in view (Reduce Motion ${motion === 'reduce' ? 'on' : 'off'})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
      const level = LEVELS.find((l) => l.id === id)!;
      const taps = new Taps(page, level, page.viewportSize()!);
      await page.addInitScript(READ_SCENE);
      await page.addInitScript(WATCH_REFUSALS);
      await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ quality: 'low', sound: false })), SETTINGS_KEY);
      await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
      await page.goto(`?debug&quality=low#/level/${level.id}`);
      await waitForSession(page, level.id);
      await passRulesCard(page, level.title);
      await page.waitForFunction(() => window.__taps.ready());
      await waitCameraStill(page);
      await waitIdle(page);

      await page.getByRole('button', { name: 'Hint' }).filter({ visible: true }).tap();
      await expect.poll(() => page.evaluate(() => window.__taps.markPoints(4, 0, false).length), { message: "Hint's rings are up" }).toBeGreaterThan(0);

      const s = (await snapshot<CricketState>(page)).state;
      const GAP = 1.55;
      const CAP_TOP = 0.62;
      const cap = (c: number): Vec3 => [((c % board.cols) - (board.cols - 1) / 2) * GAP, CAP_TOP, (Math.floor(c / board.cols) - (board.rows - 1) / 2) * GAP - 0.15];
      const cells = [...s.board].map((_, c) => c);
      let tried = 0;
      for (const from of cells.filter((c) => s.board[c] !== '.' && freeLeaps(s, c, board).length >= 2)) {
        for (const to of cells.filter((c) => s.board[c] === '.' && !board.jars.includes(c) && !freeLeaps(s, from, board).includes(c))) {
          const [x, y, z] = cap(from);
          await taps.tapWorld([x, y + 0.25, z], `the cricket on toadstool ${from}`);
          await page.waitForTimeout(400);
          await taps.tapWorld(cap(to), `toadstool ${to}, out of reach`);
          const mark = page.locator('[data-refusal="Out of reach"]');
          await expect.poll(() => page.evaluate(() => (window as any).__refusals.length), { message: 'the note came up' }).toBe(tried + 1);
          if (tried === 0) await page.screenshot({ path: test.info().outputPath(`${id}-hint-${motion}.png`) });
          // Measured by the page the moment the note came up: in the screen, and over no point of a Hint ring.
          const look = await page.evaluate((i) => {
            const { node: _node, ...r } = (window as any).__refusals[i];
            return r as Seen;
          }, tried);
          expect(look.inView, `the note lies in the screen (${JSON.stringify(look.rect)})`).toBe(true);
          expect(look.marksShown, "Hint's rings are up while the note shows").toBeGreaterThan(0);
          expect(look.ringPoints, `points of a Hint ring under the note (cricket ${from}, toadstool ${to}, at ${JSON.stringify(look.rect)})`).toBe(0);
          tried++;
          await expect(mark).toHaveCount(0, { timeout: 5_000 });
          // Put the cricket down again, so the next pick starts clean.
          await taps.tapWorld([x, y + 0.25, z], `the cricket on toadstool ${from} again`);
          await page.waitForTimeout(300);
        }
      }
      expect(tried, 'some toadstool was out of reach').toBeGreaterThan(0);
      expect((await snapshot(page)).moves.length, 'no move was made').toBe(0);
    });
  }
}

/**
 * Larger Text (docs/larger-text.md): every refused tap of every case above, at the standard text size and the
 * largest, with Hint's marks up. The note's words grow with the setting (twice at the largest), show whole, and
 * the note covers no point of a Hint mark and no button of the scene or the HUD, on the iPhone sizes and the iPad.
 * The website build follows the setting with `?debug` (textSize.ts), as the app does.
 */
const NOTE_SIZE = (width: number) => Math.round(Math.max(14, Math.min(18, width / 48)));
for (const text of [
  { name: 'the standard text size', body: SYSTEM_BODY.standard, grow: 1 },
  { name: 'the largest text size', body: SYSTEM_BODY.ax5, grow: 2 },
] as const) {
  test.describe(`at ${text.name}, with Hint up`, () => {
    test.use({ reducedMotion: 'reduce' });
    for (const c of CASES) {
      const level = LEVELS.find((l) => l.id === c.level)!;
      const nn = String(level?.number).padStart(2, '0');
      test(`level ${nn} ${c.level}: "${c.say}" grows with the words and covers no mark or button`, async ({ page }) => {
        const view = page.viewportSize()!;
        const taps = new Taps(page, level, view);
        await setSystemBodySize(page, text.body);
        await page.addInitScript(READ_SCENE);
        await page.addInitScript(WATCH_REFUSALS);
        await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ quality: 'low', sound: false })), SETTINGS_KEY);
        await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
        await page.goto(`?debug&quality=low#/level/${level.id}`);
        await waitForSession(page, level.id);
        await passRulesCard(page, level.title);
        await page.waitForFunction(() => window.__taps.ready());
        await expect(page.locator('html')).toHaveAttribute('data-text-grow', String(text.grow));
        for (const [i, m] of (c.setup ?? []).entries()) await playMove(page, m, i + 1);
        await waitCameraStill(page);
        await waitIdle(page);

        await page.getByRole('button', { name: 'Hint' }).filter({ visible: true }).tap();
        // Most levels draw a mark for the next move; a few answer in words only. Either way Hint is up.
        const marked = await expect
          .poll(() => page.evaluate(() => window.__taps.markPoints(4, 0, false).length), { timeout: 4_000 })
          .toBeGreaterThan(0)
          .then(() => true, () => false);
        test.info().annotations.push({ type: 'hint marks', description: marked ? 'shown' : 'none for this state' });

        const before = await snapshot(page);
        await c.tap(taps, before.state);
        await expect.poll(() => page.evaluate(() => (window as any).__refusals.length), { message: 'the note came up' }).toBe(1);
        await page.screenshot({ path: test.info().outputPath(`${nn}-${c.level}-text-${text.grow}.png`) });
        const look = await page.evaluate(() => {
          const { node: _node, ...r } = (window as any).__refusals[0];
          return r as Seen;
        });
        test.info().annotations.push({ type: 'note', description: JSON.stringify({ rect: look.rect, fontSize: look.fontSize, marks: look.marksShown }) });
        expect(look.say).toBe(c.say);
        expect(look.growth, 'the text size in force').toBe(text.grow);
        expect(look.fontSize, 'the words grow with the text size').toBeCloseTo(NOTE_SIZE(view.width) * text.grow, 0);
        expect(look.wordsWhole, `every word shows whole (${JSON.stringify(look.rect)})`).toBe(true);
        expect(look.inView, `the note lies in the screen (${JSON.stringify(look.rect)})`).toBe(true);
        expect(look.ringPoints, `points of a Hint mark under the note (at ${JSON.stringify(look.rect)})`).toBe(0);
        expect(look.buttonsCovered, `buttons under the note (at ${JSON.stringify(look.rect)})`).toEqual([]);
        expect(look.pointer, 'the note takes no touch').toBe('none');
        expect((await snapshot(page)).moves.length, 'the refused tap made no move').toBe(before.moves.length);
        await expect(page.locator('[data-refusal]'), 'the note clears by itself').toHaveCount(0, { timeout: 5_000 });
      });
    }
  });
}

/**
 * The hint's words are drawn above the scene, and so above the note. A refused tap while they show must still
 * be answered in view: the note steps aside from them (`data-refusal-avoid` on the hint toast) as it does from
 * a button. Here the hint is held up (its 5-second timer never fires), and the note is followed on every drawn
 * frame of its life: its box never meets the hint's, it stays in the screen, its words show whole, and it covers
 * no button of the scene or the HUD. At the standard text size and the largest, each case a test of its own.
 */
const HOLD_HINT = () => {
  const w = window as any;
  const plain = window.setTimeout.bind(window);
  // Only the hint's own timer is 5 s long (PlayScreen.tsx): it is kept from firing, so the hint stays up.
  (window as any).setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => (ms === 5000 ? plain(() => {}, 2 ** 31 - 1) : plain(fn, ms, ...rest))) as typeof setTimeout;
  w.__underHint = [];
  new MutationObserver(() => {
    const pill = document.querySelector<HTMLElement>('[data-refusal]');
    if (!pill || w.__underHint.some((u: any) => u.el === pill)) return;
    const box = pill.parentElement!;
    const life: any = { el: pill, frames: 0, toastFrames: 0, worst: 0, worstAt: null, outOfView: 0 };
    w.__underHint.push(life);
    const look = () => {
      if (!pill.isConnected) return;
      const b = box.getBoundingClientRect();
      const toast = document.querySelector<HTMLElement>('[data-testid="hint-toast"]');
      life.frames++;
      if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight) life.outOfView++;
      if (toast) {
        life.toastFrames++;
        const q = toast.getBoundingClientRect();
        const px = Math.max(0, Math.min(q.right, b.right) - Math.max(q.left, b.left)) * Math.max(0, Math.min(q.bottom, b.bottom) - Math.max(q.top, b.top));
        if (px > life.worst) {
          life.worst = Math.round(px);
          life.worstAt = { note: [b.left, b.top, b.right, b.bottom].map(Math.round), hint: [q.left, q.top, q.right, q.bottom].map(Math.round) };
        }
      }
      requestAnimationFrame(look);
    };
    look();
  }).observe(document, { childList: true, subtree: true });
};

for (const text of [
  { name: 'the standard text size', body: SYSTEM_BODY.standard, grow: 1 },
  { name: 'the largest text size', body: SYSTEM_BODY.ax5, grow: 2 },
] as const) {
  test.describe(`at ${text.name}, with the hint's words held up`, () => {
    test.use({ reducedMotion: 'reduce' });
    for (const c of CASES) {
      const level = LEVELS.find((l) => l.id === c.level)!;
      const nn = String(level?.number).padStart(2, '0');
      test(`level ${nn} ${c.level}: "${c.say}" is never under the hint`, async ({ page }) => {
        const view = page.viewportSize()!;
        const taps = new Taps(page, level, view);
        await setSystemBodySize(page, text.body);
        await page.addInitScript(READ_SCENE);
        await page.addInitScript(WATCH_REFUSALS);
        await page.addInitScript(HOLD_HINT);
        await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ quality: 'low', sound: false })), SETTINGS_KEY);
        await seedProgress(page, Object.fromEntries(LEVELS.filter((l) => l.number < level.number).map((l) => [l.id, 3])));
        await page.goto(`?debug&quality=low#/level/${level.id}`);
        await waitForSession(page, level.id);
        await passRulesCard(page, level.title);
        await page.waitForFunction(() => window.__taps.ready());
        await expect(page.locator('html')).toHaveAttribute('data-text-grow', String(text.grow));
        for (const [i, m] of (c.setup ?? []).entries()) await playMove(page, m, i + 1);
        await waitCameraStill(page);
        await waitIdle(page);

        await page.getByRole('button', { name: 'Hint' }).filter({ visible: true }).tap();
        const toast = page.getByTestId('hint-toast');
        await expect(toast).toBeVisible();
        // Let it spring in and take its place (and any lift over a scene button) before the tap.
        await page.waitForTimeout(800);

        const before = await snapshot(page);
        await c.tap(taps, before.state);
        await expect.poll(() => page.evaluate(() => (window as any).__refusals.length), { message: 'the note came up' }).toBe(1);
        await page.waitForTimeout(300);
        await page.screenshot({ path: test.info().outputPath(`${nn}-${c.level}-text-${text.grow}-hint-up.png`) });
        await expect(page.locator('[data-refusal]'), 'the note clears by itself').toHaveCount(0, { timeout: 5_000 });
        await expect(toast, 'the hint is still up after the note').toBeVisible();

        const look = await page.evaluate(() => {
          const { node: _node, ...r } = (window as any).__refusals[0];
          return r as Seen;
        });
        const life = await page.evaluate(() => {
          const { el: _el, ...r } = (window as any).__underHint[0];
          return r as { frames: number; toastFrames: number; worst: number; worstAt: unknown; outOfView: number };
        });
        test.info().annotations.push({ type: 'note', description: JSON.stringify({ rect: look.rect, life }) });
        expect(look.say).toBe(c.say);
        expect(look.growth, 'the text size in force').toBe(text.grow);
        expect(life.frames, 'the note was followed over its life').toBeGreaterThan(1);
        expect(life.toastFrames, 'the hint showed on every frame of the note').toBe(life.frames);
        expect(life.worst, `square pixels of the note under the hint, at worst (${JSON.stringify(life.worstAt)})`).toBe(0);
        expect(life.outOfView, 'frames with the note partly off the screen').toBe(0);
        expect(look.wordsWhole, `every word shows whole (${JSON.stringify(look.rect)})`).toBe(true);
        expect(look.buttonsCovered, `buttons under the note (at ${JSON.stringify(look.rect)})`).toEqual([]);
        expect((await snapshot(page)).moves.length, 'the refused tap made no move').toBe(before.moves.length);
      });
    }
  });
}
