# Larger Text

In the iPhone and iPad app, the game's words follow the text size the player picked in Settings, Display &
Text Size, Larger Text, the accessibility sizes included. This is what Apple's optional Larger Text
accessibility label asks for: the words of the app's common tasks can grow to about twice their size.

## How it works

A web view does not follow the setting by itself. WebKit does give the font keyword `-apple-system-body`
the size of iOS's body text at the chosen setting, and changes it when the setting changes.
`apps/web/src/textSize.ts` puts a hidden probe in the page that wears that font, reads its size and writes
how much the words grow to `--text-grow` on `<html>` (and to `data-text-grow`, for the tests):

| Setting                  | iOS body text | `--text-grow`       |
| ------------------------ | ------------- | ------------------- |
| Extra small to medium    | 14 to 16 pt   | 1 (the game's own)  |
| Large (the standard)     | 17 pt         | 1                   |
| The three larger ones    | 19 to 23 pt   | 1.12 to 1.35        |
| Accessibility 1 and 2    | 28 and 33 pt  | 1.65 and 1.94       |
| Accessibility 3 to 5     | 40 to 53 pt   | 2 (the most)        |

The probe's box changes size with its font, so a `ResizeObserver` sees a changed setting at once; coming
back to the app checks again. No native code is needed, and it works on every iOS the app supports.

`index.css` multiplies every text size of the shell by it: Tailwind's `text-xs` to `text-xl` fully, the
title sizes (`text-2xl` and up) by half the growth, as iOS's own titles grow less than its body text, and the
body's size for words with no size of their own. The game's in-between sizes are utilities there too
(`text-2xs` for 11px, `text-15`, `text-card-title`, `text-map-title`). **Use these, not `text-[11px]`:** an
arbitrary size does not grow. Line heights are ratios, so they grow with the words. Spacing, icons, stars and
the 3D scenes stay as they are.

The website does not follow the setting: the probe is only put in the page by the app build, and by the
website with `?debug`, so the tests can reach the win and loss cards. Elsewhere (Chromium, desktop Safari) the
keyword is unknown or small, the probe keeps its plain 17px, and nothing changes.

## Layouts that change when the words have grown

The `grown:` style variant (`index.css`) and `useTextGrown()` (`textSize.ts`) are for the few places that
need another layout then. At the standard size every one of them is as before.

- **Level map, sideways:** the cards widen with the words, and the number medallion makes way: the number moves
  to the card's top row, beside the stars, and the title and tagline take the card, the tagline no longer cut
  to two lines. The "30 legendary puzzles" pill beside the title is left out. The world labels grow in height.
- **Level map, upright and on iPad:** the cards grow in height with their words.
- **Rules card:** the column of controls scrolls above "Let's go!", which stays in view (on a taller screen
  from a third of its height), and on an iPad the card widens.
- **Win and loss cards:** their buttons are pinned below the words, which scroll if they must; the win card
  takes two columns on a phone held sideways.
- **Play screen, sideways:** the move counter drops its noun ("best 7", not "crossings · best 7"), and the
  first-play guide sits below the top bar, not beside it.
- **About, sideways:** the page tabs scroll if they no longer fit above the version line.
- **About, the reset question:** the card widens, so its two buttons can stay side by side.
- **Hint and first-play guide, on taller screens:** they keep their gap to the bottom and top bars, which grow
  with the words.

## What does not grow

- Words drawn in a 3D scene: the levels' name tags, labels, ledgers and buttons over the scene (drei's `Html`).
  They are sized in pixels to fit the scene's own drawing and would cover it if they grew.
- The level number in a map card's medallion, and the big numbers drawn behind the wide map's cards and the
  loading curtain: pictures more than words, and VoiceOver reads each card's number from its name.
- The emoji in the win and loss titles grow with the title (half), like the title.

## Checking it

- `e2e/textFit.ts` reads every line of text as the browser laid it out against every box that clips it, finds
  words cut short, clipped or drawn over each other, and buttons out of reach.
- `e2e/tests/larger-text.spec.ts` runs it at the first accessibility size and the largest, on the map and every
  About page (app build) and on the rules, win and loss cards and the play screen (website with `?debug`), at
  the iPhone sizes of the play-through config. It also checks that the standard size changes nothing and that
  the website ignores the setting.
- On a device: see the owner's how-to, or set Settings, Accessibility, Display & Text Size, Larger Text, turn on
  Larger Accessibility Sizes, drag the slider to the end, and come back to the game.
