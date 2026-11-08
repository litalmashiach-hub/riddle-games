# Adding a level

Each riddle is its own package in `levels/NN-name/`. Level 1 (`levels/01-wolf-two-sheep`) is the
reference: copy its structure.

## 1. Create the package

```
levels/02-wolf-goat-cabbage/
  package.json        name "@riddle/level-02-wolf-goat-cabbage", main "src/index.ts"
  src/rules.ts        pure logic, no React or Three.js
  src/rules.test.ts   proves it is solvable in bestMoves
  src/Scene.tsx       the 3D diorama
  src/index.ts        default-exports the RiddleLevel object
```

Dependencies: `@riddle/engine`, `@riddle/fx`, `@riddle/props` (all `workspace:*`), plus the same
`three`, `@react-three/fiber` and `@react-three/drei` versions as level 1.

## 2. Write the rules (`RiddleRules<State, Move>`)

See `packages/engine/src/types.ts`. State and Move are plain data.

- `initialState`, `legalMoves(state)`, `apply(state, move)` (never mutate), `status(state)` (won / lost with a
  player-facing reason / playing), `key(state)` (unique string; merge symmetric states like identical sheep),
  `describeMove(move, state)` (used by the Hint button, e.g. "Row the goat across").
- The engine's BFS `solve(rules)` must find a solution of exactly `bestMoves` moves. The test enforces it.
- If a move is not legal, don't offer it in the scene (or play `sfx.denied()`); `play()` trusts the scene.

## 3. Build the scene (`SceneProps<State, Move>`)

The shell gives the scene `state`, `previous`, `lastMove`, `status`, `play(move)`, `busy`, `hint`,
`resetCount` and `moveCount`.

- Call `play(move)` for each player move. Input is locked (`busy`) for `moveDurationMs`.
- `moveCount` going up means animate the new move; going down (undo) or `resetCount` changing means move back
  quickly. Use `usePath` / `useHopTo` from `@riddle/fx` so nothing ever teleports.
- Show the `hint` move with `<HintRing>` from `@riddle/props`.
- On a loss, play a short, funny, kid-friendly fail scene (cartoon slapstick, never gore). See
  [Fail scenes](#fail-scenes) below and level 1. Set `endDelayMs` so it plays before the "Oh no!" screen.
- On a win, fire `<Burst>` confetti and make the characters celebrate (`mood="happy"`).
- Do not add lights, sky, fog or post-processing: `WorldStage` does that per world. Add only local lights
  (torches, glowing potions).
- Make tap targets big (add an invisible hit sphere) so it works on phones.
- UI that belongs to the level (like the "Row across" button) can be drawn with drei's `<Html>`.

## 4. Register it

1. Add `"@riddle/level-NN-name": "workspace:*"` to `apps/web/package.json`.
2. In `apps/web/src/levels.ts`, import it and add it to `BUILT`. The `PLAN` entry already exists.
3. Update the status column in `README.md`.

## 5. Check it

```bash
pnpm install && pnpm typecheck && pnpm test && pnpm build
pnpm dev   # open http://localhost:5173/?all#/level/<id>
```

For scripted checks: `?debug&quality=low#/level/<id>` exposes `window.__riddle`, so
`window.__riddle.getState().play(move)` plays a move. Headless Chromium renders slowly, so use
`quality=low` and small viewports for screenshots.

## Rules for parallel work

- Only change files in your own `levels/NN-name/` folder, plus the one import line in `levels.ts`,
  your line in `apps/web/package.json`, and your README row.
- New reusable models (e.g. a jug, a rope bridge) can live in your level first. If another level needs it,
  move it to `packages/props` in a separate, small pull request.
- Don't change the engine contract (`packages/engine/src/types.ts`) in a level PR. Propose it separately.
- Follow [art-direction.md](art-direction.md).

## Fail scenes

Losing should make kids laugh. `@riddle/fx` has a cartoon kit (`packages/fx/src/cartoon.tsx`):

| Piece | What it does |
| --- | --- |
| `usePhases(start, [['windup', 800], ['fight', 1600], ['after', 60000]])` | Runs a timed sequence of beats and returns the current one. Start it with `status.kind === 'lost' && !busy`, so it waits for the move to finish. |
| `<FightCloud position active limbColors>` | The classic boiling dust ball with stars, arms and tails popping out. Hide the fighters while it is active. |
| `<ComicWord position text>` | A big bouncy comic word: "CHOMP!", "MUNCH!", "SPLASH!", "Oops!". |
| `<DizzyStars position>` | Stars circling a dazed head. |
| `<Shake trigger>` | Wrap the scene in it, and bump `trigger` to shake everything on an impact. |
| `<FocusCam target active>` | A dramatic zoom toward the action, which glides back on undo or restart. |
| `<Burst colors power size>` | The confetti burst, reused for flying wool, leaves, feathers and the like. |
| `sfx.boing / scuffle / chomp / burp / poof / squeak / sadTrombone` | Cartoon sounds. |

Props also have gag states, e.g. `<Sheep shorn />` (pink and blushing) and `<Wolf woolBeard />`.

Level 1's beat sheet, as a model: **windup** (the wolf growls, the sheep shows "!", the camera zooms in), then
**fight** (the wolf leaps into a `FightCloud`, "CHOMP!", shake, wool flies), then **after** (the cloud clears:
the sheep is shorn and dizzy, the wolf has a wool beard and burps). Then the "Oh no!" screen. Make the outcome
silly and reversible-looking, never hurt.

Testing tip: headless Chromium renders slowly, so screenshots lag behind the timers. Before playing the losing
move, set `window.__riddle.getState().level.endDelayMs = 60000`. The scene then stays in its final beat
long enough to capture.
