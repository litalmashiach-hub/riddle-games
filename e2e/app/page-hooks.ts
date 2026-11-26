/**
 * TEST ONLY. What the run in the simulator puts into the app's web view, as the first script of
 * dist-app/index.html (see prepare-app-build.ts). It only reads: the 3D scene (READ_SCENE from the
 * real-tap harness), page errors and console errors, requests to other hosts, where touches land, and
 * the page's elements for the run's look-ups. It makes no move and presses nothing.
 */
export const PAGE_HOOKS = () => {
  const w = window as any;
  // TEST ONLY, off unless the run asks for it (--fps N sets this key): hands the page at most N frames a
  // second. A hosted Mac has no graphics chip; the simulator's drawing process then takes in frames
  // faster than it can draw them and holds gigabytes of waiting work. The game's code is not changed.
  try {
    const fps = Number(localStorage.getItem('app-test:fps') || 0);
    if (fps > 0) {
      const raf = w.requestAnimationFrame.bind(w);
      const caf = w.cancelAnimationFrame.bind(w);
      const gap = 1000 / fps;
      let nextAt = 0;
      const pending = new Map<number, number>();
      let ids = 0;
      w.requestAnimationFrame = (cb: FrameRequestCallback) => {
        const id = ++ids;
        const now = performance.now();
        nextAt = Math.max(now, nextAt);
        const wait = nextAt - now;
        const t = setTimeout(() => {
          pending.set(id, -raf((ts: number) => { pending.delete(id); cb(ts); }));
        }, wait);
        pending.set(id, t as unknown as number);
        // Every callback asked for before the next slot runs in that slot; the slot after it is one gap later.
        setTimeout(() => { if (performance.now() >= nextAt) nextAt = performance.now() + gap; }, wait + 1);
        return id;
      };
      w.cancelAnimationFrame = (id: number) => {
        const h = pending.get(id);
        if (h === undefined) return;
        pending.delete(id);
        if (h < 0) caf(-h); else clearTimeout(h);
      };
      w.__appFpsCap = fps;
    }
  } catch { /* no storage */ }
  // TEST ONLY, read-only: does sound start and does 3D get its drawing context on this system? Counts
  // sound engines made, their state, sounds started and decoded, and the canvas contexts asked for.
  const probe = { audioContexts: 0, audioStates: [] as string[], soundStarts: 0, decoded: 0, decodeErrors: 0, startErrors: [] as string[], canvas: [] as string[] };
  try {
    for (const name of ['AudioContext', 'webkitAudioContext']) {
      const Real = w[name];
      if (typeof Real !== 'function') continue;
      const Wrapped = function (this: any, ...a: any[]) {
        const c = new Real(...a);
        probe.audioContexts++;
        const i = probe.audioStates.push(String(c.state)) - 1;
        try { c.addEventListener('statechange', () => { probe.audioStates[i] = String(c.state); }); } catch { /* old engine */ }
        return c;
      } as any;
      Wrapped.prototype = Real.prototype;
      w[name] = Wrapped;
    }
    const Src = w.AudioScheduledSourceNode?.prototype ?? w.AudioBufferSourceNode?.prototype;
    if (Src && Src.start) {
      const start = Src.start;
      Src.start = function (this: any, ...a: any[]) {
        try { const r = start.apply(this, a); probe.soundStarts++; return r; } catch (e) { probe.startErrors.push(String(e).slice(0, 200)); throw e; }
      };
    }
    const Base = w.BaseAudioContext?.prototype ?? w.AudioContext?.prototype;
    if (Base && Base.decodeAudioData) {
      const dec = Base.decodeAudioData;
      Base.decodeAudioData = function (this: any, ...a: any[]) {
        const p = dec.apply(this, a);
        if (p && p.then) p.then(() => probe.decoded++, () => probe.decodeErrors++);
        return p;
      };
    }
    const gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...a: any[]) {
      const ctx = (gc as any).call(this, type, ...a);
      if (type !== '2d' && probe.canvas.length < 20) {
        let what = `${type}: ${ctx ? 'ok' : 'NONE'}`;
        try {
          if (ctx && /webgl/.test(type)) {
            const g = ctx as WebGL2RenderingContext;
            what += ` (${g.getParameter(g.VERSION)}; ${g.getParameter(g.SHADING_LANGUAGE_VERSION)}; max texture ${g.getParameter(g.MAX_TEXTURE_SIZE)})`;
          }
        } catch { /* no details */ }
        probe.canvas.push(what);
      }
      return ctx;
    } as any;
  } catch (e) {
    probe.startErrors.push('probe setup: ' + String(e).slice(0, 200));
  }
  w.__appProbe = () => ({
    ...probe,
    liveAudioStates: probe.audioStates.slice(),
    userAgent: navigator.userAgent,
    cssLayers: typeof w.CSSLayerBlockRule === 'function',
    webgl2: typeof w.WebGL2RenderingContext === 'function',
  });
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
  /** Runs `fn(element, arg)` on the n-th visible (else n-th) element of a look-up, as Locator.evaluate does. */
  w.__appEval = (spec: { steps: any[] }, n: number, src: string, arg: unknown) => {
    const all = find(spec);
    const el = all.filter(visible)[n] ?? all[n];
    if (!el) throw new Error('element not found');
    return (0, eval)(`(${src})`)(el, arg);
  };
  /** Puts the n-th element of a look-up into view (used only where the report says so). */
  w.__appScrollTo = (spec: { steps: any[] }, n: number) => {
    const el = find(spec)[n];
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    return true;
  };
};
