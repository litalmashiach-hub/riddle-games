// Records a hint-following play of the unmodified app build, as a list of normalized taps.
// usage: node record.cjs WxH levels(count) out.json
const { chromium } = require('playwright');
const fs = require('fs');
const [W, H] = process.argv[2].split('x').map(Number);
const MAXLEVELS = Number(process.argv[3] || 1);
const out = process.argv[4];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PAGE = null;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); PAGE = page;
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(() => {
    try { localStorage.setItem('riddle-games:settings:v1', JSON.stringify({ quality: 'low', sound: false })); } catch {}
    window.__scenes = [];
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', (e) => {
      const o = e.detail;
      if (o && o.isScene) { window.__scenes.push(o); o.onBeforeRender = (r, s, cam) => { if (cam && cam.isPerspectiveCamera) s.__cam = cam; }; }
    });
  });
  await page.goto('http://localhost:4711/index.html');
  const steps = [];
  const tapEl = async (loc) => { const b = await loc.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const label = (l) => page.locator(`[aria-label="${l}"]`).first();
  // gold hint rings, in screen coordinates
  const rings = () => page.evaluate(() => {
    let s = null, best = 0; for (const c of window.__scenes) { let n = 0; c.traverse(() => n++); if (n > best) { best = n; s = c; } } const cam = s && s.__cam; if (!s || !cam) return null;
    const res = [];
    s.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'RingGeometry') return;
      let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false;
      if (!v) return;
      const hex = o.material.color.getHexString();
      const w = o.getWorldPosition(new o.position.constructor());
      const pr = (dy) => { const q = w.clone(); q.y += dy; q.project(cam); return [(q.x + 1) / 2 * innerWidth, (1 - q.y) / 2 * innerHeight]; };
      res.push({ hex, w: w.toArray().map((n) => +n.toFixed(2)), r: o.geometry.parameters.outerRadius, p0: pr(0), p15: pr(0.15), p3: pr(0.35), p6: pr(0.6), p9: pr(0.9) });
    });
    return res;
  });
  const moves = async () => Number(await page.locator('.tabular-nums').first().innerText());
  const hintEnabled = async () => await label('Hint').isEnabled();
  const solved = async () => (await page.getByText('Solved!').count()) > 0;
  const lost = async () => (await page.getByText('Oh no!').count()) > 0;

  await page.getByRole('heading', { name: 'Riddle Games' }).waitFor();
  const cards = page.locator('button[aria-label^="Level "]');
  const first = await cards.first().getAttribute('aria-label');
  steps.push({ do: 'openLevel', label: first });
  await cards.first().scrollIntoViewIfNeeded();
  await tapEl(cards.first());
  for (let lv = 1; lv <= MAXLEVELS; lv++) {
    await page.getByText("Let's go!").waitFor();
    const title = await page.locator('h2').first().innerText();
    steps.push({ do: 'rules', title });
    await sleep(4000);
    await tapEl(page.getByText("Let's go!"));
    await sleep(1500);
    let guard = 0, ok = false;
    while (guard++ < 80) {
      if (await solved()) { ok = true; break; }
      if (await lost()) throw new Error('lost on level ' + title);
      // wait for hint enabled
      for (let i = 0; i < 100 && !(await hintEnabled()) && !(await solved()); i++) await sleep(200);
      if (await solved()) { ok = true; break; }
      const m0 = await moves();
      await tapEl(label('Hint'));
      await sleep(600);
      const toast = await page.locator('.bg-amber-300').first().innerText().catch(() => '');
      steps.push({ do: 'hint', text: toast, moves: m0 });
      // tap rings until the move count changes
      const keyOf = async () => JSON.stringify([(await rings() || []).map((r) => [r.hex, r.w]), await moves()]);
      for (let k = 0; k < 8; k++) {
        if ((await moves()) !== m0) break;
        const rs = (await rings() || []).filter((r) => r.hex === 'ffd166');
        if (!rs.length) throw new Error(`no gold ring on ${title} after hint "${toast}" k=${k}`);
        let progressed = false;
        for (const r of rs) {
          for (const off of ['p3', 'p15', 'p6', 'p0', 'p9']) {
            const p = r[off];
            if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
            const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, p);
            if (top !== 'CANVAS') continue;
            const k0 = await keyOf();
            await page.touchscreen.tap(p[0], p[1]);
            await sleep(900);
            if ((await keyOf()) !== k0) {
              steps.push({ do: 'tap', x: +(p[0] / W).toFixed(4), y: +(p[1] / H).toFixed(4), ring: r.w, r: r.r, off });
              progressed = true;
              break;
            }
          }
          if ((await moves()) !== m0) break;
        }
        if (!progressed) {
          // a glowing on-page button for the hinted move (levels with an action menu)
          const b = await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => /pulse/.test(x.style.animation || '')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: el.innerText }; });
          if (b) {
            const k0 = await keyOf();
            await page.touchscreen.tap(b.x, b.y);
            await sleep(900);
            if ((await keyOf()) !== k0) { steps.push({ do: 'tap', x: +(b.x / W).toFixed(4), y: +(b.y / H).toFixed(4), button: b.t }); progressed = true; }
          }
        }
        if (!progressed) throw new Error(`taps changed nothing on ${title} "${toast}" rings=${JSON.stringify(rs.map((r) => r.w))}`);
      }
      if ((await moves()) === m0) throw new Error(`no move after taps on ${title} "${toast}"`);
      steps.push({ do: 'moved', moves: await moves() });
    }
    if (!ok) throw new Error('not solved: ' + title);
    await page.getByText('Solved!').waitFor();
    const summary = await page.locator('h2:has-text("Solved!") ~ p').first().innerText().catch(() => '');
    steps.push({ do: 'won', title, summary });
    console.log('WON', title, summary); fs.writeFileSync(out, JSON.stringify({ size: [W, H], steps, errors }, null, 1));
    await page.screenshot({ path: `${out}.L${lv}.png` });
    if (lv < MAXLEVELS) { await sleep(1200); await tapEl(page.getByText('Next level')); steps.push({ do: 'next' }); }
  }
  fs.writeFileSync(out, JSON.stringify({ size: [W, H], steps, errors }, null, 1));
  console.log('errors', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(async (e) => { console.error('FAILED', e.message); try { await PAGE.screenshot({ path: out + '.fail.png' }); } catch {} fs.writeFileSync(out + '.partial', 'x'); process.exit(1); });

