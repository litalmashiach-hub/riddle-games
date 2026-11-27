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

Three screen sizes, all with touch and the phone held sideways:

| Project | Size | Stands for |
| --- | --- | --- |
| `iphone-landscape` | 852 by 393 | a current iPhone |
| `iphone-small-landscape` | 667 by 375 | a small iPhone |
| `app-iphone-landscape`, `app-iphone-small-landscape` | the same two | the app build (`apps/web/dist-app`), for `about.spec.ts`, `voiceover.spec.ts` and `contrast.spec.ts` only, and the About check of `touch-layout.spec.ts` |
| `iphone-largest-landscape` | 956 by 440 | the largest iPhone; only `layout.spec.ts` and `touch-layout.spec.ts` run here |

All other files run against the website build. The app build differs from it on the About screen alone
(see `docs/about-screen.md`), so that screen's tests run against both.

| File | What it does |
| --- | --- |
| `e2e/tests/levels.spec.ts` | Every level: opens it as a player who solved the earlier ones, taps through the rules card, plays the shortest solution, and checks the top bar's counter while playing, the win card, three stars, the saved stars, the map's star count, and that the next level opens. Saves a screenshot of each win. |
| `e2e/tests/level-1-by-taps.spec.ts` | Level 1 by taps on the screen alone, from a fresh level map to the win card and on to level 2. Also a loss: the "Oh no!" card, and undo. |
| `e2e/tests/first-play-guide.spec.ts` | Level 1's first-play guide, by taps alone. On a fresh start its ring is over the wolf, then over the boat, and a tap in the ring's middle reaches each through it; its words and Skip keep clear of every button and the counter. It goes after the first crossing and stays gone after an undo and a restart of the app; a wrong first pick (a sheep) keeps it on the wolf; Skip and leaving the level end it for good. No other level shows one on a fresh start. |
| `e2e/tests/progress.spec.ts` | Stars and the sound setting survive a restart of the app; locked levels stay locked; the map lists every level. |
| `e2e/tests/scene-loading.spec.ts` | A level is never a blank screen. The app's loading mark shows until the game has started. A level's loading sign stays until its scene is drawn (the test holds the shaders back). A scene that is still not drawn after the game's 30 second wait gets the card over the sign, never a bare screen, and the card goes by itself if the scene is drawn late. A device that gives no 3D context, or a dead one, gets a card with "Try again" and "All levels", and both work. A context lost while playing brings the same card if it stays lost, and nothing, not even for an instant, if it comes back within a second. |
| `e2e/tests/back-from-background.spec.ts` | Leaving the game and coming back, in every level: at rest (in both orders of leaving: hidden first, then the sound stops; and the usual order on an iPhone, the sound interrupted first, then hidden), in the middle of a move, in the middle of a loss, in the middle of the winning move (its four-note fanfare must be heard once the game has caught up), and a call that comes in during a loss. A test browser's page cannot really be sent away, so the test stands in for the system inside the page: it tells the page that it is hidden, stops every timer and frame while the clock goes on, stops the sound engines from outside, and after five seconds lets all of it go on at once. After each return nothing may be heard of what the game asked for while away or while it caught up, no sound that was cut short may go on, the move or the loss must be finished and Undo must work by touch, and the next tap must sound on an engine whose clock is going. The engines come back "suspended" in one return and "interrupted" in the others (the two states WebKit's own tests show after an interruption). Played at 852 by 393 only. What it cannot show: how iOS itself stops and restarts sound; `packages/fx/src/soundLife.ts` rests there on the Web Audio standard and WebKit's tests, as read. |
| `e2e/tests/rotate-tip.spec.ts` | The "Turn your phone sideways" tip: shown on the website in an upright window up to 600 wide (an iPhone held upright, and iPad windows of 590 and 320 by 820); never shown in the app build, whose upright windows are always an iPad's. Played in `iphone-landscape` and `app-iphone-landscape`. |
| `e2e/tests/layout.spec.ts` | Levels 1 to 3 at all three sizes: the rules card's button is whole without scrolling, and no button, counter or hint text overlaps another or leaves the screen, also with level 3's jug menu open, which must keep clear of both jugs' labels too. |
| `e2e/tests/touch-layout.spec.ts` | Touch areas, at all three sizes, at an iPad's two (1024 by 768, 768 by 1024) and at an upright phone's (393 by 852). Apple asks for 44 by 44 points; some buttons are drawn smaller, and carry an unseen pad (`.touch-44` in `index.css`; levels 3 and 12 pad their own buttons in their `Scene.tsx`). For every button of the play screen's two bars, the rules card, the first-play guide and the "Oh no!" card, the map's two corner buttons, the About screen's back button, its tabs (each chosen in turn; the app build's four are checked in the app projects), Reset progress, and the scenes' own buttons of levels 1, 2, 3, 5, 6, 7, 9, 11 and 12: each point of the 44 by 44 square about the button's middle must reach that button and no neighbour, and no touch more than 4 points beyond the drawing may reach it (7 in level 12, whose "Clues" button is drawn 32 high; 1 for the buttons that are drawn large enough and carry no pad). Each screen is measured once the buttons it names are in view and at rest, with up to 20 seconds to get there. |
| `e2e/tests/hint.spec.ts` | Hint where no win is left: in level 20, after a start that cannot win, a tap on Hint shows the line that says so, whole on the screen and clear of every button, at the project's size and at 956 by 440 (the largest iPhone); no hint is counted. Also: a restart forgets the hints, so the run after it earns three stars. |
| `e2e/tests/contrast.spec.ts` | Text contrast, from pictures of the page (see `docs/text-contrast.md`): every text, number and line icon of the level map (a new player's, with locked cards, and with every level open), of every About page and the reset question, and of the rules, hint, "Oh no!" and "Solved!" cards reads at 4.5 to 1, or 3 to 1 for large text and icons. It sets its own four sizes (three iPhones sideways and an iPad), so it runs in `iphone-landscape` and `app-iphone-landscape` only. |
| `e2e/tests/undo-during-loss.spec.ts` | Every level that can be lost (23 of them): the losing move, then a tap on the bottom bar's Undo through the touch screen as the loss scene begins. The tap must land on Undo and undo before the "Oh no!" card comes; afterwards the level must be exactly as before the losing move (position, move count, the camera on the whole scene), with Redo ready, no card even after the card's time, and no saved stars. The way to each loss is found from the level's own rules. Drawn in software a frame can take a second, so this test alone makes the card wait 20 s longer than in the game; the loss scene itself plays as it does in the game. |
| `e2e/tests/undo-loss-sounds.spec.ts` | What is heard after an undone loss, in every level that can be lost and in both kinds of loss where a level has two (the Moonbeam levels: the toad's sneeze, and the moon setting). Nobody listens: the test watches the browser start each sound, and the page's timers. It plays the loss once to learn which timers start a sound, plays it again with those timers held, taps Undo through the touch screen, and then lets every timer run that the game did not cancel. No sound may start from a timer set during the loss, and no other sound either, bar the ones pieces make going back (listed in the file by level). It hears tones and noise sounds (a splash, a poof) alike. Holding the timers makes the result the same on every run: without it, it would hang on where in a fifth of a second the tap lands. No leftover is let through. |
| `e2e/tests/undo-during-hops.spec.ts` | Levels 18 and 27 only (one scene): Undo while the duck of the loss scene is still hopping, where each hop has a boing. The loss is played once and left alone, then brought back with Redo and undone at several moments of the hops: by a click that a script makes at a set moment, which React treats as no input and so redraws the scene a moment later, and by the Z key, a real input. No boing may start after the undo, and a loss left alone, before the undos and after them, must have one boing for each hop the scene began: on a test page that sets `window.__hopsBegun`, the scene notes each hop as it begins (a page without that list, every player's, skips it). Boings are counted once the scene's sad trombone has played, since the boing of a last hop can come after the loss card. The test hears tones only (the boing is one), not the noise sounds such as the splash. It runs at the phone's sizes and once on a very small page, which draws about twenty frames a second here instead of six. Nothing is held: timers and frames run as they do. A hop begins in a drawn frame, so beside other browsers drawn in software a frame can take two seconds and a hop, with its boing, is never drawn: right for the scene, but nothing to judge. Drawn slowly, the scene also leaves out a last hop that would come after the slip, with its boing: right for the scene, so the count of hops begun is not held to the hops due. The file's tests take turns across workers (a lock in the system's temporary folder), and a loss left alone with no hop begun is played again, up to four times. Every try is judged, so a boing missing only once fails. Other heavy test files beside it can still starve it; then it fails saying the machine was too busy, not that a boing was missing. |

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
- Nothing but level 1's animals and level 3's jugs is tapped by position. Level 1's test asks the page what lies on
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

Listed today: none. Levels 9, 19 and 28 were listed until pull request 50 fixed their page error (a
failed removal of a page element, from the scenes' `<Html>` labels); their entries went with that fix.

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
