import * as THREE from 'three';

/** Shared low-poly materials, cached by color so many characters share one material. */
const cache = new Map<string, THREE.Material>();

export function toon(color: string, opts: { rough?: number; metal?: number; emissive?: string; emissiveIntensity?: number; flat?: boolean } = {}) {
  const key = JSON.stringify([color, opts]);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.8,
      metalness: opts.metal ?? 0,
      flatShading: opts.flat ?? true,
      ...(opts.emissive ? { emissive: new THREE.Color(opts.emissive), emissiveIntensity: opts.emissiveIntensity ?? 1 } : {}),
    });
    cache.set(key, m);
  }
  return m;
}
