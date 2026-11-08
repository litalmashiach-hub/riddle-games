import { useFrame } from '@react-three/fiber';
import { seeded } from '@riddle/fx';
import { toon } from '@riddle/props';
import { forwardRef, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { LOG_R } from './layout';
import type { Piece } from './rules';

const BARK = ['#b57a48', '#a86d3f', '#c08552', '#a97447'];
const glowBack = (color: string, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity, toneMapped: false, depthWrite: false });

/**
 * A chunky floating log. Lies along local +x; the parent turns it for columns.
 * `glow` draws a bright outline (selected or hinted).
 */
export function LogModel({ piece, seed, glow, children }: { piece: Piece; seed: number; glow: string | null; children?: ReactNode }) {
  const L = piece.len - 0.16;
  const bark = toon(BARK[seed % BARK.length], { rough: 0.9, emissive: '#5a3418', emissiveIntensity: 0.35 });
  const dark = toon('#6b4329', { rough: 1 });
  const wood = toon('#f2cf98', { rough: 0.85, emissive: '#7a5426', emissiveIntensity: 0.3 });
  const ring = toon('#c48f55', { rough: 0.85 });
  const outline = useMemo(() => (glow ? glowBack(glow, 0.85) : null), [glow]);
  const deco = useMemo(() => {
    const rnd = seeded(seed * 13 + 1);
    // Bark ridges and knots, placed once per log.
    const ridges = Array.from({ length: 5 }, () => ({ a: rnd() * Math.PI * 2, x: (rnd() - 0.5) * L * 0.8, l: 0.25 + rnd() * 0.35 }));
    const knots = Array.from({ length: 2 }, () => ({ a: -0.6 + rnd() * 1.2, x: (rnd() - 0.5) * L * 0.7 }));
    const moss = Array.from({ length: 3 }, () => ({ x: (rnd() - 0.5) * L * 0.7, s: 0.12 + rnd() * 0.1, a: (rnd() - 0.5) * 0.8 }));
    return { ridges, knots, moss };
  }, [seed, L]);

  return (
    <group>
      <mesh rotation-z={Math.PI / 2} material={bark} castShadow receiveShadow>
        <cylinderGeometry args={[LOG_R, LOG_R * 1.04, L, 11, 1]} />
      </mesh>
      {outline && (
        <mesh rotation-z={Math.PI / 2} material={outline} scale={[1.13, 1.04, 1.13]}>
          <cylinderGeometry args={[LOG_R, LOG_R, L + 0.06, 14, 1]} />
        </mesh>
      )}
      {/* Cut ends with growth rings. */}
      {[1, -1].map((s) => (
        <group key={s} position-x={(s * L) / 2} rotation-z={(s * -Math.PI) / 2}>
          <mesh position-y={0.012} material={wood}>
            <cylinderGeometry args={[LOG_R * 0.9, LOG_R * 0.9, 0.03, 11]} />
          </mesh>
          <mesh position-y={0.03} rotation-x={Math.PI / 2} material={ring}>
            <torusGeometry args={[LOG_R * 0.55, 0.018, 4, 14]} />
          </mesh>
          <mesh position-y={0.03} rotation-x={Math.PI / 2} material={ring}>
            <torusGeometry args={[LOG_R * 0.27, 0.016, 4, 10]} />
          </mesh>
        </group>
      ))}
      {deco.ridges.map((r, i) => (
        <mesh key={i} position={[r.x, Math.cos(r.a) * LOG_R * 0.98, Math.sin(r.a) * LOG_R * 0.98]} rotation-x={r.a} material={dark}>
          <boxGeometry args={[r.l, 0.03, 0.05]} />
        </mesh>
      ))}
      {deco.knots.map((k, i) => (
        <mesh key={i} position={[k.x, Math.cos(k.a) * LOG_R, Math.sin(k.a) * LOG_R]} rotation-x={k.a} material={dark} scale={[1, 0.5, 1]}>
          <icosahedronGeometry args={[0.07, 0]} />
        </mesh>
      ))}
      {deco.moss.map((m, i) => (
        <mesh key={i} position={[m.x, LOG_R * 0.92, m.a * 0.2]} scale={[m.s * 1.5, 0.06, m.s * 0.9]} material={toon('#5fb24f', { rough: 1 })}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      {children}
    </group>
  );
}

/** Dottie's raft: honey-coloured planks, rope ties, a pennant and a little lantern. */
export const RaftModel = forwardRef<THREE.Group, { glow: string | null; children?: ReactNode }>(function RaftModel({ glow, children }, ref) {
  const flag = useRef<THREE.Mesh>(null);
  const outline = useMemo(() => (glow ? glowBack(glow, 0.8) : null), [glow]);
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 4) * 0.25;
  });
  const plank = ['#e7a85a', '#d99446', '#f0b86a'];
  return (
    <group ref={ref}>
      {[-0.22, 0, 0.22].map((z, i) => (
        <mesh key={z} position={[0, 0.17, z]} material={toon(plank[i], { rough: 0.8 })} castShadow receiveShadow>
          <boxGeometry args={[1.74 - (i === 1 ? 0 : 0.08), 0.12, 0.21]} />
        </mesh>
      ))}
      {/* Barrel floats under the deck. */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]} rotation-x={Math.PI / 2} material={toon('#9b6236')} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.66, 10]} />
        </mesh>
      ))}
      {outline && (
        <mesh position={[0, 0.15, 0]} material={outline}>
          <boxGeometry args={[1.92, 0.3, 0.84]} />
        </mesh>
      )}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.17, 0]} rotation-y={Math.PI / 2} material={toon('#f3e3c0')}>
          <torusGeometry args={[0.33, 0.025, 4, 16, Math.PI]} />
        </mesh>
      ))}
      {/* Mast with a pennant. */}
      <mesh position={[-0.68, 0.62, -0.25]} material={toon('#6a452c')} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.9, 5]} />
      </mesh>
      <mesh ref={flag} position={[-0.68, 0.95, -0.25]} material={toon('#ff5d73', { emissive: '#ff2d55', emissiveIntensity: 0.3 })}>
        <coneGeometry args={[0.1, 0.36, 3]} />
      </mesh>
      {/* A tiny lantern on the bow. */}
      <mesh position={[0.74, 0.32, 0.25]} material={toon('#ffd36b', { emissive: '#ffb02e', emissiveIntensity: 3 })}>
        <sphereGeometry args={[0.07, 8, 6]} />
      </mesh>
      {children}
    </group>
  );
});

/** A sleepy green frog that sits on a log and croaks now and then. */
export function Frog({ excited }: { excited: number }) {
  const body = useRef<THREE.Group>(null);
  const sac = useRef<THREE.Mesh>(null);
  const green = toon('#6ccf4e');
  const belly = toon('#d9f58a');
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const since = (performance.now() - excited) / 1000;
    if (body.current) {
      body.current.position.y = LOG_R + 0.02 + (since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * 0.25 : 0);
      body.current.scale.y = 1 + Math.sin(t * 2.2) * 0.03;
    }
    if (sac.current) {
      const puff = since < 1.2 ? Math.abs(Math.sin(since * 9)) : Math.max(0, Math.sin(t * 0.9) - 0.85) * 6;
      sac.current.scale.setScalar(0.6 + puff * 0.7);
    }
  });
  return (
    <group ref={body} position={[0.1, LOG_R + 0.02, 0]} rotation-y={0.4} scale={1.6}>
      <mesh position-y={0.1} scale={[1.2, 0.75, 1]} material={green} castShadow>
        <icosahedronGeometry args={[0.15, 1]} />
      </mesh>
      <mesh ref={sac} position={[0, 0.05, 0.13]} material={belly}>
        <sphereGeometry args={[0.07, 8, 6]} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.08, 0.22, 0.05]}>
          <mesh material={green}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </mesh>
          <mesh position-z={0.04} material={toon('#ffffff', { flat: false })}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
          <mesh position-z={0.07} material={toon('#151515', { flat: false })}>
            <sphereGeometry args={[0.02, 6, 6]} />
          </mesh>
        </group>
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.15, 0.02, 0.02]} scale={[0.9, 0.35, 1.3]} material={green}>
          <icosahedronGeometry args={[0.08, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** A snail with a glowing swirly shell. */
export function Snail() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.position.x = -0.2 + Math.sin(clock.elapsedTime * 0.25) * 0.25;
  });
  return (
    <group ref={g} position={[0, LOG_R, 0.02]}>
      <mesh position={[0, 0.04, 0]} scale={[1.6, 0.5, 0.7]} material={toon('#e9d7a8')}>
        <sphereGeometry args={[0.08, 8, 6]} />
      </mesh>
      <mesh position={[-0.03, 0.13, 0]} material={toon('#ff9a5a', { emissive: '#ff7a3a', emissiveIntensity: 0.8 })} castShadow>
        <torusGeometry args={[0.065, 0.045, 6, 12]} />
      </mesh>
      <mesh position={[-0.03, 0.13, 0.03]} material={toon('#ffd36b', { emissive: '#ffb02e', emissiveIntensity: 1.6 })}>
        <sphereGeometry args={[0.03, 6, 4]} />
      </mesh>
      {[0.03, -0.03].map((z) => (
        <mesh key={z} position={[0.13, 0.12, z]} rotation-z={-0.4} material={toon('#e9d7a8')}>
          <cylinderGeometry args={[0.008, 0.008, 0.1, 4]} />
        </mesh>
      ))}
    </group>
  );
}

export function LogMushrooms({ seed }: { seed: number }) {
  const rnd = seeded(seed * 7 + 3);
  const items = Array.from({ length: 3 }, (_, i) => ({ x: -0.35 + i * 0.3 + rnd() * 0.1, s: 0.06 + rnd() * 0.05, a: (rnd() - 0.5) * 0.9 }));
  return (
    <group>
      {items.map((m, i) => (
        <group key={i} position={[m.x, Math.cos(m.a) * LOG_R, Math.sin(m.a) * LOG_R]} rotation-x={m.a}>
          <mesh position-y={m.s} material={toon('#f3ead2')}>
            <cylinderGeometry args={[m.s * 0.3, m.s * 0.35, m.s * 2, 5]} />
          </mesh>
          <mesh position-y={m.s * 2} material={toon('#7ef0ff', { emissive: '#36e6ff', emissiveIntensity: 2.6 })}>
            <sphereGeometry args={[m.s * 1.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function LogFlowers() {
  const spots = [-0.4, -0.1, 0.25, 0.45];
  return (
    <group>
      {spots.map((x, i) => (
        <group key={i} position={[x, LOG_R + 0.02, (i % 2 ? 1 : -1) * 0.08]}>
          {Array.from({ length: 5 }, (_, k) => {
            const a = (k / 5) * Math.PI * 2;
            return (
              <mesh key={k} position={[Math.cos(a) * 0.045, 0.02, Math.sin(a) * 0.045]} scale={[1, 0.4, 1]} material={toon(i % 2 ? '#ffd0f0' : '#fff2b3')}>
                <sphereGeometry args={[0.035, 6, 4]} />
              </mesh>
            );
          })}
          <mesh position-y={0.035} material={toon('#ffcc33', { emissive: '#ffaa00', emissiveIntensity: 1.5 })}>
            <sphereGeometry args={[0.022, 6, 4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
