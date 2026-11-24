import { ellipse, glow, paintShelly, type Painter } from '@riddle/level-19-picture-tiles';

/**
 * This level's picture: Shelly and her two little ones swimming home at sunset, seen from above.
 * It reuses level 19's drawing of Shelly, placed three times, on a sky and water of its own.
 */
export const paintFamily: Painter = (g, S) => {
  // Sunset on the water: rose at the top, violet, then deep teal.
  const bg = g.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#f08a7c');
  bg.addColorStop(0.4, '#8a4f9c');
  bg.addColorStop(1, '#14586e');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);

  // The setting sun in the top right corner, with a path of light across the water.
  glow(g, 0.84, 0.15, 0.4, 'rgba(255,214,140,0.6)');
  ellipse(g, 0.84, 0.15, 0.1, 0.1, 0, '#ffe9a8');
  ellipse(g, 0.86, 0.13, 0.075, 0.075, 0, '#ffd166');
  for (const [x, y, w] of [
    [0.7, 0.3, 0.07],
    [0.62, 0.38, 0.05],
    [0.75, 0.42, 0.04],
  ]) {
    ellipse(g, x, y, w, w * 0.22, -0.5, 'rgba(255,226,160,0.55)');
  }

  // Ripple rings behind each swimmer.
  g.lineWidth = S * 0.01;
  g.strokeStyle = 'rgba(210,235,255,0.4)';
  for (const [x, y, r] of [
    [0.22, 0.9, 0.09],
    [0.6, 0.93, 0.06],
    [0.93, 0.7, 0.05],
    [0.1, 0.3, 0.05],
  ]) {
    g.beginPath();
    g.ellipse(x * S, y * S, r * S, r * S * 0.55, 0, 0, Math.PI * 2);
    g.stroke();
  }

  // A lily pad with a white flower in the top left corner.
  g.beginPath();
  g.moveTo(0.14 * S, 0.14 * S);
  g.arc(0.14 * S, 0.14 * S, 0.12 * S, 0.9, 0.9 + Math.PI * 2 - 0.7);
  g.closePath();
  g.fillStyle = '#3fae6a';
  g.fill();
  ellipse(g, 0.14, 0.14, 0.065, 0.065, 0, '#63cf83');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ellipse(g, 0.13 + Math.cos(a) * 0.03, 0.13 + Math.sin(a) * 0.03, 0.03, 0.016, a, '#fff6fb');
  }
  ellipse(g, 0.13, 0.13, 0.017, 0.017, 0, '#ffd166');

  // Three turtles: Shelly in front, her little ones behind, all heading for the sun.
  const turtle = (x: number, y: number, size: number, turn: number) => {
    g.save();
    g.translate(x * S, y * S);
    g.rotate(turn);
    g.scale(size, size);
    g.translate(-0.5 * S, -0.5 * S);
    paintShelly(g);
    g.restore();
  };
  turtle(0.45, 0.43, 0.7, 0.62);
  turtle(0.17, 0.78, 0.36, 0.75);
  turtle(0.7, 0.8, 0.33, 0.45);

  // Fireflies coming out for the evening.
  for (const [x, y] of [
    [0.4, 0.07],
    [0.06, 0.52],
    [0.9, 0.5],
    [0.82, 0.9],
    [0.42, 0.93],
  ]) {
    glow(g, x, y, 0.05, 'rgba(255,240,120,0.9)');
    ellipse(g, x, y, 0.012, 0.012, 0, '#fffbd0');
  }
};
