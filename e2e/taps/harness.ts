import type { Locator, Page } from '@playwright/test';
import type { LevelCase } from '../levels';

/**
 * What a real-tap player may use. Everything here either reads the page or touches the screen.
 * Nothing here makes a move for the player: the debug hook's play(), undo(), redo() and restart()
 * are never called in this run.
 */

export type Vec3 = [number, number, number];
export interface Point {
  x: number;
  y: number;
}

/** A 3D object of the scene that listens for a tap or a press, as the page has it right now. */
export interface Target {
  uuid: string;
  /** The handlers it carries, such as onClick or onPointerDown. */
  handlers: string[];
  visible: boolean;
  /** Where its own origin is in the world. */
  world: Vec3;
  /** Where that origin is drawn. */
  screen: Point;
  /** The screen box of everything drawn under it (meshes that are visible), or null if it draws nothing. */
  drawn: { x0: number; y0: number; x1: number; y1: number } | null;
  /** The screen box of all its meshes, also unseen ones such as a wider grab area. */
  box: { x0: number; y0: number; x1: number; y1: number } | null;
}

/** One touch of the run, as it was made. */
export interface TapRecord {
  step: number;
  what: string;
  kind: 'tap' | 'drag' | 'button';
  at: Point;
  to?: Point;
  /** The page element on top at that point: CANVAS for the scene, else what covers it. */
  onTop: string;
  /** The listening 3D object that a ray from that point reaches first, if any. */
  firstHit: { uuid: string; world: Vec3; distance: number } | null;
}

export type TapFaultKind =
  /** A page element lies over the spot, so the scene never gets the touch. */
  | 'covered'
  /** The spot is outside the screen. */
  | 'off-screen'
  /** The touches for the step were made, and no move followed. */
  | 'no-move'
  /** A touch picked another thing than the one under the finger's aim, before any move was made. */
  | 'wrong-pick'
  /** A move followed, but not the one aimed at. */
  | 'wrong-move'
  /** The touches did what they should, and something on the way did not show (a button, a mark). */
  | 'no-response'
  /** The level did not end in a win after the last move. */
  | 'no-win';

/** A step that a finger could not make. The run stops the level here. */
export class TapFault extends Error {
  constructor(
    public kind: TapFaultKind,
    /** The move's number, from 1. */
    public step: number,
    public detail: string,
  ) {
    super(`step ${step}: ${kind}: ${detail}`);
    this.name = 'TapFault';
  }
}

/**
 * Lets the run read the 3D scene of the untouched build: React hands every root it commits to a
 * devtools hook if one is on the page, and the 3D root's container holds the scene and the camera.
 * Read-only. It is installed before the game's own code runs.
 */
export const READ_SCENE = () => {
  const w = window as any;
  const roots = new Set<any>();
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    isDisabled: false,
    inject(r: unknown) {
      const id = this.renderers.size + 1;
      this.renderers.set(id, r);
      return id;
    },
    onCommitFiberRoot(_id: number, root: unknown) {
      roots.add(root);
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    checkDCE() {},
  };
  /** The live 3D state: scene, camera, the game's own raycaster and its list of listening objects. */
  const three = () => {
    for (const r of roots) {
      const c = r.containerInfo;
      if (c && typeof c.getState === 'function' && c.getState().scene) {
        const st = c.getState();
        if (st.gl?.domElement?.isConnected) return st;
      }
    }
    return null;
  };
  const project = (st: any, x: number, y: number, z: number) => {
    const cam = st.camera;
    cam.updateMatrixWorld();
    const rect = st.gl.domElement.getBoundingClientRect();
    const v = cam.matrixWorldInverse.elements;
    const p = cam.projectionMatrix.elements;
    const ap = (e: number[], a: number, b: number, c: number, d: number) => [
      e[0] * a + e[4] * b + e[8] * c + e[12] * d,
      e[1] * a + e[5] * b + e[9] * c + e[13] * d,
      e[2] * a + e[6] * b + e[10] * c + e[14] * d,
      e[3] * a + e[7] * b + e[11] * c + e[15] * d,
    ];
    const a = ap(v, x, y, z, 1);
    const b = ap(p, a[0], a[1], a[2], a[3]);
    return { x: rect.left + ((b[0] / b[3] + 1) / 2) * rect.width, y: rect.top + ((1 - b[1] / b[3]) / 2) * rect.height, behind: b[3] <= 0 };
  };
  const listens = (o: any) => {
    const h = o.__r3f?.handlers;
    return h ? Object.keys(h).filter((k) => h[k]) : [];
  };
  const shown = (o: any) => {
    for (let n = o; n; n = n.parent) if (!n.visible) return false;
    return true;
  };
  /** Screen box of the meshes under `root`. `all` also counts unseen meshes. */
  const boxOf = (st: any, root: any, all: boolean) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    root.traverse((o: any) => {
      if (!o.geometry || !o.isMesh) return;
      if (!all && !shown(o)) return;
      o.updateWorldMatrix(true, false);
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      const e = o.matrixWorld.elements;
      for (const X of [bb.min.x, bb.max.x])
        for (const Y of [bb.min.y, bb.max.y])
          for (const Z of [bb.min.z, bb.max.z]) {
            const s = project(st, e[0] * X + e[4] * Y + e[8] * Z + e[12], e[1] * X + e[5] * Y + e[9] * Z + e[13], e[2] * X + e[6] * Y + e[10] * Z + e[14]);
            x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y);
          }
    });
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  };
  w.__taps = {
    ready: () => !!three(),
    project: (p: [number, number, number]) => {
      const st = three();
      return st ? project(st, p[0], p[1], p[2]) : null;
    },
    camera: () => {
      const st = three();
      if (!st) return null;
      const c = st.camera;
      return [c.position.x, c.position.y, c.position.z, c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w, c.zoom];
    },
    targets: () => {
      const st = three();
      if (!st) return [];
      const out: any[] = [];
      st.scene.traverse((o: any) => {
        const names = listens(o);
        if (!names.some((n) => n === 'onClick' || n === 'onPointerDown' || n === 'onPointerUp')) return;
        o.updateWorldMatrix(true, false);
        const e = o.matrixWorld.elements;
        const s = project(st, e[12], e[13], e[14]);
        out.push({ uuid: o.uuid, handlers: names, visible: shown(o), world: [e[12], e[13], e[14]], screen: { x: s.x, y: s.y }, drawn: boxOf(st, o, false), box: boxOf(st, o, true) });
      });
      return out;
    },
    /** The listening object that a ray from the screen point reaches first: what the game's own picking would report first. */
    firstHit: (x: number, y: number) => {
      const st = three();
      if (!st) return null;
      const rect = st.gl.domElement.getBoundingClientRect();
      const rc = st.raycaster;
      const o0 = rc.ray.origin.clone();
      const d0 = rc.ray.direction.clone();
      rc.setFromCamera({ x: ((x - rect.left) / rect.width) * 2 - 1, y: -((y - rect.top) / rect.height) * 2 + 1 }, st.camera);
      const hits = rc.intersectObjects(st.internal.interaction, true);
      rc.ray.origin.copy(o0);
      rc.ray.direction.copy(d0);
      for (const h of hits) {
        for (let n = h.object; n; n = n.parent) {
          if (listens(n).length) {
            n.updateWorldMatrix(true, false);
            const e = n.matrixWorld.elements;
            return { uuid: n.uuid, world: [e[12], e[13], e[14]], distance: h.distance };
          }
        }
      }
      return null;
    },
  };
};

declare global {
  interface Window {
    __taps: {
      ready(): boolean;
      project(p: Vec3): (Point & { behind: boolean }) | null;
      camera(): number[] | null;
      targets(): Target[];
      firstHit(x: number, y: number): TapRecord['firstHit'];
    };
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
export const fmt = (p: Point) => `(${Math.round(p.x)}, ${Math.round(p.y)})`;
export const fmt3 = (p: Vec3) => `[${p.map((n) => r1(n)).join(', ')}]`;

/** The level as the session has it now. Read-only. */
export interface Snapshot<S = any, M = any> {
  state: S;
  moves: M[];
  kind: 'playing' | 'won' | 'lost';
  busy: boolean;
  ended: boolean;
  hintsUsed: number;
}

export async function snapshot<S = any, M = any>(page: Page): Promise<Snapshot<S, M>> {
  return page.evaluate(() => {
    const s = window.__riddle!.getState();
    return { state: s.history[s.history.length - 1], moves: s.moves, kind: s.status.kind, busy: s.busy, ended: s.ended, hintsUsed: s.hintsUsed };
  });
}

/** Waits until the game's own move lock is off (or the level is over). */
export async function waitIdle(page: Page, timeout = 60_000) {
  await page.waitForFunction(
    () => {
      const s = window.__riddle!.getState();
      return s.status.kind !== 'playing' || !s.busy;
    },
    undefined,
    { timeout },
  );
}

/** Waits until the camera has not moved for a while: the fly-in at the start, or a turn after a drag. */
export async function waitCameraStill(page: Page, quietMs = 600, timeout = 30_000) {
  const end = Date.now() + timeout;
  let last = '';
  let since = Date.now();
  while (Date.now() < end) {
    const now = JSON.stringify(await page.evaluate(() => window.__taps.camera()?.map((n) => Math.round(n * 1e4))));
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) return;
    await page.waitForTimeout(120);
  }
  throw new Error('the camera never came to rest');
}

/** What one level's player gets for each move. */
export class Taps {
  /** Every touch of this level's run, in order. */
  readonly log: TapRecord[] = [];
  /** The number of the move being made, from 1. */
  step = 0;

  constructor(
    readonly page: Page,
    readonly level: LevelCase,
    readonly size: { width: number; height: number },
  ) {}

  /** Where a point of the 3D world is drawn now. */
  async screenOf(world: Vec3): Promise<Point> {
    const p = await this.page.evaluate((w) => window.__taps.project(w), world);
    if (!p) throw new Error('the 3D scene is not there');
    return { x: p.x, y: p.y };
  }

  /** Every 3D object that listens for a touch right now. */
  async targets(): Promise<Target[]> {
    return this.page.evaluate(() => window.__taps.targets());
  }

  /**
   * The listening object whose origin is nearest to a point of the world. For finding "the figure that
   * stands here" without knowing how the scene builds it. `handler` narrows it to one kind.
   */
  async targetNear(world: Vec3, opts: { handler?: string; within?: number; visibleOnly?: boolean } = {}): Promise<Target | null> {
    const all = (await this.targets()).filter((t) => (!opts.handler || t.handlers.includes(opts.handler)) && (opts.visibleOnly === false || t.visible));
    let best: Target | null = null;
    let bd = opts.within ?? Infinity;
    for (const t of all) {
      const d = Math.hypot(t.world[0] - world[0], t.world[1] - world[1], t.world[2] - world[2]);
      if (d <= bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  /** The middle of what a target draws on the screen (or of its whole box if it draws nothing). */
  middleOf(t: Target): Point {
    const b = t.drawn ?? t.box;
    return b ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 } : t.screen;
  }

  private async look(at: Point, what: string) {
    const { width, height } = this.size;
    if (!(at.x >= 1 && at.y >= 1 && at.x <= width - 1 && at.y <= height - 1)) {
      throw new TapFault('off-screen', this.step, `${what} is drawn at ${fmt(at)}, outside the ${width} by ${height} screen`);
    }
    return this.page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const onTop = !el ? 'nothing' : el.tagName === 'CANVAS' ? 'CANVAS' : `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
      return { onTop, firstHit: window.__taps.firstHit(x, y) };
    }, at);
  }

  /**
   * One tap of the touch screen at a screen point of the scene. If a page element (a bar, a button, a
   * label) lies over the point, that is a fault: a finger would press that element, not the scene.
   */
  async tapAt(at: Point, what: string): Promise<TapRecord> {
    const seen = await this.look(at, what);
    const rec: TapRecord = { step: this.step, what, kind: 'tap', at, ...seen };
    this.log.push(rec);
    if (seen.onTop !== 'CANVAS') throw new TapFault('covered', this.step, `${what} at ${fmt(at)} lies under ${seen.onTop}`);
    await this.page.touchscreen.tap(at.x, at.y);
    return rec;
  }

  /** One tap where a point of the 3D world is drawn. */
  async tapWorld(world: Vec3, what: string): Promise<TapRecord> {
    return this.tapAt(await this.screenOf(world), what);
  }

  /** One tap on the middle of what a listening object draws. */
  async tapTarget(t: Target, what: string): Promise<TapRecord> {
    return this.tapAt(this.middleOf(t), what);
  }

  /**
   * One finger down at `from`, moved to `to` in steps, and lifted: a drag on the touch screen.
   * `holdMs` is how long the finger rests before it moves and before it lifts.
   */
  async dragAt(from: Point, to: Point, what: string, opts: { steps?: number; stepMs?: number; holdMs?: number } = {}): Promise<TapRecord> {
    const seen = await this.look(from, what);
    await this.look(to, `${what} (where the drag ends)`);
    const rec: TapRecord = { step: this.step, what, kind: 'drag', at: from, to, ...seen };
    this.log.push(rec);
    if (seen.onTop !== 'CANVAS') throw new TapFault('covered', this.step, `${what} at ${fmt(from)} lies under ${seen.onTop}`);
    const steps = opts.steps ?? 8;
    const cdp = await this.page.context().newCDPSession(this.page);
    const touch = (type: string, p?: Point) =>
      cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: p ? [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }] : [] });
    try {
      await touch('touchStart', from);
      await this.page.waitForTimeout(opts.holdMs ?? 120);
      for (let i = 1; i <= steps; i++) {
        await touch('touchMove', { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
        await this.page.waitForTimeout(opts.stepMs ?? 40);
      }
      await this.page.waitForTimeout(opts.holdMs ?? 120);
      await touch('touchEnd');
    } finally {
      await cdp.detach();
    }
    return rec;
  }

  /** A drag between two points of the 3D world. */
  async dragWorld(from: Vec3, to: Vec3, what: string, opts?: { steps?: number; stepMs?: number; holdMs?: number }): Promise<TapRecord> {
    return this.dragAt(await this.screenOf(from), await this.screenOf(to), what, opts);
  }

  /**
   * A tap on one of the level's own page buttons (such as level 1's "Row across"). Fails as a fault
   * if the button does not show in time.
   */
  async tapButton(button: Locator, what: string, timeout = 15_000): Promise<void> {
    try {
      await button.waitFor({ state: 'visible', timeout });
    } catch {
      throw new TapFault('no-response', this.step, `${what} did not show`);
    }
    const b = await button.boundingBox();
    this.log.push({ step: this.step, what, kind: 'button', at: b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : { x: 0, y: 0 }, onTop: 'button', firstHit: null });
    await button.tap();
  }

  /** The session as it is now. Read-only. */
  snapshot<S = any, M = any>() {
    return snapshot<S, M>(this.page);
  }

  /** Says that a touch did not do what it should, in the player's own words. */
  fault(kind: TapFaultKind, detail: string): never {
    throw new TapFault(kind, this.step, detail);
  }

  /** The last touch, for a fault's text: where it was, and what a ray from there reaches first. */
  lastTouch(): string {
    const t = this.log[this.log.length - 1];
    if (!t) return 'no touch yet';
    const hit = t.firstHit ? `the first listening object under it has its origin at ${fmt3(t.firstHit.world)}` : 'no listening object under it';
    return `${t.what} at ${fmt(t.at)}${t.to ? ` to ${fmt(t.to)}` : ''}; ${hit}`;
  }
}

/**
 * How one kind of scene is played by touch. `move` makes the touches for one move of the solution and
 * returns; the run then checks that the session took exactly that move.
 */
export interface TapPlayer<S = any, M = any> {
  /** Once, after the rules card is gone and the camera has landed. */
  setup?(taps: Taps): Promise<void>;
  /** The touches for one move. `state` is the state before it, `index` counts from 0. */
  move(taps: Taps, move: M, state: S, index: number): Promise<void>;
}
