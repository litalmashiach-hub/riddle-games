import * as THREE from 'three';

/**
 * The mosaic picture, painted on a canvas at load time (no image files):
 * Shelly the turtle swimming up through a twilight lagoon, seen from above.
 * Then it is turned into little square stones (tesserae) so it looks like a real mosaic.
 * Each tile shows one ninth of it. The bottom-right ninth is the "missing piece".
 */
const S = 768;
const BLOCK = 16; // 48 tesserae across, 16 per tile

let cached: THREE.CanvasTexture | null = null;

export function mosaicTexture(): THREE.CanvasTexture {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d')!;
  paint(g);
  tesserae(g);
  numbers(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cached = tex;
  return tex;
}

const P = (v: number) => v * S;

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, fill: string) {
  g.beginPath();
  g.ellipse(P(x), P(y), P(rx), P(ry), rot, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const grad = g.createRadialGradient(P(x), P(y), 0, P(x), P(y), P(r));
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(P(x - r), P(y - r), P(r * 2), P(r * 2));
}

function paint(g: CanvasRenderingContext2D) {
  // Twilight lagoon water, lighter where the moon shines.
  const bg = g.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#3a2f7a');
  bg.addColorStop(0.45, '#1f6f93');
  bg.addColorStop(1, '#16927f');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  glow(g, 0.16, 0.14, 0.32, 'rgba(255,236,170,0.55)');

  // Ripple rings.
  g.lineWidth = P(0.012);
  for (const [x, y, r] of [
    [0.2, 0.62, 0.1],
    [0.84, 0.5, 0.08],
    [0.5, 0.92, 0.12],
    [0.82, 0.15, 0.06],
  ]) {
    g.strokeStyle = 'rgba(190,240,255,0.45)';
    g.beginPath();
    g.ellipse(P(x), P(y), P(r), P(r * 0.55), 0, 0, Math.PI * 2);
    g.stroke();
  }

  // The moon (piece 1).
  ellipse(g, 0.16, 0.14, 0.085, 0.085, 0, '#fff4c2');
  ellipse(g, 0.19, 0.12, 0.07, 0.07, 0, '#ffe58a');
  ellipse(g, 0.13, 0.17, 0.016, 0.016, 0, '#f2d36b');

  // Lily pads with flowers.
  const pad = (x: number, y: number, r: number, rot: number) => {
    g.beginPath();
    g.moveTo(P(x), P(y));
    g.arc(P(x), P(y), P(r), rot + 0.35, rot + Math.PI * 2 - 0.35);
    g.closePath();
    g.fillStyle = '#4fbf55';
    g.fill();
    ellipse(g, x, y, r * 0.55, r * 0.55, 0, '#6fd96a');
  };
  pad(0.12, 0.86, 0.1, -0.6);
  pad(0.9, 0.86, 0.11, 2.4);
  pad(0.9, 0.33, 0.07, 1.2);
  const flower = (x: number, y: number, r: number) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ellipse(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.3, a, '#ff8fc8');
    }
    ellipse(g, x, y, r * 0.35, r * 0.35, 0, '#ffe066');
  };
  flower(0.88, 0.88, 0.07);
  flower(0.12, 0.85, 0.05);

  // Fireflies.
  for (const [x, y] of [
    [0.62, 0.08],
    [0.88, 0.06],
    [0.4, 0.06],
    [0.06, 0.45],
    [0.94, 0.62],
    [0.32, 0.95],
  ]) {
    glow(g, x, y, 0.05, 'rgba(255,240,120,0.9)');
    ellipse(g, x, y, 0.012, 0.012, 0, '#fffbd0');
  }

  // ---- Shelly, swimming up the picture ----
  const skin = '#8fd46a';
  const skinDark = '#5fae4a';
  // flippers
  ellipse(g, 0.25, 0.36, 0.15, 0.06, -0.55, skinDark);
  ellipse(g, 0.75, 0.36, 0.15, 0.06, 0.55, skinDark);
  ellipse(g, 0.25, 0.36, 0.13, 0.045, -0.55, skin);
  ellipse(g, 0.75, 0.36, 0.13, 0.045, 0.55, skin);
  ellipse(g, 0.31, 0.77, 0.1, 0.05, 0.6, skinDark);
  ellipse(g, 0.69, 0.77, 0.1, 0.05, -0.6, skinDark);
  ellipse(g, 0.31, 0.77, 0.085, 0.037, 0.6, skin);
  ellipse(g, 0.69, 0.77, 0.085, 0.037, -0.6, skin);
  // tail
  g.beginPath();
  g.moveTo(P(0.46), P(0.76));
  g.lineTo(P(0.54), P(0.76));
  g.lineTo(P(0.5), P(0.87));
  g.closePath();
  g.fillStyle = skin;
  g.fill();
  // head
  ellipse(g, 0.5, 0.2, 0.1, 0.1, 0, skinDark);
  ellipse(g, 0.5, 0.2, 0.088, 0.09, 0, skin);
  // eyes
  for (const s of [-1, 1]) {
    ellipse(g, 0.5 + s * 0.04, 0.18, 0.03, 0.034, 0, '#ffffff');
    ellipse(g, 0.5 + s * 0.04, 0.185, 0.017, 0.02, 0, '#1b2433');
    ellipse(g, 0.5 + s * 0.035, 0.175, 0.007, 0.007, 0, '#ffffff');
    ellipse(g, 0.5 + s * 0.068, 0.23, 0.016, 0.01, 0, '#ff9bb3');
  }
  // smile
  g.strokeStyle = '#2d4a2a';
  g.lineWidth = P(0.008);
  g.beginPath();
  g.arc(P(0.5), P(0.225), P(0.025), 0.2, Math.PI - 0.2);
  g.stroke();
  // shell
  ellipse(g, 0.5, 0.53, 0.25, 0.27, 0, '#c98a2e');
  ellipse(g, 0.5, 0.53, 0.225, 0.245, 0, '#3a9d4c');
  const hex = (x: number, y: number, r: number, fill: string) => {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = P(x + Math.cos(a) * r);
      const py = P(y + Math.sin(a) * r);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  hex(0.5, 0.53, 0.075, '#8fd16a');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    hex(0.5 + Math.cos(a) * 0.14, 0.53 + Math.sin(a) * 0.15, 0.055, i % 2 ? '#7cc85c' : '#a6dc72');
  }
  // shine
  ellipse(g, 0.42, 0.42, 0.05, 0.025, -0.6, 'rgba(255,255,255,0.45)');
  // a little pink flower on her head
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ellipse(g, 0.55 + Math.cos(a) * 0.017, 0.12 + Math.sin(a) * 0.017, 0.016, 0.016, 0, '#ff7eb6');
  }
  ellipse(g, 0.55, 0.12, 0.011, 0.011, 0, '#ffe066');
}

/** Rebuild the picture out of small square stones with grout lines, like a real mosaic. */
function tesserae(g: CanvasRenderingContext2D) {
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  const n = S / BLOCK;
  g.fillStyle = '#233833';
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let by = 0; by < n; by++) {
    for (let bx = 0; bx < n; bx++) {
      let r = 0;
      let gg = 0;
      let b = 0;
      let c = 0;
      for (let y = by * BLOCK + 3; y < (by + 1) * BLOCK - 3; y += 2) {
        for (let x = bx * BLOCK + 3; x < (bx + 1) * BLOCK - 3; x += 2) {
          const i = (y * S + x) * 4;
          r += d[i];
          gg += d[i + 1];
          b += d[i + 2];
          c++;
        }
      }
      const k = 0.9 + rand() * 0.18;
      const col = `rgb(${Math.min(255, (r / c) * k) | 0},${Math.min(255, (gg / c) * k) | 0},${Math.min(255, (b / c) * k) | 0})`;
      const j = () => (rand() - 0.5) * 2;
      g.fillStyle = col;
      g.fillRect(bx * BLOCK + 1.5 + j() * 0.6, by * BLOCK + 1.5 + j() * 0.6, BLOCK - 3, BLOCK - 3);
      // a soft highlight on each little stone
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(bx * BLOCK + 2, by * BLOCK + 2, BLOCK - 7, 3);
    }
  }
}

/** A small pebble with the piece number in each piece's corner, to help young players. */
function numbers(g: CanvasRenderingContext2D) {
  const third = S / 3;
  for (let p = 0; p < 9; p++) {
    const x = (p % 3) * third + 30;
    const y = Math.floor(p / 3) * third + 30;
    g.beginPath();
    g.arc(x, y, 20, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,248,225,0.88)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(60,45,30,0.5)';
    g.stroke();
    g.fillStyle = '#3b2f2a';
    g.font = 'bold 26px Fredoka, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(p === 8 ? '★' : String(p + 1), x, y + 1);
  }
}

/** A plane showing one ninth of the picture: piece `p` (1..9) from its home cell. */
export function pieceGeometry(p: number, size: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(size, size);
  const home = p - 1;
  const c = home % 3;
  const r = Math.floor(home / 3);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (c + uv.getX(i)) / 3, 1 - (r + 1 - uv.getY(i)) / 3);
  }
  uv.needsUpdate = true;
  return geo;
}

let outline: THREE.CanvasTexture | null = null;
/** A glowing rounded frame with a little arrow at the top, shown on tiles that can slide. */
export function outlineTexture(): THREE.CanvasTexture {
  if (outline) return outline;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#fff2a8';
  g.lineWidth = 7;
  g.beginPath();
  g.roundRect(6, 6, 116, 116, 16);
  g.stroke();
  // arrow chevron at the top edge, pointing out (towards the gap)
  g.fillStyle = '#fff2a8';
  g.beginPath();
  g.moveTo(64, 14);
  g.lineTo(84, 34);
  g.lineTo(44, 34);
  g.closePath();
  g.fill();
  outline = new THREE.CanvasTexture(c);
  outline.colorSpace = THREE.SRGBColorSpace;
  return outline;
}
