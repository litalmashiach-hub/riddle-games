# Spoken names (VoiceOver)

A blind or low-vision player moves round the game with VoiceOver, which reads each control's name and role.
The game's round glass buttons show icons only, so each one carries a name of its own in `aria-label`.

## The rules

- Every button, link, tab and switch has a name a player would say: "Undo", "Back to levels", "Hint".
  An icon alone is read as "button" and nothing more.
- A toggle is named for what it switches, and says its state: the sound button is "Sound" with
  `aria-pressed`, the About screen's switches are `role="switch"` with `aria-checked`.
- A button whose label is its state names it: the graphics button says "HD graphics" or "SD graphics", as it shows.
- What a picture alone tells is said in words: a level card is "Level 7: Three Jealous Couples, 2 of 3 stars"
  (or "not solved yet", "locked"), the star total is "5 of 90 stars", the move counter is "3 moves, best 7".
  The words live in `apps/web/src/spoken.ts`. A label on a plain `div` is not read, so these carry `role="img"`.
- The 3D scene is one picture to VoiceOver, named after the level ("Level 1: Wolf and Two Sheep, the riddle's
  scene"). Taps inside the scene are not reachable by VoiceOver; a level's own HTML buttons over the scene are.
- The rules, win and lose cards are dialogs with a name, and take the focus when they open, so VoiceOver
  starts reading there. A hint is spoken through a live region as well as shown.
- Emoji that decorate a heading are `aria-hidden`.

## The tests

- `apps/web/src/spoken.test.ts` (with `pnpm test`, so on every change): reads the source of the shell, the
  shared packages and every level, and fails on a `button`, `Button`, `motion.button` or `a` that has neither
  a label nor words of its own that VoiceOver can read.
- `e2e/tests/voiceover.spec.ts` (with the play-through tests, in both builds): opens the level map, each About
  page, the reset question, a level's rules card and play screen, and the lose and win cards, looks up every
  control in view in the browser's accessibility tree, and fails on any with no name.
