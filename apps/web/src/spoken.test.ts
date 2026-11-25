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

/** True if these children give the control words that VoiceOver reads. Any {expression} counts: it is text at run time. */
function speaks(children: readonly ts.JsxChild[]): boolean {
  return children.some((c) => {
    if (ts.isJsxText(c)) return /[\p{L}\p{N}]/u.test(c.text);
    if (ts.isJsxExpression(c)) return !!c.expression;
    if (ts.isJsxElement(c)) return !hiddenAttr(c.openingElement) && speaks(c.children);
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
});
