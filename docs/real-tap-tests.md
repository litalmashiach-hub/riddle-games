# Real-tap tests

The play-through tests (`docs/play-through-tests.md`) win 29 of the 30 levels through the `?debug`
hook: they prove that the game works, not that a finger can play it. This second run wins every level
by touches on the 3D scene itself, and names each level and step where a touch does not do what a
player means.

It is a run of its own, with its own folder (`e2e/taps`), its own Playwright config and its own
commands. The play-through tests are unchanged and do not run it.

```bash
pnpm install
pnpm test:e2e:taps          # pnpm build, then every level at 852 by 393
pnpm test:e2e:taps:all      # pnpm build, then every level at all three sizes
pnpm test:e2e:taps:built    # no build: the tests against the apps/web/dist that is already there
```

Run one part (after a build):

```bash
pnpm test:e2e:taps:built --project=iphone-small-landscape    # one size
pnpm test:e2e:taps:built --project=iphone-landscape -g "level 18"
```

| Project | Size | Stands for |
| --- | --- | --- |
| `iphone-landscape` | 852 by 393 | a current iPhone |
| `iphone-small-landscape` | 667 by 375 | a small iPhone |
| `iphone-large-landscape` | 956 by 440 | the largest iPhone |

One size takes about 26 to 31 minutes on four cores without a graphics card (measured on main after #70: 852 wide 27.5 min, 667 wide 26.4, 956 wide 30.5), so run one size per command where a command has a time limit. The browser version is
the one the play-through tests use (see that guide).

## What a test does

For each level, `e2e/taps/tests/levels-by-taps.spec.ts`:

1. opens the level as a player who has solved the earlier ones, and taps the rules card away;
2. waits until the camera has landed;
3. takes the shortest solution from the game's own solver, and for each move asks the level's
   *player* (`e2e/taps/players/NN-name.ts`) to make the touches for it;
4. checks that the session then holds exactly one more move, and that it leads to the same state as
   the move aimed at; then waits for the game's own move lock;
5. at the end expects the win card, three stars, the shortest move count, no hint used, and the
   stars saved.

Like the play-through tests it fails on a page error, a console error, a failed request or a request
to another host.

## What counts as a real touch

- A move is only ever made by `page.touchscreen.tap`, by a finger-down, move, finger-up sequence
  (a drag), or by a tap on a button that the level itself puts on the page (level 1's "Row across").
- The `?debug` hook is only read (the state, the moves made). `play`, `undo`, `redo`, `restart` and
  the hint are never called.
- A touch is aimed where a player would aim: the middle of the thing as it is drawn. A player finds
  the thing as the listening 3D object that stands at the thing's place (the place comes from the
  level's own layout code) and taps the middle of the screen box of what that object draws. Where the
  object that listens draws nothing (an unseen pad on an islet, a ring on the water), the tap goes to
  the middle of the drawn thing it stands for; each such case is said in a comment in its player.
- Two players aim another way, and say why. Level 7 taps each bird on its visible middle (see below).
  Level 2 taps each passenger on its *clear middle*
  (`tapClear` in `harness.ts`), the middle of the part of it that lies outside the other figures'
  drawn boxes. On the left bank the goat stands close in front of the cabbage; its head turns all the
  time and its unseen tap sphere ends right at the middle of the cabbage's box, so a tap on that middle
  picked the cabbage in some runs and the goat in others. A person taps the cabbage where it is clear
  of the goat. The point is worked out from what the scene draws, never from where a tap lands.
- No spot is found by trial, no offset is tuned until a tap lands, and no touch is tried twice.
- Before each touch the run asks the page what lies on top at that point. If it is not the scene
  (a bar, a button, a label), that is a fault: `covered`.

To learn where things are, the run reads the 3D scene of the untouched build: it puts a
devtools-style hook on the page before the game starts, to which React hands the 3D root
(`READ_SCENE` in `e2e/taps/harness.ts`). Nothing in the game was changed for this run, and nothing
was added to the `?debug` hook.

## When a touch fails

A player stops the level with a `TapFault`: the step (the move's number), a kind, and what happened.

| Kind | Meaning |
| --- | --- |
| `covered` | A page element lies over the spot. |
| `off-screen` | The spot is outside the screen. |
| `wrong-pick` | The touch picked another thing than the one aimed at, before any move. |
| `no-response` | The touch did nothing that shows. |
| `no-move` | All touches for the move were made, and no move followed. |
| `wrong-move` | A move followed, but another one. |
| `no-win` | Every move was made and the win card did not show. |

The test attaches every touch it made (where, what was on top, which listening object a ray from that
point reaches first) and a screenshot, and writes both under
`test-results/taps/results/<project>/NN-<level id>.json` and `...-fault.png`.

**Do not mend the player to get past a real fault, and do not skip the test.** If the aim was honest
and the game lost the touch, add the level to `e2e/taps/known-tap-faults.ts` with the sizes, the step,
the kind and one or two sentences on what happens. The test then ends as an expected failure (a cross
in the list, counted as passed). A fault at another step or of another kind still fails. Once the
level is mended, the test turns red ("Expected to fail, but passed"): remove the entry.

A listed level stops at its first fault, so the steps after it are not proven by this run.

Listed today (the full account of the first run is in the project's report "real-taps", and of this
update in "real-taps/fault-list-update"). In each of these the same touch is lost in some runs and not
in others, so a run that gets past the first listed step may stop at a later one; every step listed
was seen on main in a run of the whole level, at one size or another, and each entry holds for all three sizes:

- Level 11, Family Crossing: a tap on the guard picks Dad (move 1, or move 3), and late in the level
  a tap on the thief picks Mom (move 14).
- Level 18, Log Jam: the tap on the picked log's ring is lost to a log in front of it (move 3,
  17 or 19).
- Level 27, Timber Tangle: the tap on the ring is lost to another log (move 2) or to the picked log
  itself (move 9).

Level 7, Jealous Couples, and level 12, Twelve Coins, are no longer listed: both win by taps at every
size since the tap fix of pull request #70. Level 7's player now taps each bird on its *visible
middle* (`tapVisible` in `harness.ts`): the middle of the part of the bird that the screen shows,
found by casting a ray through each point of the bird's box and keeping the points where the first
drawn mesh met is the bird's own. The middle of Mrs Coral's box is drawn over by Mr Teal's top hat,
so a tap there tested a spot where she does not show.

Level 2, Wolf, Goat and Cabbage, is no longer listed: its player taps the cabbage where it is clear of
the goat, and wins at every size. The fault in the game stays: the goat's unseen tap sphere reaches to
the middle of the cabbage on the left bank, so a tap there may pick the goat. That is for a fix in the
level, not in this run.

## Adding a level

A new level needs a player. `e2e/taps/players/index.ts` loads every `NN-name.ts` in its folder that
exports `players`, a record from level id to player; the run's last test fails by name for a level
without one. A level that plays in another level's scene is added to that scene's file (as level 30
is to level 4's). `01-wolf-two-sheep.ts` is the shortest example, and `harness.ts` says what a player
may use.

Waits follow the game, not the clock: the move lock after each move, and inside a move a sign that a
touch took (a button's text, a ring that appears, a figure that reaches its seat). Three players keep
one short fixed pause where the scene gives no sign that can be read (levels 4 and 30, 16 and 25,
21 and 29); each says so.

## Not in CI

`.github/workflows/ci.yml` does not run this. To add it, a job needs, after
`pnpm install --frozen-lockfile`: `pnpm exec playwright install --with-deps chromium`, then
`pnpm test:e2e:taps`, then an upload of `playwright-report/taps/` and `test-results/taps/` as
artifacts (`if: always()`), with a time limit of about 60 minutes. `CI=true` makes the run start its
own server. It could share a job with the play-through tests if both run from one build
(`pnpm build`, `pnpm test:e2e:built`, `pnpm test:e2e:taps:built --project=iphone-landscape`).

## Limits

- Chromium with a phone's size and touch, not Safari on an iPhone. A touch here is one point; a
  finger is a blot about 40 points wide, which may be kinder or harsher than the middle point.
- Only the shortest solution of each level, in the solver's order. Other positions may hide other
  faults.
- Where a level offers a tap and a drag (the logs of levels 18 and 27), the player taps.
- SD graphics (`?quality=low`), as a phone picks by itself.
