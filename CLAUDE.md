# Riddle Games

3D browser riddle game. pnpm monorepo: `apps/web` (shell), `packages/engine|fx|props` (shared), `levels/NN-name` (one per riddle).

- Building a level: follow `docs/adding-a-level.md` and `docs/art-direction.md`. Level 1 (`levels/01-wolf-two-sheep`) is the reference implementation.
- Before pushing: `pnpm typecheck && pnpm test && pnpm build`.
- In a level PR, only touch your level folder plus its registration lines (`apps/web/src/levels.ts`, `apps/web/package.json`, README row). Shared-package changes go in their own small PR.
- Screenshots in headless Chromium: use `?all&quality=low&debug#/level/<id>` and a small viewport; HD mode is very slow without a GPU.
- Don't use N8AO from @react-three/postprocessing: it crashes with three 0.187.
