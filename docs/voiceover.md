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
- When a card closes, the focus goes back to the control that opened it. If that one is gone, switched off or
  was never there (the rules card opens by itself), it goes to the play screen's Rules button; from the lose
  card to Undo, where Undo can still be used. So VoiceOver and a keyboard read on from a control, not from
  the top of the page. The focus moves without scrolling, and shows a ring only after a key press, never
  after a tap (`apps/web/src/focusReturn.ts`).
- The "This level can't be shown" card lies over everything, the rules card too. While it is up it has the
  focus, and what lies under it is `inert`: out of reach for VoiceOver and the keyboard, as it is for a finger.

## The tests

- `apps/web/src/spoken.test.ts` (with `pnpm test`, so on every change): reads the source of the shell, the
  shared packages and every level, and fails on a `button`, `Button`, `motion.button` or `a` that has neither
  a label nor words of its own that VoiceOver can read. Words that CSS hides at some screen size
  (`hidden sm:inline`) are no name: on a phone they are not read. It also holds the play screen to what it
  says without a button: the move counter's role and words, the hint's live region, the canvas's role and
  name, and the cards' dialog role.
- `e2e/tests/voiceover.spec.ts` (with the play-through tests, in both builds): opens the level map, each About
  page, the reset question, a level's rules card and play screen, and the lose and win cards, looks up every
  control in view in the browser's accessibility tree, and fails on any with no name. On the play screen it
  also asks for the counter as a named picture whose count follows the moves, the scene as a named picture,
  and the hint inside a live region that was in the page before the hint. It closes each card, by taps and
  by keys, and fails if the focus is left on the page, if a ring shows after a tap, or if anything scrolled.
  And it brings up the "can't be shown" card over the rules card, and fails if the focus or the Tab key can
  get under it.
