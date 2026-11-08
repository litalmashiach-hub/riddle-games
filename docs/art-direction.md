# Art direction

Original, stylized low-poly 3D. Cozy, bright and toy-like, with real-time lighting that makes it feel premium.
Never copy characters, art or levels from existing games.

## Look

- **Shapes:** chunky low-poly primitives (icosahedrons, cones, capsules) with `flatShading`. Round, friendly
  silhouettes. Characters are about 0.5 to 1.2 units tall.
- **Materials:** use `toon(color)` from `@riddle/props` (a cached flat-shaded `MeshStandardMaterial`). Matte
  (roughness 0.7 to 1). Metal only for coins, gears, scales.
- **Color:** saturated but soft. Each world has a palette in `packages/fx/src/worlds.ts`. Glowing details
  (eyes, potions, torches, crystals) use `emissive` with intensity 2 to 4, which the bloom pass picks up.
- **Light:** `WorldStage` gives the sun, sky, fog, soft reflections, bloom, vignette and filmic tone mapping.
  Characters and props should `castShadow`; ground should `receiveShadow`.

## Motion

- Nothing teleports. Every change animates: hops with an arc, glides for boats, eased in and out.
- Idle life everywhere: breathing, tail wags, swaying trees, bobbing boats, drifting clouds, sparkles.
- Feedback for every tap: hover lift (`<Clickable>`), a sound from `sfx`, a ring or a bubble.
- Failure is funny, not scary: a short reaction (pounce, munch, splash), then the "Oh no!" screen.
- Success is a party: confetti `<Burst>`, characters bounce with `mood="happy"`, win jingle.

## Worlds

| World | Levels | Mood |
| --- | --- | --- |
| Meadow River | 1 to 3 | Sunny meadow, river, wooden boat, sheep and wolves |
| Ancient Temple | 4 to 6 | Warm sunset, sandstone, jade, torches, an underground lake |
| Sky Islands | 7 to 9 | Floating islands above clouds, balloons, crystal bridges, potions |
| Clockwork Citadel | 10 to 12 | Dusk, brass gears, steam, canals, a golden vault |

## Performance

- Keep a level under about 150 draw calls: instance repeated things (grass, coins, discs).
- Respect `useSettings().quality`: on `low`, skip expensive extras (big particle counts, extra lights).
