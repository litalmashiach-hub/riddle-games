import { useFrame } from '@react-three/fiber';
import { Clickable, seeded, useSettings } from '@riddle/fx';
import { groundHeight, toon } from '@riddle/props';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { pumpSound } from './audio';
import { FLOW_END, GO_MS, PUMP_POS, SPOUT, YARD_CENTER, YARD_RADIUS, YARD_Y, type Anim } from './layout';

/** Round cobbled yard. One draw call for all cobbles. */
export function Cobbles() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const edge = useRef<THREE.InstancedMesh>(null);
  const COUNT = 190;
  const EDGE = 40;
  useLayoutEffect(() => {
    const m = ref.current;
    const e = edge.current;
    if (!m || !e) return;
    const rnd = seeded(31);
    const o = new THREE.Object3D();
    const tones = ['#c9bfae', '#b3a996', '#d8cfbf', '#a59a87'].map((c) => new THREE.Color(c));
    let n = 0;
    const step = 0.27;
    for (let row = -9; row <= 9; row++) {
      for (let col = -9; col <= 9; col++) {
        const x = col * step + (row % 2 ? step / 2 : 0) + (rnd() - 0.5) * 0.05;
        const z = row * step * 0.88 + (rnd() - 0.5) * 0.05;
        if (Math.hypot(x, z) > YARD_RADIUS - 0.2 || n >= COUNT) continue;
        o.position.set(YARD_CENTER[0] + x, YARD_Y - 0.03, YARD_CENTER[1] + z);
        o.rotation.set(0, rnd() * Math.PI, 0);
        const s = 0.115 + rnd() * 0.02;
        o.scale.set(s, 0.035, s * (0.85 + rnd() * 0.25));
        o.updateMatrix();
        m.setMatrixAt(n, o.matrix);
        m.setColorAt(n, tones[Math.floor(rnd() * tones.length)]);
        n++;
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    for (let i = 0; i < EDGE; i++) {
      const a = (i / EDGE) * Math.PI * 2;
      o.position.set(YARD_CENTER[0] + Math.cos(a) * YARD_RADIUS, YARD_Y - 0.05, YARD_CENTER[1] + Math.sin(a) * YARD_RADIUS);
      o.rotation.set(rnd() * 0.3, -a, rnd() * 0.3);
      const s = 0.13 + rnd() * 0.04;
      o.scale.set(s * 1.4, s * 0.7, s);
      o.updateMatrix();
      e.setMatrixAt(i, o.matrix);
      e.setColorAt(i, tones[(i * 3) % tones.length].clone().multiplyScalar(0.85));
    }
    e.instanceMatrix.needsUpdate = true;
    if (e.instanceColor) e.instanceColor.needsUpdate = true;
  }, []);
  return (
    <group>
      {/* Packed-earth base under the cobbles, deep enough to sit into the bank. */}
      <mesh position={[YARD_CENTER[0], YARD_Y - 0.4, YARD_CENTER[1]]} material={toon('#8d7a5f')} receiveShadow castShadow>
        <cylinderGeometry args={[YARD_RADIUS, YARD_RADIUS + 0.2, 0.74, 40]} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} receiveShadow castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={edge} args={[undefined, undefined, EDGE]} receiveShadow castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading roughness={0.95} />
      </instancedMesh>
    </group>
  );
}

/** Cast-iron hand pump. Its handle pumps while a jug fills, and it glows when the hint points at it. */
export function Pump({ anim, onClick, disabled }: { anim: RefObject<Anim>; onClick(): void; disabled: boolean }) {
  const handle = useRef<THREE.Group>(null);
  const squeaked = useRef(-1);
  const iron = toon('#2f7d6d', { rough: 0.45, metal: 0.35 });
  const ironDark = toon('#1f5248', { rough: 0.5, metal: 0.3 });
  const brass = toon('#e3b04b', { rough: 0.3, metal: 0.8 });
  const stone = toon('#9a9488');
  const spoutLen = PUMP_POS[0] - SPOUT[0];
  useFrame(() => {
    const a = anim.current;
    const h = handle.current;
    if (!h) return;
    const el = performance.now() - a.start;
    const pumping = a.forward && a.move?.kind === 'fill' && el > GO_MS - 250 && el < FLOW_END - 150;
    if (pumping && squeaked.current !== a.id) {
      squeaked.current = a.id;
      pumpSound();
    }
    const target = pumping ? Math.sin((el - GO_MS + 250) * 0.021) * 0.5 : 0.25;
    h.rotation.z += (target - h.rotation.z) * 0.25;
  });
  return (
    <group position={PUMP_POS}>
      <Clickable onClick={onClick} disabled={disabled} hoverScale={1.04}>
        <mesh position-y={0.08} material={stone} castShadow receiveShadow>
          <cylinderGeometry args={[0.26, 0.3, 0.16, 8]} />
        </mesh>
        <mesh position-y={0.62} material={iron} castShadow>
          <cylinderGeometry args={[0.1, 0.13, 1.0, 10]} />
        </mesh>
        <mesh position-y={0.2} material={ironDark} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 10]} />
        </mesh>
        <mesh position-y={1.16} material={iron} castShadow>
          <cylinderGeometry args={[0.13, 0.11, 0.18, 10]} />
        </mesh>
        <mesh position-y={1.28} material={brass} castShadow>
          <sphereGeometry args={[0.08, 10, 8]} />
        </mesh>
        {/* Spout reaching out over the filling spot. */}
        <mesh position={[-spoutLen / 2, SPOUT[1] - YARD_Y + 0.03, SPOUT[2] - PUMP_POS[2]]} rotation-z={Math.PI / 2} material={iron} castShadow>
          <cylinderGeometry args={[0.045, 0.06, spoutLen, 8]} />
        </mesh>
        <mesh position={[-spoutLen, SPOUT[1] - YARD_Y, SPOUT[2] - PUMP_POS[2]]} material={brass} castShadow>
          <cylinderGeometry args={[0.055, 0.045, 0.08, 8]} />
        </mesh>
        <group ref={handle} position={[0.1, 1.18, 0]}>
          <mesh position={[0.32, 0, 0]} rotation-z={Math.PI / 2} material={ironDark} castShadow>
            <cylinderGeometry args={[0.025, 0.03, 0.64, 6]} />
          </mesh>
          <mesh position={[0.66, 0, 0]} material={toon('#7a4a2a')} castShadow>
            <capsuleGeometry args={[0.04, 0.12, 3, 6]} />
          </mesh>
        </group>
        {/* Bigger hit area for phones. */}
        <mesh position-y={0.7} visible={false}>
          <cylinderGeometry args={[0.45, 0.45, 1.5, 8]} />
        </mesh>
      </Clickable>
    </group>
  );
}

/** A stone well with a little roof and a bobbing bucket. Scenery. */
export function Well({ position }: { position: [number, number, number] }) {
  const bucket = useRef<THREE.Group>(null);
  const stones = useMemo(() => {
    const rnd = seeded(77);
    const out: { p: [number, number, number]; r: number; s: number; c: string }[] = [];
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + (layer % 2) * 0.26;
        out.push({ p: [Math.cos(a) * 0.5, 0.12 + layer * 0.2, Math.sin(a) * 0.5], r: -a, s: 0.9 + rnd() * 0.2, c: ['#b6ad9c', '#a39a89', '#c7bfae'][Math.floor(rnd() * 3)] });
      }
    }
    return out;
  }, []);
  useFrame(({ clock }) => {
    if (bucket.current) bucket.current.position.y = 1.05 + Math.sin(clock.elapsedTime * 1.3) * 0.03;
  });
  const wood = toon('#8a5a33');
  const roof = toon('#b5523b');
  return (
    <group position={position}>
      {stones.map((s, i) => (
        <mesh key={i} position={s.p} rotation-y={s.r} scale={s.s} material={toon(s.c)} castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.19, 0.3]} />
        </mesh>
      ))}
      <mesh position-y={0.42} rotation-x={-Math.PI / 2} material={toon('#14466b', { emissive: '#1b6a9a', emissiveIntensity: 0.4, rough: 0.2, flat: false })}>
        <circleGeometry args={[0.4, 20]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.55, 0.85, 0]} material={wood} castShadow>
          <boxGeometry args={[0.08, 1.3, 0.08]} />
        </mesh>
      ))}
      <mesh position={[0, 1.32, 0]} rotation-z={Math.PI / 2} material={wood} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 6]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 1.66, s * 0.27]} rotation-x={s * 0.75} material={roof} castShadow>
          <boxGeometry args={[1.35, 0.06, 0.72]} />
        </mesh>
      ))}
      <group ref={bucket} position={[0, 1.05, 0]}>
        <mesh position-y={0.17} material={toon('#d9d2c3')}>
          <cylinderGeometry args={[0.006, 0.006, 0.34, 3]} />
        </mesh>
        <mesh material={wood} castShadow>
          <cylinderGeometry args={[0.1, 0.08, 0.16, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** Paints the goal onto a canvas so the sign has crisp text with no extra DOM. */
function useSignTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#a5713f';
    g.fillRect(0, 0, 512, 256);
    // Wood grain.
    const rnd = seeded(5);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(90,52,25,${0.12 + rnd() * 0.18})`;
      g.lineWidth = 2 + rnd() * 3;
      const y = rnd() * 256;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + (rnd() - 0.5) * 20, 340, y + (rnd() - 0.5) * 20, 512, y);
      g.stroke();
    }
    g.strokeStyle = '#6d4223';
    g.lineWidth = 14;
    g.strokeRect(7, 7, 498, 242);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.font = '700 46px Fredoka, system-ui, sans-serif';
    g.fillText('Measure exactly', 258, 78);
    g.font = '700 128px Fredoka, system-ui, sans-serif';
    g.fillText('4 L', 258, 212);
    g.fillStyle = '#fff4d6';
    g.font = '700 46px Fredoka, system-ui, sans-serif';
    g.fillText('Measure exactly', 256, 74);
    g.fillStyle = '#ffd166';
    g.font = '700 128px Fredoka, system-ui, sans-serif';
    g.fillText('4 L', 256, 206);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
}

/** Wooden signpost with the goal painted on it. */
export function GoalSign({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const tex = useSignTexture();
  const dark = toon('#6d4223');
  const board = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), [tex]);
  return (
    <group position={position} rotation-y={rotation}>
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} position={[x, 0.42, -0.01]} material={dark} castShadow>
          <boxGeometry args={[0.07, 0.84, 0.07]} />
        </mesh>
      ))}
      <mesh position-y={0.86} castShadow>
        <boxGeometry args={[1.0, 0.5, 0.05]} />
        <meshStandardMaterial attach="material-0" color="#8a5a33" />
        <meshStandardMaterial attach="material-1" color="#8a5a33" />
        <meshStandardMaterial attach="material-2" color="#8a5a33" />
        <meshStandardMaterial attach="material-3" color="#8a5a33" />
        <primitive object={board} attach="material-4" />
        <meshStandardMaterial attach="material-5" color="#8a5a33" />
      </mesh>
    </group>
  );
}

/** A few butterflies drifting over the meadow (idle life). */
export function Butterflies() {
  const low = useSettings((s) => s.quality) === 'low';
  const group = useRef<THREE.Group>(null);
  const flies = useMemo(() => {
    const rnd = seeded(13);
    return Array.from({ length: low ? 3 : 6 }, () => ({
      cx: 3.5 + rnd() * 4.5,
      cz: -2.5 + rnd() * 3.5,
      r: 0.5 + rnd() * 0.9,
      sp: 0.3 + rnd() * 0.4,
      ph: rnd() * 6,
      color: ['#ffd166', '#f78c6b', '#c084fc', '#ffffff', '#7dd3fc'][Math.floor(rnd() * 5)],
    }));
  }, [low]);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((b, i) => {
      const f = flies[i];
      const a = t * f.sp + f.ph;
      const x = f.cx + Math.cos(a) * f.r;
      const z = f.cz + Math.sin(a * 1.3) * f.r * 0.6;
      b.position.set(x, groundHeight(x, z) + 0.9 + Math.sin(t * 2 + f.ph) * 0.25, z);
      b.rotation.y = -a + Math.PI / 2;
      const flap = Math.sin(t * 22 + f.ph) * 1.1;
      b.children[0].rotation.z = flap;
      b.children[1].rotation.z = -flap;
    });
  });
  return (
    <group ref={group}>
      {flies.map((f, i) => {
        const m = toon(f.color, { emissive: f.color, emissiveIntensity: 0.4, flat: false });
        return (
          <group key={i}>
            {[1, -1].map((s) => (
              <group key={s}>
                <mesh position={[s * 0.06, 0, 0]} rotation-x={-Math.PI / 2} material={m}>
                  <circleGeometry args={[0.065, 5]} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** An invisible tap target over the pier end and the water: "empty it into the river". */
export function RiverTarget({ onClick, disabled }: { onClick(): void; disabled: boolean }) {
  return (
    <Clickable onClick={onClick} disabled={disabled} hoverScale={1}>
      <mesh position={[2.0, 0.35, -1.15]} visible={false}>
        <boxGeometry args={[2.2, 0.8, 1.8]} />
      </mesh>
    </Clickable>
  );
}
