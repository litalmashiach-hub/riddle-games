import { describe, expect, it } from 'vitest';

/**
 * VoiceOver reads a button's text aloud, glyphs and all: "Row across ➜" comes out as "Row across right
 * arrow", "🔍 Name the fake" as "magnifying glass tilted left, name the fake". So every button a level
 * draws over its scene must give plain words: either an aria-label free of arrows and emoji, or text
 * whose arrows and emoji all sit in a <span aria-hidden="true">.
 *
 * This reads the levels' source, so it also covers buttons that only show mid-game.
 */
const GLYPH = /[←-⇿⌀-➿⬀-⯿\u{1F000}-\u{1FAFF}]/u;
const HIDDEN = /<span aria-hidden="true">[^<{]*<\/span>/g;

/** The `{…}` or `"…"` value of the first aria-label in `block`, or null if it has none. */
function ariaLabel(block: string): string | null {
  const at = block.indexOf('aria-label=');
  if (at < 0) return null;
  const start = at + 'aria-label='.length;
  if (block[start] === '"') return block.slice(start, block.indexOf('"', start + 1) + 1);
  let depth = 0;
  for (let i = start; i < block.length; i++) {
    if (block[i] === '{') depth++;
    else if (block[i] === '}' && --depth === 0) return block.slice(start, i + 1);
  }
  return block.slice(start);
}

/** What is wrong with the spoken words of each <button> in `source`, as "line N: why". */
function buttonFaults(source: string): string[] {
  const faults: string[] = [];
  for (let at = source.indexOf('<button'); at >= 0; at = source.indexOf('<button', at + 1)) {
    const end = source.indexOf('</button>', at);
    const block = source.slice(at, end < 0 ? undefined : end);
    const line = source.slice(0, at).split('\n').length;
    const label = ariaLabel(block);
    if (label != null) {
      if (GLYPH.test(label)) faults.push(`line ${line}: the aria-label holds an arrow or emoji`);
      if (/aria-label=\{[a-zA-Z.]+\}/.test(block)) {
        // A label taken from a variable: the words are in a `say:` field of this file.
        const said = source.match(/\bsay: (`[^`]*`|'[^']*')/g) ?? [];
        if (!said.length) faults.push(`line ${line}: the aria-label's words were not found (expected "say:" fields)`);
        for (const s of said) if (GLYPH.test(s)) faults.push(`line ${line}: a spoken label holds an arrow or emoji: ${s}`);
      }
    } else {
      if (GLYPH.test(block.replace(HIDDEN, ''))) faults.push(`line ${line}: an arrow or emoji in the button's text is read aloud`);
      if (/>\s*\{[a-zA-Z.]+\}\s*$/.test(block)) faults.push(`line ${line}: the text comes from a variable; give the button an aria-label`);
    }
  }
  return faults;
}

/** Every level's .tsx source, by path: '../../../levels/01-wolf-two-sheep/src/Scene.tsx' and so on. */
const SOURCES = import.meta.glob<string>('../../../levels/*/src/**/*.tsx', { query: '?raw', import: 'default', eager: true });
const FOLDERS = Object.keys(import.meta.glob('../../../levels/*/package.json')).map((p) => p.split('/').slice(-2)[0]!);

describe('the buttons that levels draw are read as plain words', () => {
  it('finds the faults it is meant to find', () => {
    expect(buttonFaults(`<button onClick={go}>Row across ➜</button>`)).toHaveLength(1);
    expect(buttonFaults(`<button onClick={go}>🔍 Name the fake</button>`)).toHaveLength(1);
    expect(buttonFaults(`<button aria-label="Row ➜" onClick={go}>Row ➜</button>`)).toHaveLength(1);
    expect(buttonFaults(`<button onClick={go}>{label}</button>`)).toHaveLength(1);
    expect(buttonFaults(`<button onClick={go}><span aria-hidden="true">🔍</span> Name the fake</button>`)).toEqual([]);
    expect(buttonFaults(`<button aria-label={\`Row \${a ? 'across' : 'back'}\`} onClick={go}>Row ➜</button>`)).toEqual([]);
  });

  it('reads every level', () => {
    expect(FOLDERS.length).toBeGreaterThanOrEqual(30);
    // Levels 23 to 30 reuse an earlier level's scene and have no .tsx of their own.
    expect(Object.values(SOURCES).filter((source) => source.includes('<button')).length).toBeGreaterThanOrEqual(9);
  });

  it.each(FOLDERS)('%s', (level) => {
    const faults = Object.entries(SOURCES)
      .filter(([p]) => p.includes(`/levels/${level}/src/`))
      .flatMap(([p, source]) => buttonFaults(source).map((fault) => `${p.split('/levels/')[1]}, ${fault}`));
    expect(faults).toEqual([]);
  });
});
