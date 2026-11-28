# Memory check

A run by hand, not part of CI. It opens the production build in headless Chromium with a phone-sized
touch screen, enters and leaves levels again and again, plays some of them for minutes and then lets
them sit, and writes what the page holds after each step, one JSON line per sample.

```bash
pnpm build
pnpm test:e2e:memory                                  # SD, 10 entries of 7 levels, 5 min play and idle in 17, 26, 27
MEM_QUALITY=high MEM_ENTRIES=5 MEM_SOAK=120 pnpm test:e2e:memory
MEM_LEVELS=moonbeam-maze MEM_SOAK=0 pnpm test:e2e:memory
```

The settings are listed at the top of `e2e/memory/memory.spec.ts`. The samples go to
`test-results/memory/<quality>.jsonl`. The full SD run takes about 50 minutes without a graphics card.

## What each sample holds

- `gl`: from `e2e/memory/gl-ledger.js`, which counts every WebGL object the page makes and deletes:
  live textures, buffers, framebuffers, renderbuffers, programs, shaders, vertex arrays, and an estimate
  of their bytes (`mb`); how many were ever made (`made`); 3D contexts made and still live; frames a
  second and draw calls a frame.
- `heapMb`: the page's JavaScript heap, after a forced garbage collection.
- `gpuProcessMb`, `rendererMb`: resident memory of the browser's drawing process and of the page's
  process, read from `ps`. Close other Chromium windows while it runs, or they are counted too.

## Reading it

A level that holds nothing shows the same `gl` numbers at every entry, `live` back to 0 after each exit,
`made` that stops rising after the first seconds of play, and a heap that comes back to the same level
after each exit. A heap that rises by a steady step with each entry means something keeps the old
level alive: take two heap snapshots a few entries apart and look at what holds the extra objects.

That is how the renderer leak fixed by `apps/web/src/components/ReleaseOnLeave.tsx` was found.
