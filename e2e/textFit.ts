import type { Page } from '@playwright/test';

/**
 * Larger Text checks (docs/larger-text.md): with the words grown, does every word of the shell still show
 * whole, and can every button still be reached? Words drawn inside a 3D scene (a level's own labels) are left
 * out: they keep their sizes.
 *
 * Read from the real page: each line of text, as the browser laid it out, against every box that clips it.
 * A box that scrolls does not count as clipping in the direction it scrolls (the words are reached by
 * scrolling), but the scrolling box itself must be whole on the screen.
 */

/** Makes the text size probe of textSize.ts read `px`, as WebKit would at that Larger Text setting. Before `goto`. */
export async function setSystemBodySize(page: Page, px: number) {
  await page.addInitScript((size) => {
    const add = () => {
      const style = document.createElement('style');
      style.textContent = `[data-text-size-probe]{font-size:${size}px!important}`;
      document.head.append(style);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add);
  }, px);
}

/** The body text sizes of iOS (points) at the settings measured here. */
export const SYSTEM_BODY = {
  /** The standard size, where nothing changes. */
  standard: 17,
  /** The largest size without the accessibility sizes. */
  xxxLarge: 23,
  /** The first accessibility size. */
  ax1: 28,
  /** The two largest accessibility sizes. Both give the game's most growth, twice. */
  ax4: 47,
  ax5: 53,
} as const;

export interface TextFault {
  kind: 'clipped' | 'off-screen' | 'cut short' | 'overlap' | 'button out of reach';
  text: string;
  detail: string;
}

/** Every fault on the screen as it is now. An empty list is a pass. */
export function textFaults(page: Page): Promise<TextFault[]> {
  return page.evaluate(() => {
    const faults: { kind: string; text: string; detail: string }[] = [];
    const vw = innerWidth;
    const vh = innerHeight;
    const short = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 48);
    const inScene = (e: Element) => !!e.closest(':has(> canvas)');
    const shown = (e: Element) => {
      for (let p: Element | null = e; p; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.visibility === 'hidden' || c.display === 'none' || Number(c.opacity) < 0.05) return false;
        // Kept for VoiceOver alone (`sr-only`): a 1 by 1 box that clips its words.
        if (c.position === 'absolute' && parseFloat(c.width) <= 1 && parseFloat(c.height) <= 1 && c.overflow === 'hidden') return false;
      }
      return true;
    };
    type R = { left: number; top: number; right: number; bottom: number };
    /** The box that may show `e`'s content: its clipping ancestors, up to a scrolling one in each direction, and the screen. */
    const clipFor = (e: Element) => {
      const box: R = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
      let scrollX = false;
      let scrollY = false;
      for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const c = getComputedStyle(p);
        const r = p.getBoundingClientRect();
        const sx = /auto|scroll/.test(c.overflowX);
        const sy = /auto|scroll/.test(c.overflowY);
        if (!scrollX && c.overflowX !== 'visible') {
          if (sx) scrollX = true;
          else {
            box.left = Math.max(box.left, r.left);
            box.right = Math.min(box.right, r.right);
          }
        }
        if (!scrollY && c.overflowY !== 'visible') {
          if (sy) scrollY = true;
          else {
            box.top = Math.max(box.top, r.top);
            box.bottom = Math.min(box.bottom, r.bottom);
          }
        }
      }
      // The screen clips too, bar in a direction that scrolls.
      if (!scrollX) {
        box.left = Math.max(box.left, 0);
        box.right = Math.min(box.right, vw);
      }
      if (!scrollY) {
        box.top = Math.max(box.top, 0);
        box.bottom = Math.min(box.bottom, vh);
      }
      return { box, scrollX, scrollY };
    };
    /** What of `e`'s content is in view now: inside every box that clips it, scrolling ones too, and the screen. */
    const inView = (e: Element, r: R): R => {
      const v = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, vw), bottom: Math.min(r.bottom, vh) };
      for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const c = getComputedStyle(p);
        if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
        const b = p.getBoundingClientRect();
        if (c.overflowX !== 'visible') { v.left = Math.max(v.left, b.left); v.right = Math.min(v.right, b.right); }
        if (c.overflowY !== 'visible') { v.top = Math.max(v.top, b.top); v.bottom = Math.min(v.bottom, b.bottom); }
      }
      return v;
    };
    const lines: { node: Text; r: DOMRect; el: Element }[] = [];
    const walker = document.createTreeWalker(document.getElementById('root')!, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const el = n.parentElement!;
      // Pictures made of a big number (the loading curtain's, the wide map's) are drawn to run off their card on purpose.
      if (!n.textContent!.trim() || inScene(el) || !shown(el) || el.closest('[aria-hidden="true"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) lines.push({ node: n, r, el });
      const c = getComputedStyle(el);
      if (c.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) faults.push({ kind: 'cut short', text: short(n.textContent!), detail: `ends in "…": ${el.scrollWidth} wide in ${el.clientWidth}` });
      if (c.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1) faults.push({ kind: 'cut short', text: short(n.textContent!), detail: `more lines than shown: ${el.scrollHeight} high in ${el.clientHeight}` });
    }
    const tol = 1.5;
    for (const { node, r, el } of lines) {
      const { box, scrollX, scrollY } = clipFor(el);
      const cut = r.left < box.left - tol || r.right > box.right + tol || r.top < box.top - tol || r.bottom > box.bottom + tol;
      if (cut) {
        const onScreen = r.left >= -tol && r.right <= vw + tol && r.top >= -tol && r.bottom <= vh + tol;
        faults.push({
          kind: onScreen || scrollX || scrollY ? 'clipped' : 'off-screen',
          text: short(node.textContent!),
          detail: `line at ${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)}; shown box ${Math.round(box.left)},${Math.round(box.top)} to ${Math.round(box.right)},${Math.round(box.bottom)}`,
        });
      }
    }
    // Two different texts drawn over each other. Text that sits under a card (a dialog) is not drawn over it.
    const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')];
    const top = dialogs[dialogs.length - 1];
    const live = top ? lines.filter((l) => top.contains(l.el)) : lines;
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const [a, b] = [live[i], live[j]];
        if (a.node === b.node) continue;
        // Only what is in view: words scrolled out of their box are not drawn over anything.
        const [va, vb] = [inView(a.el, a.r), inView(b.el, b.r)];
        const w = Math.min(va.right, vb.right) - Math.max(va.left, vb.left);
        const h = Math.min(va.bottom, vb.bottom) - Math.max(va.top, vb.top);
        // Lines of one paragraph touch by their line boxes; a real overlap covers a good part of a line.
        if (w > 2 && h > Math.min(a.r.height, b.r.height) * 0.35) faults.push({ kind: 'overlap', text: `${short(a.node.textContent!)} / ${short(b.node.textContent!)}`, detail: `${Math.round(w)} by ${Math.round(h)}` });
      }
    }
    // Words drawn over a button that they are not part of.
    const scope = top ?? document.getElementById('root')!;
    const buttons = [...scope.querySelectorAll('button, a[href]')].filter((b) => !inScene(b) && shown(b));
    for (const l of live) {
      const v = inView(l.el, l.r);
      for (const b of buttons) {
        if (b.contains(l.el)) continue;
        const bv = inView(b, b.getBoundingClientRect());
        const w = Math.min(v.right, bv.right) - Math.max(v.left, bv.left);
        const h = Math.min(v.bottom, bv.bottom) - Math.max(v.top, bv.top);
        if (w > 2 && h > 2) faults.push({ kind: 'overlap', text: `${short(l.node.textContent!)} / button ${short(b.getAttribute('aria-label') || b.textContent || '')}`, detail: `${Math.round(w)} by ${Math.round(h)}` });
      }
    }
    // Every button that shows can be reached: wholly inside what may show it.
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const { box } = clipFor(b);
      if (r.left < box.left - tol || r.right > box.right + tol || r.top < box.top - tol || r.bottom > box.bottom + tol) {
        faults.push({ kind: 'button out of reach', text: short(b.getAttribute('aria-label') || b.textContent || ''), detail: `button at ${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)}; shown box ${Math.round(box.left)},${Math.round(box.top)} to ${Math.round(box.right)},${Math.round(box.bottom)}` });
      }
    }
    return faults as never;
  });
}

/** The font size, in CSS px, of the first element matching `selector`: what the tests read to see growth. */
export function fontSizeOf(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
}
