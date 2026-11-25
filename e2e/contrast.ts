import type { Locator, Page } from '@playwright/test';
import { inflateSync } from 'node:zlib';

/**
 * Measures how well the text on a screen reads against what is drawn behind it, from pictures of the
 * real page. See docs/text-contrast.md.
 *
 * The page is photographed four times without moving: as it is, with its text see-through (what is
 * behind the letters, without the text's soft shadow), and with its text pure black and pure white.
 * The pixels that differ most between the black and the white picture lie fully inside a letter. For each
 * of them the colour in the first picture is the text and the colour in the second is its background, and
 * the two give a WCAG contrast. The same is done for the line icons of buttons (drawn with a stroke).
 */

/** WCAG's bars: 4.5 for text, 3 for large text (24px, or 18.66px bold) and for icons. */
export const TEXT_BAR = 4.5;
export const LARGE_BAR = 3;

export interface Reading {
  /** The words, cut to 48 letters, or the icon's button name. */
  text: string;
  kind: 'text' | 'icon';
  /** Font size in CSS px, and weight; 0 for an icon. */
  size: number;
  weight: number;
  bar: number;
  /** The contrast at the worst pixel inside the letters. */
  worst: number;
  /** 95% of the letters' area reads at least this. */
  p5: number;
  /** The same 5th percentile with the text's own shadow left in the background. */
  p5WithShadow: number;
  /** How many pixels lay fully inside the letters. */
  pixels: number;
  /** Inside a disabled control: WCAG sets no bar for those. */
  disabled: boolean;
  /** Level card readings: "open" or "locked". */
  state?: string;
  /** The text colour and the background colour at the worst pixel. */
  ink: string;
  behind: string;
}

interface Picture {
  width: number;
  height: number;
  /** RGBA, 4 bytes a pixel. */
  data: Uint8Array;
}

/** Reads an 8-bit RGB or RGBA PNG, which is what a browser screenshot is. */
export function decodePng(file: Buffer): Picture {
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const parts: Buffer[] = [];
  while (at < file.length) {
    const length = file.readUInt32BE(at);
    const type = file.toString('latin1', at + 4, at + 8);
    const body = file.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const colour = body[9];
      if (body[8] !== 8 || (colour !== 2 && colour !== 6) || body[12] !== 0) throw new Error(`unsupported PNG (depth ${body[8]}, colour ${colour}, interlace ${body[12]})`);
      channels = colour === 2 ? 3 : 4;
    } else if (type === 'IDAT') parts.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const lines = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const from = y * (stride + 1) + 1;
    const to = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? lines[to + x - channels] : 0;
      const up = y > 0 ? lines[to + x - stride] : 0;
      const upLeft = y > 0 && x >= channels ? lines[to + x - stride - channels] : 0;
      let add = 0;
      if (filter === 1) add = left;
      else if (filter === 2) add = up;
      else if (filter === 3) add = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      lines[to + x] = (raw[from + x] + add) & 255;
    }
  }
  if (channels === 4) return { width, height, data: lines };
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < lines.length; i += 3, j += 4) {
    data[j] = lines[i];
    data[j + 1] = lines[i + 1];
    data[j + 2] = lines[i + 2];
    data[j + 3] = 255;
  }
  return { width, height, data };
}

const LINEAR = Float64Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const luminance = (d: Uint8Array, i: number) => 0.2126 * LINEAR[d[i]] + 0.7152 * LINEAR[d[i + 1]] + 0.0722 * LINEAR[d[i + 2]];
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hex = (d: Uint8Array, i: number) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');

/** WCAG contrast of two colours given as [r, g, b]. */
export function contrastOf(a: [number, number, number], b: [number, number, number]) {
  return ratio(luminance(Uint8Array.from(a), 0), luminance(Uint8Array.from(b), 0));
}

/** What counts as text here: everything but decoration, which is marked aria-hidden in the page. */
const WORDS = '*:not([aria-hidden="true"]):not([aria-hidden="true"] *)';
const ICONS = 'svg[stroke="currentColor"]:not([aria-hidden="true"]):not([aria-hidden="true"] *)';
/** Nothing may move between the four pictures. The map's drifting lights are held at their home places. */
const STILL = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
.blur-3xl{transform:translate(-50%,-50%)!important}`;
const DECORATION = '[aria-hidden="true"],[aria-hidden="true"] *';
// Decoration keeps its own look in every picture: the fill is inherited, so it is handed back by name.
const paint = (colour: string, shadow: boolean) =>
  `${WORDS}{-webkit-text-fill-color:${colour}!important;${shadow ? '' : 'text-shadow:none!important;'}}
${DECORATION}{-webkit-text-fill-color:currentcolor!important}
${ICONS},${ICONS} *{stroke:${colour}!important}`;
/** A title filled with a gradient is drawn by its own background, cut to the letters: take that away too. */
const NO_FILLED_LETTERS = '[data-contrast-clip]{background-image:none!important}';

interface Found {
  id: number;
  text: string;
  kind: 'text' | 'icon';
  size: number;
  weight: number;
  disabled: boolean;
  state?: string;
  rects: { x: number; y: number; w: number; h: number }[];
}

/** Lists every piece of text and every line icon on the page, with where its lines are drawn. Runs in the page. */
function findText(): Found[] {
  const ids: Map<Element, number> = ((window as any).__contrastIds ??= new Map());
  const idOf = (e: Element) => {
    if (!ids.has(e)) ids.set(e, ids.size + 1);
    return ids.get(e)!;
  };
  type Box = { x: number; y: number; w: number; h: number };
  /** The part of a line that its scrolling boxes let through: text scrolled out of a card is not on the screen. */
  const shown = (e: Element, r: DOMRect): Box | null => {
    let [left, top, right, bottom] = [Math.max(r.left, 0), Math.max(r.top, 0), Math.min(r.right, innerWidth), Math.min(r.bottom, innerHeight)];
    for (let up = e.parentElement; up; up = up.parentElement) {
      const cs = getComputedStyle(up);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const c = up.getBoundingClientRect();
      [left, top, right, bottom] = [Math.max(left, c.left), Math.max(top, c.top), Math.min(right, c.right), Math.min(bottom, c.bottom)];
    }
    return right - left >= 1 && bottom - top >= 1 ? { x: left, y: top, w: right - left, h: bottom - top } : null;
  };
  const out = new Map<Element, Found>();
  const describe = (e: Element, kind: 'text' | 'icon', text: string): Found => {
    const cs = getComputedStyle(e);
    const card = e.closest('button[aria-label^="Level "]');
    return {
      id: idOf(e),
      text: text.replace(/\s+/g, ' ').trim().slice(0, 48),
      kind,
      size: kind === 'icon' ? 0 : parseFloat(cs.fontSize),
      weight: kind === 'icon' ? 0 : Number(cs.fontWeight) || 400,
      disabled: !!e.closest('[disabled],[aria-disabled="true"]'),
      state: card ? (/, locked$/.test(card.getAttribute('aria-label')!) ? 'locked' : 'open') : undefined,
      rects: [],
    };
  };
  for (const e of document.querySelectorAll('*')) {
    if (getComputedStyle(e).backgroundClip === 'text') e.setAttribute('data-contrast-clip', '');
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent!.trim()) continue;
    const e = node.parentElement!;
    if (e.closest('[aria-hidden="true"]') || getComputedStyle(e).visibility === 'hidden') continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      const box = shown(e, r);
      if (!box) continue;
      if (!out.has(e)) out.set(e, describe(e, 'text', e.textContent!));
      out.get(e)!.rects.push(box);
    }
  }
  for (const e of document.querySelectorAll('svg[stroke="currentColor"]')) {
    if (e.closest('[aria-hidden="true"]')) continue;
    const box = shown(e, e.getBoundingClientRect());
    if (!box) continue;
    const owner = e.closest('button,a,[role="img"]');
    const found = describe(e, 'icon', `icon: ${owner?.getAttribute('aria-label') ?? owner?.textContent ?? ''}`);
    found.rects.push(box);
    out.set(e, found);
  }
  return [...out.values()];
}

type Keyed = Reading & { id: number };

/** Measures everything that is on the screen now. */
async function measureNow(page: Page): Promise<Keyed[]> {
  const found = await page.evaluate(findText);
  const shot = async (css: string) => {
    const tag = await page.addStyleTag({ content: css });
    const picture = decodePng(await page.screenshot({ scale: 'device', animations: 'disabled', caret: 'hide' }));
    await tag.evaluate((n) => (n as Element).remove());
    return picture;
  };
  const asIs = await shot(':root{}');
  const behind = await shot(paint('transparent', false) + NO_FILLED_LETTERS);
  const behindWithShadow = await shot(paint('transparent', true) + NO_FILLED_LETTERS);
  const black = await shot(paint('#000', false));
  const white = await shot(paint('#fff', false));
  const scale = asIs.width / page.viewportSize()!.width;
  const { width, height } = asIs;

  const readings: Keyed[] = [];
  for (const f of found) {
    const pixels: number[] = [];
    let most = 0;
    for (const r of f.rects) {
      const x0 = Math.max(0, Math.floor(r.x * scale));
      const y0 = Math.max(0, Math.floor(r.y * scale));
      const x1 = Math.min(width, Math.ceil((r.x + r.w) * scale));
      const y1 = Math.min(height, Math.ceil((r.y + r.h) * scale));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          const d = Math.min(white.data[i] - black.data[i], white.data[i + 1] - black.data[i + 1], white.data[i + 2] - black.data[i + 2]);
          if (d < 60) continue;
          if (d > most) most = d;
          pixels.push(i, d);
        }
      }
    }
    // Fully inside a letter: as different between black and white as the text gets here (faded text differs less).
    const values: number[] = [];
    const withShadow: number[] = [];
    let worst = Infinity;
    let worstAt = 0;
    for (let k = 0; k < pixels.length; k += 2) {
      if (pixels[k + 1] < most * 0.94) continue;
      const i = pixels[k];
      const ink = luminance(asIs.data, i);
      const v = ratio(ink, luminance(behind.data, i));
      values.push(v);
      withShadow.push(ratio(ink, luminance(behindWithShadow.data, i)));
      if (v < worst) {
        worst = v;
        worstAt = i;
      }
    }
    if (values.length < 12) continue;
    const p5 = (list: number[]) => list.sort((a, b) => a - b)[Math.floor(list.length * 0.05)];
    const large = f.kind === 'icon' || f.size >= 24 || (f.size >= 18.66 && f.weight >= 700);
    readings.push({
      id: f.id,
      text: f.text,
      kind: f.kind,
      size: f.size,
      weight: f.weight,
      bar: large ? LARGE_BAR : TEXT_BAR,
      worst,
      p5: p5(values),
      p5WithShadow: p5(withShadow),
      pixels: values.length,
      disabled: f.disabled,
      state: f.state,
      ink: hex(asIs.data, worstAt),
      behind: hex(behind.data, worstAt),
    });
  }
  return readings;
}

/**
 * Measures a whole screen. With `scroller`, the list is walked from its start to its end, in steps of
 * two thirds of its size, and each text keeps its lowest reading among the stops where it was whole
 * (a label that sticks while the list moves is read over every background it meets).
 */
export async function measureContrast(page: Page, scroller?: Locator): Promise<Reading[]> {
  await page.addStyleTag({ content: STILL });
  const best = new Map<number, Keyed[]>();
  const take = async () => {
    for (const r of await measureNow(page)) best.set(r.id, [...(best.get(r.id) ?? []), r]);
  };
  if (!scroller) await take();
  else {
    await scroller.evaluate((e) => e.scrollTo(0, 0));
    for (let stop = 0; stop < 80; stop++) {
      // Sections of the upright map fade in as they come into view.
      await page.waitForTimeout(900);
      await take();
      const more = await scroller.evaluate((e) => {
        const before = [e.scrollLeft, e.scrollTop];
        e.scrollBy({ left: Math.round(e.clientWidth * 0.66), top: Math.round(e.clientHeight * 0.66), behavior: 'instant' });
        return e.scrollLeft !== before[0] || e.scrollTop !== before[1];
      });
      if (!more) break;
    }
  }
  const out: Reading[] = [];
  for (const seen of best.values()) {
    const whole = Math.max(...seen.map((r) => r.pixels)) * 0.9;
    const { id: _, ...lowest } = seen.filter((r) => r.pixels >= whole).reduce((a, b) => (b.p5 < a.p5 ? b : a));
    out.push(lowest);
  }
  return out;
}

/** The readings as lines of a table, for a log. */
export function contrastLines(where: string, readings: Reading[]): string[] {
  return readings.map((r) => {
    const low = r.p5 < r.bar ? (r.disabled ? 'low (disabled)' : 'LOW') : '';
    const what = r.kind === 'icon' ? 'icon          ' : `${r.size.toFixed(1).padStart(5)}px w${r.weight}`;
    return `${where.padEnd(34)} ${r.p5.toFixed(2).padStart(5)} worst ${r.worst.toFixed(2).padStart(5)} shadow-in ${r.p5WithShadow.toFixed(2).padStart(5)} bar ${r.bar.toFixed(1)} ${what} ${(r.state ?? '').padEnd(6)} ${r.ink} on ${r.behind} ${low.padEnd(14)} ${JSON.stringify(r.text)}`;
  });
}
