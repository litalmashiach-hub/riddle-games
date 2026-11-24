/**
 * TEST ONLY. What the run in the simulator puts into the app's web view, as the first script of
 * dist-app/index.html (see prepare-app-build.ts). It only reads: the 3D scene (READ_SCENE from the
 * real-tap harness), page errors and console errors, requests to other hosts, where touches land, and
 * the page's elements for the run's look-ups. It makes no move and presses nothing.
 */
export const PAGE_HOOKS = () => {
  const w = window as any;
  const faults = { pageErrors: [] as string[], consoleErrors: [] as string[], consoleWarnings: [] as string[], outsideRequests: [] as string[] };
  w.__appFaults = faults;
  const cut = (s: unknown) => String(s).slice(0, 600);
  w.addEventListener('error', (e: ErrorEvent) => faults.pageErrors.push(cut(e.error?.stack || e.message)));
  w.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => faults.pageErrors.push(cut('unhandled rejection: ' + ((e.reason as any)?.stack || e.reason))));
  const text = (args: unknown[]) => cut(args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' '));
  const err = console.error.bind(console);
  console.error = (...a: unknown[]) => { faults.consoleErrors.push(text(a)); err(...a); };
  const warn = console.warn.bind(console);
  console.warn = (...a: unknown[]) => { faults.consoleWarnings.push(text(a)); warn(...a); };
  const outside = (u: string) => {
    try {
      const url = new URL(u, location.href);
      if (url.origin !== location.origin && !/^(data|blob):/.test(url.protocol)) faults.outsideRequests.push(url.href);
    } catch { /* not a URL */ }
  };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => outside(e.name))).observe({ type: 'resource', buffered: true });
  } catch { /* old engine */ }
  const f = w.fetch?.bind(w);
  if (f) w.fetch = (input: any, init?: any) => { outside(typeof input === 'string' ? input : input?.url); return f(input, init); };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, m: string, u: string | URL, ...rest: any[]) { outside(String(u)); return (open as any).call(this, m, u, ...rest); } as any;

  // Where touches land, as the page sees them: for the run's calibration and its log.
  const touches: { x: number; y: number; t: number; kind: string; on: string }[] = [];
  w.__appTouches = touches;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target as Element | null;
    touches.push({ x: e.clientX, y: e.clientY, t: Date.now(), kind: e.pointerType, on: el ? el.tagName : '' });
    if (touches.length > 400) touches.splice(0, 200);
  }, true);

  // Look-ups for the run's stand-in of Playwright's locators: by role and name, by text, by CSS.
  const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const nameOf = (el: Element) => {
    const lab = el.getAttribute('aria-label');
    if (lab) return norm(lab);
    const by = el.getAttribute('aria-labelledby');
    if (by) return norm(by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '));
    if (el instanceof HTMLInputElement) return norm(el.value);
    return norm(el.textContent);
  };
  const ROLE: Record<string, string> = {
    button: 'button, [role=button], input[type=button], input[type=submit]',
    heading: 'h1, h2, h3, h4, h5, h6, [role=heading]',
    link: 'a[href], [role=link]',
    tab: '[role=tab]',
    switch: '[role=switch]',
    status: '[role=status]',
    dialog: 'dialog, [role=dialog], [role=alertdialog]',
    alertdialog: '[role=alertdialog]',
    __labelled: '[aria-label]',
  };
  type M = { s: string; re: boolean; flags?: string; exact?: boolean };
  const match = (m: M, value: string) => {
    if (m.re) return new RegExp(m.s, m.flags).test(value);
    return m.exact ? value === norm(m.s) : value.toLowerCase().includes(norm(m.s).toLowerCase());
  };
  const find = (spec: { steps: any[] }): Element[] => {
    let els: Element[] = [document.documentElement];
    for (const st of spec.steps) {
      const next: Element[] = [];
      for (const root of els) {
        if (st.kind === 'css') next.push(...Array.from(root.querySelectorAll(st.css)));
        else if (st.kind === 'role') next.push(...Array.from(root.querySelectorAll(ROLE[st.role] ?? `[role=${st.role}]`)).filter((e) => !st.name || match(st.name, nameOf(e))));
        else if (st.kind === 'text') {
          const all = Array.from(root.querySelectorAll('body *')).filter((e) => !/^(SCRIPT|STYLE)$/.test(e.tagName) && match(st.text, norm(e.textContent)));
          next.push(...all.filter((e) => !all.some((o) => o !== e && e.contains(o))));
        } else if (st.kind === 'hasText') {
          if (match(st.text, norm(root.textContent))) next.push(root);
        }
      }
      els = Array.from(new Set(next));
    }
    return els;
  };
  w.__appq = (spec: { steps: any[] }) =>
    find(spec).map((e) => {
      const r = e.getBoundingClientRect();
      return { visible: visible(e), text: e.textContent ?? '', inner: (e as HTMLElement).innerText ?? '', name: nameOf(e), box: { x: r.x, y: r.y, width: r.width, height: r.height }, disabled: (e as HTMLButtonElement).disabled === true };
    });
  /** Puts the n-th element of a look-up into view (used only where the report says so). */
  w.__appScrollTo = (spec: { steps: any[] }, n: number) => {
    const el = find(spec)[n];
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    return true;
  };
};
