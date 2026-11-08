# Riddle Games

A 3D browser puzzle game: 12 classic logic riddles in 4 worlds, each harder than the last.
Built with React Three Fiber (Three.js), TypeScript and Vite.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # rules and solver tests
pnpm typecheck
pnpm build      # static site in apps/web/dist
```

Useful URL options:

| Option | What it does |
| --- | --- |
| `#/level/<id>` | Open a level directly, e.g. `#/level/wolf-two-sheep` |
| `?all` | Unlock every built level |
| `?quality=low` / `?quality=high` | Force the graphics preset |
| `?debug` | Expose the game session as `window.__riddle` for scripted play-tests |

## Levels

| # | World | Riddle | Status |
| --- | --- | --- | --- |
| 1 | Meadow River | Wolf and Two Sheep | Built |
| 2 | Meadow River | Wolf, Goat and Cabbage | Planned |
| 3 | Meadow River | Two Jugs (3 L and 5 L) | Planned |
| 4 | Ancient Temple | Tower of Hanoi, 4 discs | Planned |
| 5 | Ancient Temple | Bridge and Torch | Planned |
| 6 | Ancient Temple | Explorers and Guardians | Built |
| 7 | Sky Islands | Three Jealous Couples | Planned |
| 8 | Sky Islands | Three Jugs (8, 5 and 3 L) | Planned |
| 9 | Sky Islands | Bridge of Five | Planned |
| 10 | Clockwork Citadel | Four-Pillar Tower, 6 discs | Planned |
| 11 | Clockwork Citadel | Family Crossing | Planned |
| 12 | Clockwork Citadel | The Twelve Coins | Planned |

## Layout

```
apps/web/            game shell: level map, HUD, menus, win/lose screens
packages/engine/     level contract, session (undo/redo/hints), solver, stars, saved progress
packages/fx/         lighting and sky per world, water shader, post-processing, motion helpers, sound
packages/props/      shared 3D models: farmer, wolf, sheep, boat, river valley, hint ring, bubbles
levels/NN-name/      one package per riddle: rules.ts, Scene.tsx, index.ts, rules.test.ts
docs/                how to add a level, art direction
```

To build a new level, read [docs/adding-a-level.md](docs/adding-a-level.md).
