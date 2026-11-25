# Text contrast

Every text, number and line icon on the level map, the About screen and the cards over a level
reads against what is drawn behind it at WCAG's bars:

- 4.5 to 1 for text,
- 3 to 1 for large text (24px, or 18.66px and bold) and for the line icons of buttons.

`e2e/tests/contrast.spec.ts` holds the game to that, and `e2e/contrast.ts` does the measuring.

```bash
pnpm test:e2e:built contrast                          # the guard
CONTRAST_OUT=some/folder pnpm test:e2e:built contrast # also writes every reading there, pass or fail
CONTRAST_ALL_SIZES=1 pnpm test:e2e:built contrast     # the cards over a level at all four sizes, not one
```

## How it measures

From pictures of the real page, at 2x, not from the style sheet: the map's cards are gradients with
a highlight, and the labels above them sit over lights that drift.

1. The page is photographed as it is; with its text see-through, which shows what is behind the
   letters; and with its text pure black and pure white.
2. The pixels that differ most between the black and the white picture lie fully inside a letter.
   For each, the first picture gives the text's colour and the second its background.
3. A text's reading is the 5th percentile of those pixels' contrasts: 95% of the letters' area reads
   at least that. The log also has the worst single pixel.

- The text's own soft shadow is left out of the background, so it earns nothing. The log has the
  reading with the shadow in as well.
- A text that is faded (`opacity`) is read as it is drawn, faded.
- A list that scrolls is walked from end to end. A label that sticks while the list moves keeps its
  lowest reading.
- The map's drifting lights are held at their home places while the pictures are taken.
- Decoration is left out: whatever is `aria-hidden` (the big faint number on an upright card, the
  stars, emoji). A disabled button is measured and listed, and held to no bar, as in WCAG.

## What keeps the map readable

- A level card's title and line sit on a shade of the card's own colour, which fades out above them.
  The number's disc is dark. Each world keeps its gradient.
- A locked card is dimmed by a grey veil over its colours, and its lock sits on a dark disc. Its
  words stay white: fading them, as before, put them under the bar.
- The small labels over the drifting lights ("World 1", "30 legendary puzzles") sit on a deep blue
  pill. The lights move, so no place behind them is dark for long.
- Buttons and totals over the bright corner of the background use the tinted glass
  (`glass-readout`), as the play screen's counter does.

When a text is added to these screens, the test measures it by itself. To leave a decoration out,
mark it `aria-hidden`.
