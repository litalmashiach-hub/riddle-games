/**
 * TEST ONLY (branch test/app-preview-video, never for main). A frame-by-frame recorder for the store's
 * preview video, put into the app's web view before the game's own code (see prepare-app-build.ts).
 * It is off unless localStorage 'app-test:vclock' is '1'.
 *
 * Why: a hosted Mac has no graphics chip, so the simulator draws the game at a few frames a second. To get
 * a smooth 30-frames-a-second film of real play, the page's clock is made a "virtual" one that the recorder
 * moves on by exactly 1/30 s per picture: performance.now, Date.now, timers, requestAnimationFrame and the
 * page's CSS animations all follow it. The game draws each frame exactly as it would at 30 frames a second;
 * it only takes longer in real time. Nothing of the game's code is changed.
 *
 * Sound: every sound engine the game makes (the game synthesises all its sounds with Web Audio) is handed
 * one shared OfflineAudioContext, whose clock is the recorder's clock while a scene is recorded. At the end
 * it is rendered, so the film's sound is the game's own sounds, made by the game's own code, at the very
 * frames they were asked for. Sounds asked for while no scene is recorded are started silent.
 */
export const VCLOCK = () => {
  const w = window as any;
  let on = false;
  try {
    on = localStorage.getItem('app-test:vclock') === '1';
  } catch {
    /* no storage */
  }
  if (!on) return;
  const realNow = performance.now.bind(performance);
  const realSetTimeout = w.setTimeout.bind(w);
  const realClearTimeout = w.clearTimeout.bind(w);
  const date0 = Date.now();
  const perf0 = realNow();
  let frozen = false;
  let offset = 0;
  let frozenAt = 0;
  const vnow = () => (frozen ? frozenAt : realNow() - offset);
  performance.now = vnow;
  Date.now = () => Math.round(date0 + (vnow() - perf0));

  // The 3D view keeps its last drawn picture until the next is drawn (WebGL's preserveDrawingBuffer), so a
  // screen picture taken between two frames always shows the frame just drawn, never an emptied canvas.
  // This changes how the browser keeps the picture, not what the game draws.
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, opts?: any) {
    if (/webgl/.test(type)) opts = { ...(opts || {}), preserveDrawingBuffer: true };
    return (getContext as any).call(this, type, opts);
  } as any;

  // Timers on the virtual clock.
  type Tm = { due: number; cb: any; args: any[]; every: number };
  const timers = new Map<number, Tm>();
  let tid = 1_000_000;
  const add = (cb: any, ms: any, args: any[], every: number) => {
    const id = ++tid;
    const f = typeof cb === 'function' ? cb : () => (0, eval)(String(cb));
    timers.set(id, { due: vnow() + Math.max(0, Number(ms) || 0), cb: f, args, every });
    return id;
  };
  w.setTimeout = (cb: any, ms?: any, ...args: any[]) => add(cb, ms, args, 0);
  w.setInterval = (cb: any, ms?: any, ...args: any[]) => add(cb, ms, args, Math.max(1, Number(ms) || 0));
  w.clearTimeout = w.clearInterval = (id: number) => {
    if (timers.has(id)) timers.delete(id);
    else realClearTimeout(id);
  };
  const runTimers = (upTo: number) => {
    for (let n = 0; n < 5000; n++) {
      let best: number | null = null;
      let bt: Tm | null = null;
      for (const [id, t] of timers) if (t.due <= upTo && (!bt || t.due < bt.due)) { best = id; bt = t; }
      if (best === null || !bt) return;
      if (bt.every) bt.due += bt.every;
      else timers.delete(best);
      try { bt.cb(...bt.args); } catch (e) { console.error(e); }
    }
  };

  // Frames on the virtual clock.
  let frameQ = new Map<number, FrameRequestCallback>();
  let rid = 0;
  w.requestAnimationFrame = (cb: FrameRequestCallback) => { const id = ++rid; frameQ.set(id, cb); return id; };
  w.cancelAnimationFrame = (id: number) => { frameQ.delete(id); };
  let frames = 0;
  const runFrame = () => {
    const q = frameQ;
    frameQ = new Map();
    const t = vnow();
    frames++;
    for (const cb of q.values()) { try { cb(t); } catch (e) { console.error(e); } }
  };
  // While not frozen: timers every 4 ms of real time, and at most RUN_FPS frames a second (a hosted Mac
  // cannot draw more; see the fps cap of page-hooks.ts).
  let runFps = 8;
  try { runFps = Number(localStorage.getItem('app-test:vclock-run-fps') || 8); } catch { /* none */ }
  let lastFrame = 0;
  const pump = () => {
    if (!frozen) {
      runTimers(vnow());
      if (realNow() - lastFrame >= 1000 / runFps) { lastFrame = realNow(); runFrame(); }
    }
    realSetTimeout(pump, 4);
  };
  realSetTimeout(pump, 4);

  // The page's CSS and Web Animations, held and moved with the virtual clock while frozen.
  const held = new Map<Animation, number>();
  const hold = () => {
    if (!document.getAnimations) return;
    for (const a of document.getAnimations()) {
      if (held.has(a)) continue;
      const ct = Number(a.currentTime ?? 0) || 0;
      held.set(a, vnow() - ct);
      try { a.pause(); } catch { /* gone */ }
    }
  };
  const seek = () => {
    hold();
    const t = vnow();
    for (const [a, start] of held) { try { a.currentTime = t - start; } catch { /* gone */ } }
  };
  new MutationObserver(() => { if (frozen) hold(); }).observe(document, { subtree: true, childList: true, attributes: true });

  // Sound: one shared offline engine.
  const SR = 48000;
  const Offline = w.OfflineAudioContext || w.webkitOfflineAudioContext;
  const SECONDS = Number((() => { try { return localStorage.getItem('app-test:vclock-audio-seconds'); } catch { return null; } })() || 120);
  const engine: OfflineAudioContext | null = Offline ? new Offline(2, SR * SECONDS, SR) : null;
  let audioMs = 0; // the engine's clock: only moves while a scene is recorded
  let recording = false;
  const events: { at: number; kind: string }[] = [];
  if (engine) {
    const fake = new Proxy({} as any, {
      get(_t, p) {
        if (p === 'currentTime') return audioMs / 1000;
        if (p === 'state') return 'running';
        if (p === 'resume' || p === 'suspend' || p === 'close') return () => Promise.resolve();
        if (p === 'addEventListener' || p === 'removeEventListener') return () => undefined;
        if (p === 'baseLatency' || p === 'outputLatency') return 0;
        const v = (engine as any)[p];
        return typeof v === 'function' ? v.bind(engine) : v;
      },
      set() { return true; },
    });
    const Fake = function () { return fake; } as any;
    w.AudioContext = Fake;
    w.webkitAudioContext = Fake;
    for (const name of ['AudioScheduledSourceNode', 'AudioBufferSourceNode', 'OscillatorNode', 'ConstantSourceNode']) {
      const proto = w[name]?.prototype;
      if (!proto || !Object.prototype.hasOwnProperty.call(proto, 'start')) continue;
      const start = proto.start;
      proto.start = function (this: any, ...a: any[]) {
        if (!recording) { try { this.disconnect(); } catch { /* none */ } }
        else if (events.length < 5000) events.push({ at: Math.round(audioMs), kind: this.constructor?.name || 'source' });
        return start.apply(this, a);
      };
    }
  }

  let result: any = null;
  w.__vclock = {
    now: vnow,
    frames: () => frames,
    isFrozen: () => frozen,
    audioMs: () => audioMs,
    events: () => events.slice(),
    freeze() {
      if (!frozen) { frozenAt = vnow(); frozen = true; hold(); }
      return frozenAt;
    },
    /** Moves the clock on by ms, fires what is due, draws one frame. While recording, the sound clock moves too. */
    step(ms: number) {
      if (!frozen) this.freeze();
      frozenAt += ms;
      if (recording) audioMs += ms;
      runTimers(frozenAt);
      runFrame();
      seek();
      return { t: frozenAt, audioMs, timers: timers.size };
    },
    record(onOff: boolean) { recording = !!onOff; return audioMs; },
    /** Moves only the sound clock on (a gap between scenes, so one scene's last sounds do not reach the next). */
    gap(ms: number) { audioMs += ms; return audioMs; },
    resume() {
      if (frozen) { offset = realNow() - frozenAt; frozen = false; }
      for (const a of held.keys()) { try { a.play(); } catch { /* gone */ } }
      held.clear();
      return vnow();
    },
    render() {
      if (!engine) { result = { error: 'no OfflineAudioContext' }; return false; }
      result = null;
      engine.startRendering().then(
        (buf) => { result = { len: buf.length, sr: buf.sampleRate, ch: [buf.getChannelData(0), buf.getChannelData(1)] }; },
        (e) => { result = { error: String(e) }; },
      );
      return true;
    },
    rendered() { return result ? (result.error ? { error: result.error } : { len: result.len, sr: result.sr }) : null; },
    /** Interleaved 16-bit samples from frame `from`, `n` frames, as base64. */
    chunk(from: number, n: number) {
      const [l, r] = result.ch as Float32Array[];
      const end = Math.min(result.len, from + n);
      const bytes = new Uint8Array((end - from) * 4);
      const dv = new DataView(bytes.buffer);
      for (let i = from, o = 0; i < end; i++, o += 4) {
        dv.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767))), true);
        dv.setInt16(o + 2, Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767))), true);
      }
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
      return btoa(s);
    },
  };
};
