import { useFrame, type ThreeElements } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const cache = new Map<string, THREE.ExtrudeGeometry>();

/** A flat cog with trapezoid teeth and round spoke holes, extruded along z and centred. */
export function gearGeometry(teeth: number, radius: number, depth = 0.14, holes = 5) {
  const id = `${teeth}|${radius}|${depth}|${holes}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const tooth = Math.min(0.22, radius * 0.16);
  const root = radius - tooth;
  const step = (Math.PI * 2) / teeth;
  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [root, a],
      [radius, a + step * 0.12],
      [radius, a + step * 0.42],
      [root, a + step * 0.54],
    ];
    pts.forEach(([r, ang], j) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && j === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const axle = new THREE.Path();
  axle.absarc(0, 0, radius * 0.14, 0, Math.PI * 2, true);
  shape.holes.push(axle);
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * root * 0.56, Math.sin(a) * root * 0.56, root * 0.2, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.18,
    bevelSize: Math.min(0.03, radius * 0.03),
    bevelSegments: 1,
    curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  cache.set(id, g);
  return g;
}

export const brass = () => toon('#d9a441', { metal: 0.85, rough: 0.35 });
export const copper = () => toon('#c4733f', { metal: 0.8, rough: 0.4 });
export const iron = () => toon('#3a3640', { metal: 0.6, rough: 0.55 });

/**
 * A spinning cog. Faces +z. `speed` is in turns per second; two meshing gears should use
 * speeds in the inverse ratio of their tooth counts and opposite signs.
 */
export function Gear({
  teeth = 14,
  radius = 1,
  depth = 0.14,
  speed = 0.05,
  phase = 0,
  color = 'brass',
  holes = 5,
  ...rest
}: {
  teeth?: number;
  radius?: number;
  depth?: number;
  speed?: number;
  phase?: number;
  color?: 'brass' | 'copper' | 'iron';
  holes?: number;
} & Omit<ThreeElements['group'], 'children'>) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => gearGeometry(teeth, radius, depth, holes), [teeth, radius, depth, holes]);
  const mat = color === 'brass' ? brass() : color === 'copper' ? copper() : iron();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = phase + clock.elapsedTime * speed * Math.PI * 2;
  });
  return (
    <group {...rest}>
      <group ref={ref}>
        <mesh geometry={geo} material={mat} castShadow receiveShadow />
      </group>
      <mesh rotation-x={Math.PI / 2} material={iron()}>
        <cylinderGeometry args={[radius * 0.16, radius * 0.16, depth * 2.2, 10]} />
      </mesh>
    </group>
  );
}
