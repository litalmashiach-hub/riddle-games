/**
 * TEST ONLY. A stand-in for the few parts of Playwright's Page and Locator that the real-tap players
 * (e2e/taps/players) use, over a Backend that can run a script in the page and touch the screen.
 * In the simulator the backend is Appium: scripts go through Safari's Web Inspector, touches through
 * XCTest, as a finger's would. Locally it is Chromium, to try the runner before a Mac run.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Backend {
  /** Runs `(fnSource)(arg)` in the page and returns its JSON result. */
  exec<T>(fnSource: string, arg?: unknown): Promise<T>;
  /** One real touch at a point of the web view, in its CSS pixels (= points). */
  tap(x: number, y: number): Promise<void>;
  /** One finger down, moved, and up. */
  drag(from: Point, to: Point, opts: { steps: number; stepMs: number; holdMs: number }): Promise<void>;
  screenshot(file: string): Promise<void>;
  size(): { width: number; height: number };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Match = { s: string; re: boolean; flags?: string; exact?: boolean };
const toMatch = (v: string | RegExp, exact?: boolean): Match => (typeof v === 'string' ? { s: v, re: false, exact } : { s: v.source, re: true, flags: v.flags });
type Step = { kind: 'css'; css: string } | { kind: 'role'; role: string; name?: Match } | { kind: 'text'; text: Match } | { kind: 'hasText'; text: Match };

interface Found {
  visible: boolean;
  text: string;
  inner: string;
  name: string;
  box: { x: number; y: number; width: number; height: number };
  disabled: boolean;
}

export class FakeLocator {
  constructor(
    readonly page: FakePage,
    readonly steps: Step[],
    readonly nth = 0,
  ) {}
  private q(): Promise<Found[]> {
    return this.page.evaluate((spec: { steps: Step[] }) => (window as any).__appq(spec), { steps: this.steps });
  }
  private async one(): Promise<Found | undefined> {
    const all = await this.q();
    // Like a finger: the first one that can be seen, else the first one.
    return all.filter((f) => f.visible)[this.nth] ?? all[this.nth];
  }
  filter(o: { hasText: string | RegExp }) {
    return new FakeLocator(this.page, [...this.steps, { kind: 'hasText', text: toMatch(o.hasText) }]);
  }
  first() {
    return new FakeLocator(this.page, this.steps, 0);
  }
  locator(css: string) {
    return new FakeLocator(this.page, [...this.steps, { kind: 'css', css }]);
  }
  getByRole(role: string, o: { name?: string | RegExp; exact?: boolean } = {}) {
    return new FakeLocator(this.page, [...this.steps, { kind: 'role', role, name: o.name === undefined ? undefined : toMatch(o.name, o.exact) }]);
  }
  getByText(t: string | RegExp, o: { exact?: boolean } = {}) {
    return new FakeLocator(this.page, [...this.steps, { kind: 'text', text: toMatch(t, o.exact) }]);
  }
  async count() {
    return (await this.q()).length;
  }
  async isVisible() {
    return (await this.q()).some((f) => f.visible);
  }
  async waitFor(o: { state?: 'visible' | 'hidden' | 'attached' | 'detached'; timeout?: number } = {}) {
    const state = o.state ?? 'visible';
    const end = Date.now() + (o.timeout ?? 30_000);
    for (;;) {
      const all = await this.q();
      const ok = state === 'visible' ? all.some((f) => f.visible) : state === 'hidden' ? !all.some((f) => f.visible) : state === 'attached' ? all.length > 0 : all.length === 0;
      if (ok) return;
      if (Date.now() > end) throw new Error(`timed out waiting for ${this.describe()} to be ${state}`);
      await sleep(200);
    }
  }
  async textContent(): Promise<string | null> {
    const f = await this.one();
    if (!f) throw new Error(`${this.describe()} not found`);
    return f.text;
  }
  async innerText(): Promise<string> {
    const f = await this.one();
    if (!f) throw new Error(`${this.describe()} not found`);
    return f.inner;
  }
  async boundingBox() {
    const f = await this.one();
    return f ? f.box : null;
  }
  /** A real touch on the middle of the element, once it shows. */
  async tap(o: { timeout?: number } = {}) {
    await this.waitFor({ state: 'visible', timeout: o.timeout ?? 30_000 });
    const f = (await this.one())!;
    const p = { x: f.box.x + f.box.width / 2, y: f.box.y + f.box.height / 2 };
    const { width, height } = this.page.backend.size();
    if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) throw new Error(`${this.describe()} is at (${Math.round(p.x)}, ${Math.round(p.y)}), outside the ${width} by ${height} screen`);
    this.page.lastTap = { what: this.describe(), at: p };
    await this.page.backend.tap(p.x, p.y);
  }
  /** Runs a function on the element in the page, as Playwright's Locator.evaluate does. */
  evaluate<R, A>(fn: (el: Element, arg: A) => R, arg?: A): Promise<Awaited<R>> {
    return this.page.evaluate((x: { steps: Step[]; nth: number; src: string; arg: unknown }) => (window as any).__appEval({ steps: x.steps }, x.nth, x.src, x.arg), {
      steps: this.steps,
      nth: this.nth,
      src: fn.toString(),
      arg,
    }) as Promise<Awaited<R>>;
  }
  click(o: { timeout?: number } = {}) {
    return this.tap(o);
  }
  describe() {
    return this.steps
      .map((s) => (s.kind === 'css' ? s.css : s.kind === 'role' ? `${s.role}${s.name ? ` "${s.name.s}"` : ''}` : s.kind === 'text' ? `text "${s.text.s}"` : `has text "${s.text.s}"`))
      .join(' > ');
  }
}

export class FakePage {
  lastTap: { what: string; at: Point } | null = null;
  constructor(readonly backend: Backend) {}

  /** Runs a function in the page, as Playwright's page.evaluate does. */
  evaluate<R, A = undefined>(fn: ((arg: A) => R) | string, arg?: A): Promise<Awaited<R>> {
    const src = typeof fn === 'string' ? `() => (${fn})` : fn.toString();
    return this.backend.exec<Awaited<R>>(src, arg);
  }
  async waitForFunction<A>(fn: (arg: A) => unknown, arg?: A, o: { timeout?: number; polling?: number } = {}) {
    const end = Date.now() + (o.timeout ?? 30_000);
    let lastError = '';
    for (;;) {
      try {
        if (await this.evaluate(fn as any, arg)) return;
      } catch (e) {
        lastError = String(e).slice(0, 300);
      }
      if (Date.now() > end) throw new Error(`timed out waiting for ${fn.toString().slice(0, 160)}${lastError ? ` (last error: ${lastError})` : ''}`);
      await sleep(o.polling ?? 200);
    }
  }
  waitForTimeout(ms: number) {
    return sleep(ms);
  }
  viewportSize() {
    return this.backend.size();
  }
  getByRole(role: string, o: { name?: string | RegExp; exact?: boolean } = {}) {
    return new FakeLocator(this, []).getByRole(role, o);
  }
  getByText(t: string | RegExp, o: { exact?: boolean } = {}) {
    return new FakeLocator(this, []).getByText(t, o);
  }
  getByLabel(t: string | RegExp, o: { exact?: boolean } = {}) {
    return new FakeLocator(this, [{ kind: 'role', role: '__labelled', name: toMatch(t, o.exact) }]);
  }
  locator(css: string) {
    return new FakeLocator(this, [{ kind: 'css', css }]);
  }
  touchscreen = {
    tap: (x: number, y: number) => this.backend.tap(x, y),
  };
  screenshot(file: string) {
    return this.backend.screenshot(file);
  }
}

