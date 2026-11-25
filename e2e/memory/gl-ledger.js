// Injected before the page loads. Keeps a ledger of every WebGL object the page makes and frees,
// with a rough byte count for buffers, textures and renderbuffers, per 3D context.
// It reads the page from outside; it changes nothing the game draws.
(() => {
  const ctxs = [];
  const L = (window.__glLedger = { ctxs, made: 0 });
  const KINDS = ['Texture', 'Buffer', 'Framebuffer', 'Renderbuffer', 'Program', 'Shader', 'VertexArray'];
  const entry = (gl) => {
    let e = gl.__ledger;
    if (!e) {
      e = gl.__ledger = { ref: new WeakRef(gl), live: {}, made: {}, total: 0 };
      for (const k of KINDS) { e.live[k] = 0; e.made[k] = 0; }
      ctxs.push(e);
      L.made++;
    }
    return e;
  };
  const BIND = { 34962: 34964, 34963: 34965, 35345: 35368, 35051: 35053, 35052: 35055, 36662: 36662, 36663: 36663 };
  const bpp = (type, format) => {
    // half float 0x8D61/0x140B -> 8 bytes for RGBA, float 0x1406 -> 16
    if (type === 0x1406) return 16;
    if (type === 0x140b || type === 0x8d61) return 8;
    return 4;
  };
  const sizeOf = (e, obj, key, bytes) => {
    const m = obj.__sizes || (obj.__sizes = {});
    e.total += bytes - (m[key] || 0);
    m[key] = bytes;
  };
  for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!P) continue;
    const p = P.prototype;
    for (const k of KINDS) {
      const c = p['create' + k], d = p['delete' + k];
      if (!c) continue;
      p['create' + k] = function (...a) {
        const o = c.apply(this, a);
        const e = entry(this);
        if (o) { e.live[k]++; e.made[k]++; o.__kind = k; }
        return o;
      };
      p['delete' + k] = function (o) {
        const e = entry(this);
        if (o && !o.__gone) { o.__gone = true; e.live[o.__kind || k]--; for (const v of Object.values(o.__sizes || {})) e.total -= v; o.__sizes = null; }
        return d.call(this, o);
      };
    }
    const bd = p.bufferData;
    p.bufferData = function (target, src, ...rest) {
      const e = entry(this);
      const b = this.getParameter(BIND[target] ?? 34964);
      const n = typeof src === 'number' ? src : src?.byteLength ?? 0;
      if (b) sizeOf(e, b, 'data', n);
      return bd.call(this, target, src, ...rest);
    };
    const texBound = (gl, target) => gl.getParameter(target === 0x0de1 ? 0x8069 : target === 0x806f || target === 0x8c1a ? (target === 0x806f ? 0x806a : 0x8c1d) : 0x8514);
    const ti = p.texImage2D;
    p.texImage2D = function (...a) {
      const e = entry(this);
      try {
        const t = texBound(this, a[0]);
        let w, h, type, fmt;
        if (a.length >= 8) { w = a[3]; h = a[4]; fmt = a[6]; type = a[7]; }
        else { const s = a[5]; w = s?.width ?? s?.videoWidth ?? 0; h = s?.height ?? s?.videoHeight ?? 0; fmt = a[3]; type = a[4]; }
        if (t) sizeOf(e, t, `${a[0]}:${a[1]}`, w * h * bpp(type, fmt));
      } catch {}
      return ti.apply(this, a);
    };
    const ts = p.texStorage2D;
    if (ts) p.texStorage2D = function (target, levels, ifmt, w, h) {
      const e = entry(this);
      try { const t = texBound(this, target); const f = target === 0x8513 ? 6 : 1; if (t) sizeOf(e, t, 'storage', Math.round(w * h * 4 * f * (levels > 1 ? 1.34 : 1))); } catch {}
      return ts.call(this, target, levels, ifmt, w, h);
    };
    const ts3 = p.texStorage3D;
    if (ts3) p.texStorage3D = function (target, levels, ifmt, w, h, dpt) {
      const e = entry(this);
      try { const t = texBound(this, target); if (t) sizeOf(e, t, 'storage', w * h * dpt * 4); } catch {}
      return ts3.call(this, target, levels, ifmt, w, h, dpt);
    };
    for (const name of ['renderbufferStorage', 'renderbufferStorageMultisample']) {
      const f = p[name];
      if (!f) continue;
      p[name] = function (...a) {
        const e = entry(this);
        const ms = name.endsWith('Multisample');
        const w = ms ? a[3] : a[2], h = ms ? a[4] : a[3], s = ms ? Math.max(1, a[1]) : 1;
        const rb = this.getParameter(0x8ca7);
        if (rb) sizeOf(e, rb, 'store', w * h * 4 * s);
        return f.apply(this, a);
      };
    }
  }
  L.draws = 0;
  L.frames = 0;
  const tick = () => { L.frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!P) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = P.prototype[name];
      if (f) P.prototype[name] = function (...a) { L.draws++; return f.apply(this, a); };
    }
  }
  L.read = () => {
    const out = { contextsMade: L.made, contextsLive: 0, live: {}, made: {}, mb: 0 };
    for (const k of KINDS) { out.live[k] = 0; out.made[k] = 0; }
    for (const e of ctxs) {
      const gl = e.ref.deref();
      if (!gl || gl.isContextLost()) continue;
      out.contextsLive++;
      for (const k of KINDS) { out.live[k] += e.live[k]; out.made[k] += e.made[k]; }
      out.mb += e.total;
    }
    out.mb = +(out.mb / 1048576).toFixed(1);
    const now = performance.now();
    if (L.last) { const s = (now - L.last.t) / 1000; out.fps = +((L.frames - L.last.f) / s).toFixed(1); out.drawsPerFrame = L.frames > L.last.f ? Math.round((L.draws - L.last.d) / (L.frames - L.last.f)) : 0; }
    L.last = { t: now, f: L.frames, d: L.draws };
    return out;
  };
})();
