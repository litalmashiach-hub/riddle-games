# Riddle Games

A 3D browser puzzle game: classic logic riddles in 5 worlds, each harder than the last.
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
| 2 | Meadow River | Wolf, Goat and Cabbage | Built |
| 3 | Meadow River | Two Jugs (3 L and 5 L) | Built |
| 4 | Ancient Temple | Tower of Hanoi, 4 discs | Built |
| 5 | Ancient Temple | Bridge and Torch | Built |
| 6 | Ancient Temple | Explorers and Guardians | Built |
| 7 | Sky Islands | Three Jealous Couples | Built |
| 8 | Sky Islands | Three Jugs (8, 5 and 3 L) | Built |
| 9 | Sky Islands | Bridge of Five | Built |
| 10 | Clockwork Citadel | Four-Pillar Tower, 6 discs | Planned |
| 11 | Clockwork Citadel | Family Crossing | Built |
| 12 | Clockwork Citadel | The Twelve Coins | Built |
| 14 | Firefly Lagoon | Firefly Lanterns (Lights Out) | Planned |
| 15 | Firefly Lagoon | Slippery Pond (ice sliding) | Planned |
| 16 | Firefly Lagoon | Firefly Jars (colour sort) | Planned |
| 17 | Firefly Lagoon | Moonbeam Mirrors (light beams) | Planned |
| 18 | Firefly Lagoon | Log Jam (sliding blocks) | Planned |
| 19 | Firefly Lagoon | Picture Tiles (8-puzzle) | Planned |

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
