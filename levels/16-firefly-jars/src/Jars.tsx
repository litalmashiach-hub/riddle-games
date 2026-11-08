import { useFrame } from '@react-three/fiber';
import { Clickable, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOW, JAR_BASE_Y, JAR_COUNT, JAR_H, JAR_POS, JAR_R } from './layout';
import { isDone, type Jar } from './rules';

/** A soft round glow texture, made once in a canvas. */
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

const glass = new THREE.MeshStandardMaterial({
  color: '#cfefff',
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
  side: THREE.DoubleSide,
  envMapIntensity: 1.6,
});
const rimGlass = new THREE.MeshStandardMaterial({ color: '#e6f7ff', roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 2 });

/** Mix of the colours in a jar, for its glow. */
function jarGlow(j: Jar, out: THREE.Color) {
  out.setRGB(0, 0, 0);
  if (j.length === 0) return out;
  const c = new THREE.Color();
  j.forEach((col) => out.add(c.set(GLOW[col])));
  return out.multiplyScalar(1 / j.length);
}

function GlassJar({ index, jar, onClick, disabled, lifted, ok, won }: { index: number; jar: Jar; onClick(): void; disabled: boolean; lifted: boolean; ok: boolean | null; won: boolean }) {
  const root = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const high = useSettings((s) => s.quality) === 'high';
  const done = isDone(jar);
  const color = useMemo(() => jarGlow(jar, new THREE.Color()), [jar]);
  const haloMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), []);
  const doneAt = useRef(-10);
  const wasDone = useRef(done);
  if (done && !wasDone.current) doneAt.current = performance.now() / 1000;
  wasDone.current = done;
  const [x, y, z] = JAR_POS[index];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const now = performance.now() / 1000;
    const since = now - doneAt.current;
    // Bob gently with the raft, and jump for joy when a colour is complete.
    if (root.current) {
      const pop = since < 0.7 ? Math.sin((since / 0.7) * Math.PI) * 0.18 : 0;
      const party = won ? Math.abs(Math.sin(t * 5 + index)) * 0.14 : 0;
      root.current.position.y = y + pop + party;
      root.current.rotation.z = since < 0.7 ? Math.sin(since * 30) * 0.06 * (1 - since / 0.7) : won ? Math.sin(t * 5 + index) * 0.05 : 0;
    }
    const brightness = jar.length === 0 ? 0 : (0.12 + jar.length * 0.05 + (done ? 0.35 : 0) + (won ? 0.4 + Math.sin(t * 6 + index) * 0.2 : 0)) * (1 + Math.sin(t * 2 + index) * 0.08);
    if (halo.current) {
      haloMat.color.copy(color).multiplyScalar(brightness);
      const s = 1.7 + jar.length * 0.12 + (done ? 0.5 : 0);
      halo.current.scale.set(s, s * 1.3, 1);
    }
    if (light.current) {
      light.current.color.copy(color);
      light.current.intensity = brightness * 4;
    }
    if (ring.current) {
      const target = lifted ? 0.9 : ok === true ? 0.55 + Math.sin(t * 6) * 0.25 : done ? 0.5 : 0;
      ringMat.opacity += (target - ringMat.opacity) * 0.15;
      ringMat.color.set(ok === true ? '#9dffb0' : lifted ? '#fff3b0' : '#ffffff').lerp(color, done ? 0.7 : 0);
      ring.current.scale.setScalar(1 + (since < 0.8 ? since * 0.8 : 0));
    }
  });

  return (
    <group ref={root} position={[x, y, z]}>
      <Clickable onClick={onClick} disabled={disabled} hoverScale={1.04}>
        {/* Big invisible tap target. */}
        <mesh position={[0, JAR_H / 2 + 0.3, 0]} visible={false}>
          <cylinderGeometry args={[JAR_R + 0.22, JAR_R + 0.22, JAR_H + 1.2, 12]} />
          <meshBasicMaterial />
        </mesh>
        {/* Glass body, a thicker bottom and a rolled lip. */}
        <mesh position={[0, JAR_H / 2, 0]} material={glass} renderOrder={2}>
          <cylinderGeometry args={[JAR_R, JAR_R * 0.96, JAR_H, 28, 1, true]} />
        </mesh>
        <mesh position={[0, 0.04, 0]} material={rimGlass} castShadow>
          <cylinderGeometry args={[JAR_R * 0.97, JAR_R * 0.9, 0.08, 28]} />
        </mesh>
        <mesh position={[0, JAR_H, 0]} rotation-x={Math.PI / 2} material={rimGlass}>
          <torusGeometry args={[JAR_R + 0.01, 0.035, 8, 28]} />
        </mesh>
        {/* Twine tied round the neck, with a little tag. */}
        <mesh position={[0, JAR_H - 0.16, 0]} rotation-x={Math.PI / 2} material={toon('#b98a52')}>
          <torusGeometry args={[JAR_R + 0.012, 0.022, 6, 24]} />
        </mesh>
        <mesh position={[JAR_R * 0.55, JAR_H - 0.3, JAR_R * 0.85]} rotation={[0.1, 0.5, 0.2]} material={toon('#f3e2bf')}>
          <boxGeometry args={[0.14, 0.18, 0.015]} />
        </mesh>
      </Clickable>
      {/* Selection / target / done ring on the raft. */}
      <mesh ref={ring} position={[0, 0.012, 0]} rotation-x={-Math.PI / 2} material={ringMat}>
        <ringGeometry args={[JAR_R + 0.08, JAR_R + 0.16, 40]} />
      </mesh>
      <sprite ref={halo} position={[0, JAR_H * 0.45, 0]} material={haloMat} renderOrder={1} />
      {high && <pointLight ref={light} position={[0, JAR_H * 0.5, 0.2]} distance={3.2} decay={2} />}
    </group>
  );
}

export function JarRow({
  jars,
  selected,
  targets,
  disabled,
  won,
  onJar,
}: {
  jars: Jar[];
  selected: number | null;
  /** For each jar while a firefly is lifted: can it land there? */
  targets: (boolean | null)[];
  disabled: boolean;
  won: boolean;
  onJar(i: number): void;
}) {
  return (
    <group>
      {Array.from({ length: JAR_COUNT }, (_, i) => (
        <GlassJar key={i} index={i} jar={jars[i]} lifted={selected === i} ok={targets[i]} disabled={disabled} won={won} onClick={() => onJar(i)} />
      ))}
    </group>
  );
}

/** The log raft the jars stand on. It bobs a little on the lagoon. */
export function Raft() {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = clock.elapsedTime;
    root.current.rotation.z = Math.sin(t * 0.8) * 0.006;
    root.current.rotation.x = Math.sin(t * 0.6 + 1) * 0.006;
  });
  const logs = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ z: -0.95 + i * 0.4, len: 8.9 + ((i * 37) % 5) * 0.12, r: 0.2 + ((i * 13) % 3) * 0.012 })), []);
  return (
    <group ref={root}>
      {logs.map((l, i) => (
        <group key={i} position={[((i * 17) % 3) * 0.08 - 0.08, JAR_BASE_Y - 0.2, l.z]}>
          <mesh rotation-z={Math.PI / 2} castShadow receiveShadow material={toon(i % 2 ? '#7a5234' : '#8a5e3b')}>
            <cylinderGeometry args={[l.r, l.r, l.len, 9]} />
          </mesh>
          {/* Cut ends. */}
          <mesh position={[l.len / 2 + 0.005, 0, 0]} rotation-z={Math.PI / 2} material={toon('#d9b07a')}>
            <cylinderGeometry args={[l.r * 0.85, l.r * 0.85, 0.02, 9]} />
          </mesh>
          <mesh position={[-l.len / 2 - 0.005, 0, 0]} rotation-z={Math.PI / 2} material={toon('#d9b07a')}>
            <cylinderGeometry args={[l.r * 0.85, l.r * 0.85, 0.02, 9]} />
          </mesh>
        </group>
      ))}
      {/* Flat deck boards on top of the logs, so the jars stand level. */}
      <mesh position={[0, JAR_BASE_Y - 0.03, -0.0]} receiveShadow castShadow material={toon('#a8774a')}>
        <boxGeometry args={[8.6, 0.06, 2.3]} />
      </mesh>
      {/* Rope lashings. */}
      {[-3.9, 0, 3.9].map((x) => (
        <mesh key={x} position={[x, JAR_BASE_Y - 0.12, 0]} material={toon('#c9a26b')}>
          <boxGeometry args={[0.1, 0.24, 2.45]} />
        </mesh>
      ))}
      {/* Moss and a mushroom tuft on the deck corners. */}
      {[
        [-4.05, 0.85],
        [4.0, -0.8],
      ].map(([x, z], i) => (
        <group key={i} position={[x, JAR_BASE_Y, z]}>
          <mesh scale={[0.35, 0.12, 0.3]} material={toon('#4f8f4a')} castShadow>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
