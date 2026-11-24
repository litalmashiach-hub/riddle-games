# Play-through tests

`pnpm test` checks each riddle's rules. These tests check the game itself: they open the production
build in a phone-sized browser with a touch screen and play it.

```bash
pnpm install
pnpm test:e2e          # pnpm build and pnpm build:app, then the tests
pnpm test:e2e:built    # the tests alone, against the apps/web/dist and dist-app that are already there
```

Run one part:

```bash
pnpm test:e2e:built --project=iphone-landscape     # one screen size
pnpm test:e2e:built -g "level 12"                  # one level
pnpm test:e2e:built level-1-by-taps                # one file
```

The whole run takes about 50 minutes on four cores without a graphics card, since every scene is
drawn in software at a few frames a second and every move takes as long as its animation.
With a graphics card it is much faster.

## What is tested

Two screen sizes, both with touch and the phone held sideways:

| Project | Size | Stands for |
| --- | --- | --- |
| `iphone-landscape` | 852 by 393 | a current iPhone |
| `iphone-small-landscape` | 667 by 375 | a small iPhone |
| `app-iphone-landscape`, `app-iphone-small-landscape` | the same two | the app build (`apps/web/dist-app`), for `about.spec.ts` only |

All other files run against the website build. The app build differs from it on the About screen alone
(see `docs/about-screen.md`), so that screen's tests run against both.

| File | What it does |
| --- | --- |
| `e2e/tests/levels.spec.ts` | Every level: opens it as a player who solved the earlier ones, taps through the rules card, plays the shortest solution, and checks the top bar's counter while playing, the win card, three stars, the saved stars, the map's star count, and that the next level opens. Saves a screenshot of each win. |
| `e2e/tests/level-1-by-taps.spec.ts` | Level 1 by taps on the screen alone, from a fresh level map to the win card and on to level 2. Also a loss: the "Oh no!" card, and undo. |
| `e2e/tests/progress.spec.ts` | Stars and the sound setting survive a restart of the app; locked levels stay locked; the map lists every level. |
| `e2e/tests/hint.spec.ts` | Hint where no win is left: in level 20, after a start that cannot win, a tap on Hint shows the line that says so, whole on the screen and clear of every button, at the project's size and at 956 by 440 (the largest iPhone); no hint is counted. Also: a restart forgets the hints, so the run after it earns three stars. |

Every test fails if the page throws an error, logs a console error, has a request fail, or asks
anything of another host (the game should make no such request). The few console messages that
are not the game's fault are listed with their reason in `e2e/tests/fixtures.ts`.

## How a level is played

- The moves come from the game's own solver (`packages/engine/src/solver.ts`), run on the level's
  own `rules.ts`. The test also checks that the solution is as long as the level's `bestMoves`.
- The moves are played through the `?debug` hook, `window.__riddle.getState().play(move)`, one at a
  time, each after the last one's animation. Cards and buttons around them are tapped for real.
- `e2e/levels.ts` finds the levels by their folders under `levels/`. A new level needs no change to
  the tests, as long as its `rules.ts` exports `rules`.
  A level that plays in another level's scene (23 to 30) keeps its own puzzle in its own `rules.ts`
  too, built from the first level's `@riddle/level-NN-name/rules` entry, which loads no React or
  Three.js.
- A level folder that the tests cannot load (no `rules.ts`, no `rules` export, no solution) fails
  one test that names the folder and says why. The other levels are still listed and played.
- `?quality=low` is set for the level tests, as on a real phone, where the game picks it by itself.

Only level 1 is played by taps on the 3D scene. A tap needs to know where on the screen an animal
stands, and that is different for every level's scene. Level 1's test reads the camera from the
`?debug` hook to work that out and then taps the touch screen; it copies the animals' places from
the scene's code, so it needs a change if they move.

## Checks that do not depend on the layout

The tests ask the game what it says rather than where it puts it, so they hold when the shell's
layout changes:

- Titles, the best number of moves and the word for a move (`moveNoun`) are read from the running
  level, through the `?debug` hook. Texts on the screen are then compared with them.
- The top bar's counter is found by its "best N" text and must be in view. It is read while the level
  is being played (0 moves after the rules card, 1 after the first move), never under a card: the
  shell may hide the bars while a card is up.
- The win card must say "N <moveNoun>. Perfect, that is the shortest solution!" with the level's own
  numbers and words.
- A level's button on the map is found by "Level N: Title". A locked one may add " (locked)".
  Nothing else may follow the title.
- Nothing but level 1's animals is tapped by position. Level 1's test asks the page what lies on
  top at the spot before it taps, so a bar that moves over an animal fails the test.

## Results

- `test-results/wins/<project>/NN-<level id>.png`: a screenshot of each level's win card.
- `playwright-report/index.html`: the report, with the screenshots attached
  (`pnpm exec playwright show-report`). `playwright-report/results.json` holds the same as data.
- A failed test leaves a screenshot under `test-results/`. For a step-by-step recording, run it
  again with `--trace on`.

Both folders are in `.gitignore`.

## When a test shows a real fault in the game

Do not skip the test, and do not widen the list of ignored console messages for it. Add the level to
`e2e/known-faults.ts`, with one sentence on what is wrong, a pattern for the page error it throws, and
when it comes (`start`: from the tap on "Let's go!" to the end of the first move; `leave`: after the
tap on "All levels"). One such error in that part is set apart. A second one, the same error at any
other moment, and every other error still fail the test. The level also has to play through to its
win. Its test ends as an expected failure (a cross in the list, counted as passed), and turns red
("Expected to fail, but passed") once the fault is fixed, which is the reminder to remove the entry.

Listed today:

- Level 9, Bridge of Five: a page error when play starts after the rules card.
- Level 19, Picture Tiles: a page error when the player leaves the level.
- Level 28, Family Portrait: the same, since it plays in level 19's scene.

All are the same error, a failed removal of a page element, from the scenes' `<Html>` labels.
None stops the level from being won. Pull request 50 fixes it for levels 9 and 19: once that is on
main, their tests turn red as described above, and their entries are to be removed from
`e2e/known-faults.ts`. Level 28's entry goes with level 19's if its test turns red too.

## Browser version

`@playwright/test` is pinned in the root `package.json`. Each Playwright version drives one Chromium
build: install it once with `pnpm exec playwright install chromium`, or use a machine where the
matching one is already present.

## Not in CI yet

The workflow in `.github/workflows/ci.yml` does not run these tests. To add them, a job needs, after
`pnpm install --frozen-lockfile`: `pnpm exec playwright install --with-deps chromium`, then
`pnpm test:e2e`, then an upload of `playwright-report/` and `test-results/wins/` as artifacts
(`if: always()`), with a time limit of about 45 minutes (the run may be slower on a two-core runner). `CI=true` makes the tests start their own
server and refuse a stray `test.only`.

## Limits

This is Chromium with a phone's screen size and touch, not Safari and not an iPhone. It does not
show frame rate, heat, sound, the notch's safe areas, or how touch feels. Those need a real device.
