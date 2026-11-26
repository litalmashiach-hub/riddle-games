/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { levelCardName, starTotal } from './spoken';

describe('spoken names', () => {
  const built = { number: 7, title: 'Three Jealous Couples', level: {} };
  it('a level card says its stars, or why it has none', () => {
    expect(levelCardName(built, 2, true)).toBe('Level 7: Three Jealous Couples, 2 of 3 stars');
    expect(levelCardName(built, 1, true)).toBe('Level 7: Three Jealous Couples, 1 of 3 stars');
    expect(levelCardName(built, 0, true)).toBe('Level 7: Three Jealous Couples, not solved yet');
    expect(levelCardName(built, 0, false)).toBe('Level 7: Three Jealous Couples, locked');
    expect(levelCardName({ number: 31, title: 'Soon' }, 0, true)).toBe('Level 31: Soon, coming soon');
  });
  it('the star total reads as a count', () => {
    expect(starTotal(5, 90)).toBe('5 of 90 stars');
  });
});

/**
 * Every button in the game's source has a spoken name: a label, or words of its own that are not hidden from
 * VoiceOver. An icon alone is read as "button" and nothing more. The play-through test e2e/tests/voiceover.spec.ts
 * checks the same in the built game, screen by screen; this one runs with the unit tests on every push.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CONTROL_TAGS = new Set(['button', 'Button', 'motion.button', 'a']);
const NAME_ATTRS = new Set(['aria-label', 'aria-labelledby', 'title']);

function sources(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === 'node_modules' || f === 'dist' || f === 'dist-app') continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) out.push(p);
    }
  };
  for (const top of ['apps/web/src', 'packages', 'levels']) walk(join(ROOT, top));
  return out;
}

const attrs = (el: ts.JsxOpeningLikeElement) => el.attributes.properties;
const hasAttr = (el: ts.JsxOpeningLikeElement, names: Set<string>) =>
  attrs(el).some((a) => ts.isJsxSpreadAttribute(a) || (ts.isJsxAttribute(a) && names.has(a.name.getText())));
const hiddenAttr = (el: ts.JsxOpeningLikeElement) =>
  attrs(el).some((a) => ts.isJsxAttribute(a) && a.name.getText() === 'aria-hidden' && (!a.initializer || /true/.test(a.initializer.getText())));

/**
 * True if the element's classes take it off the screen at some screen size: `hidden` or `invisible`, alone or
 * behind a size (`short:hidden`). VoiceOver does not read what CSS removes, so "hidden sm:inline" names a
 * control on a wide screen and leaves it nameless on a phone. `sr-only` is the opposite, and is read.
 */
const HIDING_CLASS = /(^|[\s"'`:])(hidden|invisible)(?=$|[\s"'`])/;
const cssHides = (el: ts.JsxOpeningLikeElement) =>
  attrs(el).some((a) => ts.isJsxAttribute(a) && a.name.getText() === 'className' && !!a.initializer && HIDING_CLASS.test(a.initializer.getText()));

/**
 * True if these children give the control words that VoiceOver reads on every screen. Any {expression} counts:
 * it is text at run time. Words inside an element that is hidden from VoiceOver, or that CSS hides, do not.
 */
function speaks(children: readonly ts.JsxChild[]): boolean {
  return children.some((c) => {
    if (ts.isJsxText(c)) return /[\p{L}\p{N}]/u.test(c.text);
    if (ts.isJsxExpression(c)) return !!c.expression;
    if (ts.isJsxElement(c)) return !hiddenAttr(c.openingElement) && !cssHides(c.openingElement) && speaks(c.children);
    if (ts.isJsxFragment(c)) return speaks(c.children);
    return false;
  });
}

export function unnamedControls(file: string, text = readFileSync(file, 'utf8')): string[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (n: ts.Node) => {
    let open: ts.JsxOpeningLikeElement | undefined;
    let children: readonly ts.JsxChild[] = [];
    if (ts.isJsxElement(n)) [open, children] = [n.openingElement, n.children];
    else if (ts.isJsxSelfClosingElement(n)) open = n;
    if (open && CONTROL_TAGS.has(open.tagName.getText()) && !hiddenAttr(open) && !hasAttr(open, NAME_ATTRS) && !speaks(children)) {
      const { line } = sf.getLineAndCharacterOfPosition(open.getStart());
      found.push(`${relative(ROOT, file)}:${line + 1} <${open.tagName.getText()}>`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

describe('every button has a spoken name', () => {
  it('in the source of the shell, the shared packages and every level', () => {
    const files = sources();
    expect(files.length).toBeGreaterThan(10);
    expect(files.flatMap((f) => unnamedControls(f))).toEqual([]);
  });

  it('the check finds an icon-only button, and passes a labelled one', () => {
    expect(unnamedControls('x.tsx', 'const A = () => <Button onClick={go}><UndoIcon /></Button>;')).toHaveLength(1);
    expect(unnamedControls('x.tsx', 'const A = () => <button><span aria-hidden>➜</span></button>;')).toHaveLength(1);
    expect(unnamedControls('x.tsx', 'const A = () => <Button aria-label="Undo"><UndoIcon /></Button>;')).toEqual([]);
    expect(unnamedControls('x.tsx', 'const A = () => <Button><UndoIcon />Undo</Button>;')).toEqual([]);
  });

  it('a word that CSS hides at some screen size is no name', () => {
    // The play screen's Undo button as it is, bar its label: on a phone the word is not shown, so it is not read.
    expect(unnamedControls('x.tsx', 'const A = () => <Button><UndoIcon /><span className="hidden sm:inline short:hidden">Undo</span></Button>;')).toHaveLength(1);
    expect(unnamedControls('x.tsx', 'const A = () => <Button><UndoIcon /><span className={`short:hidden ${x}`}>Undo</span></Button>;')).toHaveLength(1);
    expect(unnamedControls('x.tsx', 'const A = () => <Button><UndoIcon /><span className="invisible">Undo</span></Button>;')).toHaveLength(1);
    expect(unnamedControls('x.tsx', 'const A = () => <Button aria-label="Undo"><UndoIcon /><span className="hidden sm:inline">Undo</span></Button>;')).toEqual([]);
    // Read by VoiceOver though not seen, and a class that merely holds the word "hidden".
    expect(unnamedControls('x.tsx', 'const A = () => <Button><UndoIcon /><span className="sr-only">Undo</span></Button>;')).toEqual([]);
    expect(unnamedControls('x.tsx', 'const A = () => <Button><UndoIcon /><span className="overflow-hidden">Undo</span></Button>;')).toEqual([]);
  });
});

/**
 * What the play screen shows without a button is spoken too: the move counter, a hint as it appears, and the
 * 3D scene. Each needs its role as well as its words: VoiceOver skips a label on a plain box, and reads a hint
 * out only from a live region. Taking one of them away leaves every control named, so it is checked here by name.
 * The play-through test checks the same in the built game.
 */
describe('the play screen says what it shows', () => {
  const file = join(ROOT, 'apps/web/src/screens/PlayScreen.tsx');
  const text = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements: ts.JsxOpeningLikeElement[] = [];
  const calls: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) elements.push(n);
    if (ts.isCallExpression(n)) calls.push(n.getText().replace(/\s+/g, ' '));
    ts.forEachChild(n, visit);
  };
  visit(sf);
  /** An attribute's value as written, without its quotes or braces; undefined if the element has no such attribute. */
  const attr = (el: ts.JsxOpeningLikeElement, name: string) => {
    const a = attrs(el).find((x) => ts.isJsxAttribute(x) && x.name.getText() === name) as ts.JsxAttribute | undefined;
    return a?.initializer?.getText().replace(/^\{([\s\S]*)\}$/, '$1').replace(/^(["'`])([\s\S]*)\1$/, '$2');
  };

  it('the move counter: a picture named with the moves made and the best', () => {
    const counter = elements.filter((el) => /moveCount/.test(attr(el, 'aria-label') ?? ''));
    expect(counter, 'one element is labelled with the move count').toHaveLength(1);
    expect(attr(counter[0], 'role'), 'a label on a plain box is not read: the counter needs role="img"').toBe('img');
    expect(attr(counter[0], 'aria-label')).toBe('${moveCount} ${level.moveNoun}, best ${level.bestMoves}');
    expect(hiddenAttr(counter[0])).toBe(false);
  });

  it('the hint: shown inside a live region that is always in the page', () => {
    const region = elements.filter((el) => attr(el, 'data-testid') === 'hint-spoken');
    expect(region, 'the hint has its wrapper').toHaveLength(1);
    expect(attr(region[0], 'role'), 'the wrapper is a live region').toBe('status');
    expect(attr(region[0], 'aria-live')).toBe('polite');
    expect(hiddenAttr(region[0])).toBe(false);
    // The hint's words are inside it, and it is not itself inside something that comes and goes with the hint.
    const node = region[0].parent as ts.JsxElement;
    expect(node.getText(), 'the hint text is inside the live region').toMatch(/\{hintText\}/);
    for (let p: ts.Node = node.parent; p; p = p.parent) {
      expect(ts.isConditionalExpression(p) || (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken), 'the live region is always rendered').toBe(false);
    }
  });

  it('the 3D scene: a picture named after its level', () => {
    expect(calls, 'the canvas has role="img"').toContain("gl.domElement.setAttribute('role', 'img')");
    expect(calls.some((c) => c.startsWith("gl.domElement.setAttribute('aria-label', `Level ${level.number}: ${level.title}")), 'the canvas is named after the level').toBe(true);
  });

  it('the cards: named dialogs', () => {
    const dialog = elements.filter((el) => attr(el, 'role') === 'dialog');
    expect(dialog).toHaveLength(1);
    expect(attr(dialog[0], 'aria-label')).toBe('label');
    expect(attr(dialog[0], 'aria-modal')).toBe('true');
  });
});
