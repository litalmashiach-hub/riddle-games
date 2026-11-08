import * as THREE from 'three';

let tex: THREE.Texture | null = null;

/** A soft round glow (white centre fading to clear), shared by every halo and firefly sprite. */
export function glowTexture() {
  if (tex) return tex;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Bright colour for MeshBasicMaterial/instance colours: values above 1 make the bloom pass glow. */
export function hdr(color: string, k: number) {
  return new THREE.Color(color).multiplyScalar(k);
}
