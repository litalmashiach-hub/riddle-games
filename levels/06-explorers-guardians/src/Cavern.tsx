import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { seeded } from '@riddle/fx';
import { toon } from '@riddle/props';
import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BioWater, type BioWaterHandle } from './BioWater';
import { BACK_WALL_Z, DECK, DECK_Y, floorHeight, lakeHalf, smooth, vnoise } from './layout';

/**
 * The level's world: a sunlit sinkhole cave in the Ancient Temple. A glowing lake splits two carved
 * temple floors, a giant guardian face pours a waterfall at the back, and light falls in from above.
 */
export const Cavern = forwardRef<BioWaterHandle, { low: boolean; won: boolean; danger: -1 | 0 | 1 }>(function Cavern({ low, won, danger }, waterRef) {
  return (
    <group>
      <Terrain />
      <BioWater ref={waterRef} low={low} />
      <Deck side={-1} />
      <Deck side={1} />
      <Tiles />
      <Brazier position={[-3.15, DECK_Y, -1.95]} light />
      <Brazier position={[3.15, DECK_Y, -1.95]} light />
      <Brazier position={[-3.15, DECK_Y, 2.05]} light={!low} small />
      <Brazier position={[3.15, DECK_Y, 2.05]} light={!low} small />
      <Column position={[-5.9, DECK_Y, -1.85]} height={2.6} />
      <Column position={[5.9, DECK_Y, -1.85]} height={2.1} broken />
      <Column position={[-5.95, DECK_Y, 1.85]} height={0.9} broken />
      <Column position={[5.95, DECK_Y, 1.8]} height={1.3} broken />
      <GoalGate position={[4.5, DECK_Y, -2.5]} won={won} />
      <Camp />
      <GiantFace won={won} danger={danger !== 0} />
      <Waterfall low={low} />
      <LightShafts />
      <Rocks />
      <Crystals />
      <Mushrooms />
      <Sparkles count={low ? 30 : 90} scale={[16, 4, 12]} position={[0, 2, -1.5]} size={3.2} speed={0.25} opacity={0.9} color="#7ff7e4" />
      <Sparkles count={low ? 20 : 60} scale={[5, 7, 4]} position={[-1, 4, -3.5]} size={2.2} speed={0.15} opacity={0.7} color="#ffe2a8" />
    </group>
  );
});

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(44, 36, 150, 120);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -4);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const wet = new THREE.Color('#2c2a36');
    const sand = new THREE.Color('#b78f62');
    const rockA = new THREE.Color('#6a5446');
    const rockB = new THREE.Color('#4d3f3d');
    const band = new THREE.Color('#9a7552');
    const moss = new THREE.Color('#4f7f3c');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = floorHeight(x, z);
      pos.setY(i, y);
      // slope from neighbours, so moss grows on flat ledges and not on cliffs
      const sx = floorHeight(x + 0.2, z) - floorHeight(x - 0.2, z);
      const sz = floorHeight(x, z + 0.2) - floorHeight(x, z - 0.2);
      const slope = Math.sqrt(sx * sx + sz * sz) / 0.4;
      c.copy(rockA).lerp(rockB, vnoise(x * 0.6, z * 0.6 + y));
      // sandstone strata on the cliffs
      const strata = Math.sin(y * 3.2 + vnoise(x * 0.3, z * 0.3) * 2.5);
      if (strata > 0.55 && y > 0.8) c.lerp(band, 0.55);
      if (y < 0.6 && y > -0.1) c.lerp(sand, 0.55 * smooth(-0.1, 0.4, y));
      if (y < 0.0) c.lerp(wet, smooth(0.0, -0.4, y));
      if (slope < 0.6 && y > 0.25) c.lerp(moss, 0.75 * smooth(0.6, 0.15, slope) * vnoise(x * 0.9 + 4, z * 0.9));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow castShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} />
    </mesh>
  );
}

/** Each bank's raised temple floor with steps down to the water. */
function Deck({ side }: { side: 1 | -1 }) {
  const w = DECK.outer - DECK.inner;
  const cx = side * (DECK.inner + w / 2);
  const d = DECK.front - DECK.back;
  const base = toon('#8c6a4c');
  const trim = toon('#c49a68');
  return (
    <group>
      <mesh position={[cx, DECK_Y - 0.45, 0]} material={base} castShadow receiveShadow>
        <boxGeometry args={[w + 0.1, 0.84, d + 0.1]} />
      </mesh>
      {/* carved lip along the water */}
      <mesh position={[side * (DECK.inner + 0.02), DECK_Y - 0.06, 0]} material={trim} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.14, d + 0.2]} />
      </mesh>
      {/* steps into the lake */}
      <mesh position={[side * (DECK.inner - 0.2), DECK_Y - 0.28, 0]} material={trim} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.14, 2.0]} />
      </mesh>
      <mesh position={[side * (DECK.inner - 0.45), DECK_Y - 0.48, 0]} material={base} receiveShadow>
        <boxGeometry args={[0.4, 0.14, 1.8]} />
      </mesh>
      {/* jade inlay strip that glows faintly */}
      <mesh position={[side * (DECK.inner + 0.02), DECK_Y + 0.015, 0]} material={toon('#46e0a8', { emissive: '#2fdc9c', emissiveIntensity: 1.4 })}>
        <boxGeometry args={[0.05, 0.02, d - 0.4]} />
      </mesh>
    </group>
  );
}

/** Sandstone floor tiles for both decks in one instanced draw. */
function Tiles() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const nx = 8, nz = 8;
  const count = nx * nz * 2;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(66);
    const o = new THREE.Object3D();
    const colors = ['#d6b07c', '#c9a170', '#ddb986', '#c29466'].map((c) => new THREE.Color(c));
    const tw = (DECK.outer - DECK.inner - 0.2) / nx;
    const td = (DECK.front - DECK.back - 0.2) / nz;
    let i = 0;
    for (const side of [-1, 1]) {
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < nz; b++) {
          const x = side * (DECK.inner + 0.1 + tw * (a + 0.5));
          const z = DECK.back + 0.1 + td * (b + 0.5);
          o.position.set(x, DECK_Y - 0.02 + rnd() * 0.025, z);
          o.rotation.set((rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.03);
          o.scale.set(tw - 0.05, 1, td - 0.05);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
          m.setColorAt(i, colors[Math.floor(rnd() * colors.length)]);
          i++;
        }
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} receiveShadow>
      <boxGeometry args={[1, 0.06, 1]} />
      <meshStandardMaterial flatShading roughness={0.9} />
    </instancedMesh>
  );
}

function Flame({ scale = 1, seed = 0 }: { scale?: number; seed?: number }) {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 9 + seed;
    const f = 1 + Math.sin(t) * 0.12 + Math.sin(t * 2.3) * 0.08;
    outer.current?.scale.set(scale * (1 - (f - 1) * 0.5), scale * f, scale * (1 - (f - 1) * 0.5));
    if (outer.current) outer.current.rotation.y = t * 0.2;
    inner.current?.scale.set(scale, scale * (1 + Math.sin(t * 1.7) * 0.15), scale);
  });
  return (
    <group>
      <mesh ref={outer} position-y={0.14 * scale} material={toon('#ff8a2a', { emissive: '#ff6a00', emissiveIntensity: 3.5, flat: true })}>
        <coneGeometry args={[0.13, 0.36, 6]} />
      </mesh>
      <mesh ref={inner} position-y={0.1 * scale} material={toon('#ffe9a0', { emissive: '#ffd36b', emissiveIntensity: 4, flat: true })}>
        <coneGeometry args={[0.07, 0.22, 5]} />
      </mesh>
    </group>
  );
}

function Brazier({ position, light, small }: { position: [number, number, number]; light?: boolean; small?: boolean }) {
  const lamp = useRef<THREE.PointLight>(null);
  const seed = position[0] * 3 + position[2];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 10 + seed;
    if (lamp.current) lamp.current.intensity = 5 + Math.sin(t) * 0.8 + Math.sin(t * 2.7) * 0.5;
  });
  const h = small ? 0.45 : 0.8;
  const stone = toon('#a88a66');
  const dark = toon('#6e5640');
  return (
    <group position={position}>
      <mesh position-y={h / 2} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.17, h, 6]} />
      </mesh>
      <mesh position-y={0.05} material={dark} castShadow>
        <cylinderGeometry args={[0.22, 0.24, 0.1, 6]} />
      </mesh>
      <mesh position-y={h + 0.06} material={dark} castShadow>
        <cylinderGeometry args={[0.24, 0.14, 0.14, 7]} />
      </mesh>
      <group position-y={h + 0.12}>
        <Flame seed={seed} scale={small ? 0.8 : 1} />
      </group>
      {light && <pointLight ref={lamp} position-y={h + 0.45} color="#ff9a45" intensity={5} distance={6.5} decay={1.6} />}
    </group>
  );
}

function Column({ position, height, broken }: { position: [number, number, number]; height: number; broken?: boolean }) {
  const stone = toon('#c8a578');
  const dark = toon('#9c7b58');
  const moss = toon('#5b8e45');
  return (
    <group position={position}>
      <mesh position-y={0.1} material={dark} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.2, 0.6]} />
      </mesh>
      <mesh position-y={0.1 + height / 2} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.23, height, 10]} />
      </mesh>
      {broken ? (
        <mesh position={[0, 0.15 + height, 0]} rotation={[0.3, 0.4, 0.2]} material={stone} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.12, 5]} />
        </mesh>
      ) : (
        <mesh position-y={0.2 + height} material={dark} castShadow>
          <boxGeometry args={[0.58, 0.22, 0.58]} />
        </mesh>
      )}
      <mesh position={[0.12, 0.25 + height * 0.5, 0.12]} scale={[0.9, 0.4, 0.9]} material={moss}>
        <icosahedronGeometry args={[0.16, 0]} />
      </mesh>
    </group>
  );
}

/** The way out on the far bank. It lights up when everyone is safely across. */
function GoalGate({ position, won }: { position: [number, number, number]; won: boolean }) {
  const portal = useRef<THREE.MeshStandardMaterial>(null);
  const beam = useRef<THREE.Mesh>(null);
  const glow = useRef(0);
  useFrame(({ clock }, dt) => {
    glow.current += ((won ? 1 : 0) - glow.current) * Math.min(1, dt * 1.5);
    const g = glow.current;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2);
    if (portal.current) portal.current.emissiveIntensity = 0.08 + pulse * 0.06 + g * 3.5;
    if (beam.current) {
      beam.current.visible = g > 0.02;
      (beam.current.material as THREE.MeshBasicMaterial).opacity = g * 0.35;
    }
  });
  const stone = toon('#c39e70');
  const dark = toon('#8b6b4b');
  const jade = toon('#46e0a8', { emissive: '#2fdc9c', emissiveIntensity: 2.6 });
  return (
    <group position={position}>
      {[-0.75, 0.75].map((x) => (
        <group key={x} position-x={x}>
          <mesh position-y={0.95} material={stone} castShadow receiveShadow>
            <boxGeometry args={[0.38, 1.9, 0.42]} />
          </mesh>
          <mesh position-y={0.08} material={dark} castShadow>
            <boxGeometry args={[0.5, 0.16, 0.52]} />
          </mesh>
          <mesh position={[0, 1.2, 0.215]} material={jade}>
            <boxGeometry args={[0.12, 0.12, 0.02]} />
          </mesh>
        </group>
      ))}
      <mesh position-y={2.05} material={dark} castShadow>
        <boxGeometry args={[2.1, 0.32, 0.55]} />
      </mesh>
      <mesh position-y={2.35} material={stone} castShadow>
        <boxGeometry args={[1.5, 0.28, 0.45]} />
      </mesh>
      {/* glyph: an eye, the guardians' sign */}
      <mesh position={[0, 2.05, 0.28]} rotation-z={Math.PI / 4} material={jade}>
        <torusGeometry args={[0.1, 0.025, 4, 4]} />
      </mesh>
      {/* the doorway */}
      <mesh position={[0, 0.95, -0.05]}>
        <planeGeometry args={[1.12, 1.9]} />
        <meshStandardMaterial ref={portal} color="#120c0a" emissive="#ffb84a" emissiveIntensity={0.1} roughness={1} />
      </mesh>
      <mesh ref={beam} position={[0, 2.8, 0.3]} visible={false}>
        <cylinderGeometry args={[0.45, 0.75, 5, 12, 1, true]} />
        <meshBasicMaterial color="#ffd98a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}

/** The explorers' little camp on the near bank: crates, a rope coil and a rope down the cliff. */
function Camp() {
  const wood = toon('#9a6a3c');
  const dark = toon('#6a4426');
  const rope = toon('#d8b878');
  const canvas = toon('#d9c9a0');
  return (
    <group>
      <group position={[-5.25, DECK_Y, -1.75]} rotation-y={0.4}>
        <mesh position-y={0.2} material={wood} castShadow receiveShadow>
          <boxGeometry args={[0.45, 0.4, 0.4]} />
        </mesh>
        <mesh position-y={0.2} material={dark}>
          <boxGeometry args={[0.47, 0.06, 0.42]} />
        </mesh>
        <mesh position={[0.05, 0.53, 0]} rotation-y={0.5} material={wood} castShadow>
          <boxGeometry args={[0.3, 0.26, 0.28]} />
        </mesh>
        <mesh position={[0.45, 0.06, 0.2]} rotation-x={Math.PI / 2} material={rope} castShadow>
          <torusGeometry args={[0.13, 0.04, 5, 12]} />
        </mesh>
        {/* rolled map */}
        <mesh position={[-0.1, 0.43, 0.05]} rotation={[0, 0.8, Math.PI / 2]} material={canvas} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 6]} />
        </mesh>
      </group>
      {/* rope hanging down the back cliff */}
      <mesh position={[-4.9, 3.0, -3.2]} rotation-x={0.35} material={rope}>
        <cylinderGeometry args={[0.025, 0.025, 6, 4]} />
      </mesh>
    </group>
  );
}

/**
 * A huge carved guardian face in the back cliff. Water pours from its mouth.
 * Its eyes glow jade, flare gold on a win and turn red when the rule is broken.
 */
function GiantFace({ won, danger }: { won: boolean; danger: boolean }) {
  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3ff5b8', emissive: '#3ff5b8', emissiveIntensity: 2.6, toneMapped: false }), []);
  const eyes = useRef(eyeMat);
  const tmp = useMemo(() => new THREE.Color(), []);
  const jade = useMemo(() => new THREE.Color('#3ff5b8'), []);
  const gold = useMemo(() => new THREE.Color('#ffd36b'), []);
  const red = useMemo(() => new THREE.Color('#ff3b2f'), []);
  useFrame(({ clock }, dt) => {
    const m = eyes.current;
    if (!m) return;
    const target = won ? gold : danger ? red : jade;
    tmp.copy(m.emissive).lerp(target, Math.min(1, dt * 3));
    m.emissive.copy(tmp);
    m.color.copy(tmp);
    m.emissiveIntensity = (won ? 4.5 : danger ? 4 : 2.6) + Math.sin(clock.elapsedTime * 1.5) * 0.4;
  });
  const stone = toon('#b8946a');
  const dark = toon('#7f6248');
  const deep = toon('#2a1d18');
  const moss = toon('#5b8e45');
  const z = BACK_WALL_Z - 0.35;
  return (
    <group position={[0, 0, z]}>
      {/* tablet the face is carved in */}
      <mesh position={[0, 2.1, -0.3]} material={dark} castShadow receiveShadow>
        <boxGeometry args={[5.2, 4.6, 0.6]} />
      </mesh>
      <mesh position={[0, 2.2, 0]} material={stone} castShadow receiveShadow>
        <boxGeometry args={[4.4, 3.9, 0.5]} />
      </mesh>
      {/* headdress */}
      <mesh position={[0, 4.35, 0.05]} material={dark} castShadow>
        <boxGeometry args={[4.8, 0.5, 0.7]} />
      </mesh>
      {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
        <mesh key={x} position={[x, 4.75, 0.05]} rotation-z={Math.PI / 4} material={stone} castShadow>
          <boxGeometry args={[0.38, 0.38, 0.5]} />
        </mesh>
      ))}
      {/* brow */}
      <mesh position={[0, 3.25, 0.35]} material={dark} castShadow>
        <boxGeometry args={[3.4, 0.32, 0.45]} />
      </mesh>
      {/* eyes */}
      {[-0.95, 0.95].map((x) => (
        <group key={x} position={[x, 2.75, 0.27]}>
          <mesh material={deep}>
            <boxGeometry args={[1.0, 0.5, 0.06]} />
          </mesh>
          <mesh position-z={0.04} material={eyeMat}>
            <boxGeometry args={[0.7, 0.24, 0.06]} />
          </mesh>
        </group>
      ))}
      {/* nose */}
      <mesh position={[0, 2.2, 0.45]} material={stone} castShadow>
        <boxGeometry args={[0.55, 0.7, 0.45]} />
      </mesh>
      {/* mouth */}
      <mesh position={[0, 1.38, 0.3]} material={dark} castShadow>
        <boxGeometry args={[1.9, 0.62, 0.3]} />
      </mesh>
      <mesh position={[0, 1.38, 0.42]} material={deep}>
        <boxGeometry args={[1.45, 0.38, 0.1]} />
      </mesh>
      {/* cheek glyphs */}
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} position={[x, 1.8, 0.27]} material={toon('#46e0a8', { emissive: '#2fdc9c', emissiveIntensity: 1.8 })}>
          <torusGeometry args={[0.18, 0.04, 4, 8]} />
        </mesh>
      ))}
      {/* moss and hanging greenery */}
      {[[-2.1, 4.65, 0.1, 0.45], [1.7, 4.62, 0.15, 0.38], [2.35, 2.4, 0.25, 0.3], [-2.35, 1.0, 0.25, 0.35]].map(([x, y, zz, r], i) => (
        <mesh key={i} position={[x, y, zz]} scale={[1.3, 0.6, 0.8]} material={moss} castShadow>
          <icosahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
      <Vines />
      {/* rubble at the waterline */}
      {[[-2.2, 0.1, 0.8, 0.45], [2.4, 0.05, 0.6, 0.55], [-1.3, -0.05, 1.1, 0.3]].map(([x, y, zz, r], i) => (
        <mesh key={i} position={[x, y, zz]} rotation={[i, i * 2, 0]} material={stone} castShadow receiveShadow>
          <dodecahedronGeometry args={[r, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** Vines hanging from the top of the carved face, swaying a little. */
function Vines() {
  const ref = useRef<THREE.Group>(null);
  const vines = useMemo(() => {
    const rnd = seeded(31);
    return Array.from({ length: 9 }, (_, i) => ({ x: -2.3 + i * 0.58 + (rnd() - 0.5) * 0.3, len: 0.8 + rnd() * 1.4, seed: rnd() * 6 }));
  }, []);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => (c.rotation.z = Math.sin(clock.elapsedTime * 0.9 + vines[i].seed) * 0.05));
  });
  const vine = toon('#3f7a35');
  const leaf = toon('#6cbf4a');
  return (
    <group ref={ref} position={[0, 4.1, 0.42]}>
      {vines.map((v, i) => (
        <group key={i} position-x={v.x}>
          <mesh position-y={-v.len / 2} material={vine}>
            <cylinderGeometry args={[0.02, 0.015, v.len, 4]} />
          </mesh>
          <mesh position-y={-v.len} material={leaf}>
            <icosahedronGeometry args={[0.07, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const fallVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const fallFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    float streak = noise(vec2(vUv.x * 18.0, vUv.y * 2.0 + uTime * 2.6));
    streak = smoothstep(0.45, 0.9, streak + noise(vec2(vUv.x * 40.0, vUv.y * 5.0 + uTime * 3.4)) * 0.3);
    float side = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    vec3 col = mix(vec3(0.2, 0.75, 0.8), vec3(0.85, 1.0, 1.0), streak);
    col *= 1.0 + streak * 1.4;
    float a = side * (0.55 + streak * 0.45);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** Glowing water pouring from the giant face's mouth, with foam and mist at the bottom. */
function Waterfall({ low }: { low: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const foam = useRef<THREE.Group>(null);
  const uniforms = useMemo(() => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]), []);
  useFrame(({ clock }, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
    foam.current?.children.forEach((c, i) => {
      const t = clock.elapsedTime * 3 + i * 1.7;
      const s = 0.8 + Math.sin(t) * 0.25;
      c.scale.setScalar(s);
      c.position.y = 0.05 + Math.abs(Math.sin(t * 0.7)) * 0.08;
    });
  });
  const z = BACK_WALL_Z + 0.2;
  const foamMat = toon('#e6fffb', { emissive: '#bff8f0', emissiveIntensity: 1.2 });
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.65, 0]} rotation-x={-0.12}>
        <planeGeometry args={[1.35, 1.4, 1, 1]} />
        <shaderMaterial ref={mat} vertexShader={fallVertex} fragmentShader={fallFragment} uniforms={uniforms} transparent depthWrite={false} fog side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <group ref={foam} position-z={0.3}>
        {Array.from({ length: low ? 5 : 9 }, (_, i) => (
          <mesh key={i} position={[-0.7 + (i / (low ? 4 : 8)) * 1.4, 0.05, (i % 3) * 0.12]} material={foamMat}>
            <icosahedronGeometry args={[0.14 + (i % 2) * 0.05, 0]} />
          </mesh>
        ))}
      </group>
      <Sparkles count={low ? 10 : 30} scale={[2, 1, 1]} position={[0, 0.4, 0.4]} size={4} speed={0.8} opacity={0.8} color="#d8fff8" />
    </group>
  );
}

const rayVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const rayFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    float across = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
    float along = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
    float flicker = 0.8 + 0.2 * sin(uTime * 0.7 + uSeed * 4.0);
    gl_FragColor = vec4(vec3(1.0, 0.85, 0.6), across * along * 0.16 * flicker);
  }
`;

/** Soft beams of sunset light falling in through the cave opening above. */
function LightShafts() {
  const shafts = useMemo(
    () => [
      { p: [-1.6, 4.2, -4.6] as const, w: 1.6, h: 9.5, r: -0.42, s: 0 },
      { p: [0.6, 4.0, -5.4] as const, w: 1.1, h: 9.0, r: -0.4, s: 1 },
      { p: [-3.6, 4.4, -3.6] as const, w: 0.9, h: 9.5, r: -0.45, s: 2 },
    ],
    [],
  );
  const mats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  useFrame((_, dt) => mats.current.forEach((m) => m && (m.uniforms.uTime.value += dt)));
  return (
    <group>
      {shafts.map((s, i) => (
        <mesh key={i} position={s.p as unknown as [number, number, number]} rotation-z={s.r}>
          <planeGeometry args={[s.w, s.h]} />
          <shaderMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            vertexShader={rayVertex}
            fragmentShader={rayFragment}
            uniforms={{ uTime: { value: 0 }, uSeed: { value: s.s } }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

const onDeck = (x: number, z: number) => Math.abs(x) > DECK.inner - 0.6 && Math.abs(x) < DECK.outer + 0.3 && z > DECK.back - 0.3 && z < DECK.front + 0.3;

/** Boulders along the shores and at the foot of the cliffs. */
function Rocks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 46;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rnd = seeded(19);
    const o = new THREE.Object3D();
    const cols = ['#7a6656', '#8d7a68', '#5e5050', '#9a8470'].map((c) => new THREE.Color(c));
    let n = 0;
    for (let tries = 0; n < count && tries < 2000; tries++) {
      const side = rnd() > 0.5 ? 1 : -1;
      const z = -8 + rnd() * 13.5;
      const x = side * (lakeHalf(z) - 0.2 + rnd() * 5.5);
      if (onDeck(x, z)) continue;
      if (z > 2.7 && Math.abs(x) < lakeHalf(z) + 0.3) continue;
      const y = floorHeight(x, z);
      if (y > 3) continue;
      const s = 0.18 + rnd() * 0.45;
      o.position.set(x, y + s * 0.2, z);
      o.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
      o.scale.set(s * (1 + rnd() * 0.5), s * (0.6 + rnd() * 0.4), s);
      o.updateMatrix();
      m.setMatrixAt(n, o.matrix);
      m.setColorAt(n, cols[n % cols.length]);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial flatShading roughness={0.95} />
    </instancedMesh>
  );
}

/** Glowing crystal clusters, jade and violet. */
function Crystals() {
  const jade = useRef<THREE.InstancedMesh>(null);
  const violet = useRef<THREE.InstancedMesh>(null);
  const per = 34;
  useLayoutEffect(() => {
    const rnd = seeded(77);
    const o = new THREE.Object3D();
    const clusters: [number, number][] = [
      [-7.6, 2.9], [7.5, 3.0], [-3.4, 3.3], [3.7, 3.4], [-7.9, -2.9], [8.0, -2.6], [-4.6, -6.6], [4.9, -6.4], [-2.8, -8.0], [2.9, -7.9],
      [-8.4, 0.2], [8.5, -0.4],
    ];
    for (const [ref, offset] of [[jade, 0], [violet, 1]] as const) {
      const m = ref.current;
      if (!m) continue;
      let n = 0;
      clusters.forEach(([cx, cz], ci) => {
        if ((ci + offset) % 2) return;
        const k = 5 + Math.floor(rnd() * 2);
        for (let j = 0; j < k && n < per; j++) {
          const x = cx + (rnd() - 0.5) * 0.7, z = cz + (rnd() - 0.5) * 0.6;
          const y = Math.max(floorHeight(x, z), -0.1);
          const h = 0.35 + rnd() * 0.6;
          o.position.set(x, y + h * 0.35, z);
          o.rotation.set((rnd() - 0.5) * 0.9, rnd() * 6, (rnd() - 0.5) * 0.9);
          o.scale.set(0.11 + rnd() * 0.06, h, 0.11 + rnd() * 0.06);
          o.updateMatrix();
          m.setMatrixAt(n++, o.matrix);
        }
      });
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
  }, []);
  return (
    <>
      <instancedMesh ref={jade} args={[undefined, undefined, per]} castShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#7dffcf" emissive="#2fe0a0" emissiveIntensity={2.4} roughness={0.25} metalness={0.1} flatShading />
      </instancedMesh>
      <instancedMesh ref={violet} args={[undefined, undefined, per]} castShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#d6a8ff" emissive="#a565ff" emissiveIntensity={2.4} roughness={0.25} metalness={0.1} flatShading />
      </instancedMesh>
    </>
  );
}

/** Little glowing cave mushrooms in clumps. Caps glow cyan or pink. */
function Mushrooms() {
  const stems = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const count = 60;
  useLayoutEffect(() => {
    const s = stems.current, c = caps.current;
    if (!s || !c) return;
    const rnd = seeded(123);
    const o = new THREE.Object3D();
    const glow = [new THREE.Color('#5ff6ff').multiplyScalar(2.4), new THREE.Color('#ff7ad9').multiplyScalar(2.2), new THREE.Color('#8dff9e').multiplyScalar(2.2)];
    const clumps: [number, number][] = [
      [-5.6, 3.2], [6.1, 3.3], [-8.2, 1.4], [8.3, 1.2], [-3.3, -3.4], [3.5, -3.6], [-6.4, -3.3], [-4.0, 4.4], [4.3, 4.2], [-7.4, -5.2], [7.2, -5.0],
    ];
    let n = 0;
    clumps.forEach(([cx, cz], ci) => {
      const k = 4 + Math.floor(rnd() * 3);
      for (let j = 0; j < k && n < count; j++) {
        const x = cx + (rnd() - 0.5) * 0.9, z = cz + (rnd() - 0.5) * 0.8;
        if (onDeck(x, z)) continue;
        const y = floorHeight(x, z);
        const h = 0.12 + rnd() * 0.22;
        const r = 0.07 + rnd() * 0.09;
        const tilt = (rnd() - 0.5) * 0.4;
        o.position.set(x, y + h / 2, z);
        o.rotation.set(tilt, 0, tilt);
        o.scale.set(1, h, 1);
        o.updateMatrix();
        s.setMatrixAt(n, o.matrix);
        o.position.set(x + tilt * h * 0.5, y + h, z - tilt * h * 0.5);
        o.scale.set(r, r * 0.7, r);
        o.updateMatrix();
        c.setMatrixAt(n, o.matrix);
        c.setColorAt(n, glow[ci % glow.length]);
        n++;
      }
    });
    s.count = n;
    c.count = n;
    s.instanceMatrix.needsUpdate = true;
    c.instanceMatrix.needsUpdate = true;
    if (c.instanceColor) c.instanceColor.needsUpdate = true;
  }, []);
  return (
    <>
      <instancedMesh ref={stems} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.025, 0.035, 1, 5]} />
        <meshStandardMaterial color="#efe6d2" roughness={0.8} flatShading />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}
