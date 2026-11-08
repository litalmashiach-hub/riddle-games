import { Clickable, useSettings } from '@riddle/fx';
import { toon } from '@riddle/props';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { glowTexture } from './glow';
import { LANTERN_COLORS, padPos, type Glows } from './layout';

/** Profile of a round paper lantern, turned on a lathe. */
const LANTERN_PROFILE = [
  [0.0, 0.0],
  [0.12, 0.0],
  [0.2, 0.06],
  [0.25, 0.16],
  [0.26, 0.26],
  [0.24, 0.36],
  [0.18, 0.44],
  [0.1, 0.48],
  [0.0, 0.48],
].map(([x, y]) => new THREE.Vector2(x, y));

const DARK_PAPER = new THREE.Color('#4a5070');

interface LanternProps {
  cell: number;
  lit: boolean;
  /** Wait this long before showing a change of `lit` (so it flips when the frog lands). */
  delayMs: number;
  /** Bumps when the frog lands on this pad: the pad dips and splashes. */
  stomp: number;
  stompDelayMs: number;
  glows: Glows;
  /** The fail scene: lanterns grow dim and droop. */
  sleepy: boolean;
  /** The win: lanterns bob in a happy wave. */
  party: boolean;
  disabled: boolean;
  onClick(): void;
}

/** One lily pad with its paper lantern. Tapping it is a move. */
export function Lantern({ cell, lit, delayMs, stomp, stompDelayMs, glows, sleepy, party, disabled, onClick }: LanternProps) {
  const high = useSettings((s) => s.quality) === 'high';
  const color = LANTERN_COLORS[cell];
  const lanternGeo = useMemo(() => new THREE.LatheGeometry(LANTERN_PROFILE, 10), []);
  const paper = useMemo(
    () => new THREE.MeshStandardMaterial({ color: DARK_PAPER.clone(), emissive: new THREE.Color(color), emissiveIntensity: 0, roughness: 0.6, flatShading: true }),
    [color],
  );
  const litPaper = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55), [color]);

  const pad = useRef<THREE.Group>(null);
  const lantern = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);

  // Animated state lives in refs so it can change smoothly between renders.
  const target = useRef(lit ? 1 : 0);
  const glow = useRef(lit ? 1 : 0);
  const pop = useRef(-1);
  const stompAt = useRef(-1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      target.current = lit ? 1 : 0;
      pop.current = performance.now();
    }, delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit]);

  useEffect(() => {
    if (!stomp) return;
    const t = setTimeout(() => (stompAt.current = performance.now()), stompDelayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stomp]);

  const phase = cell * 0.9;
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const now = performance.now();
    // Glow eases toward its target; turning on overshoots with a little flicker.
    const goal = sleepy ? target.current * 0.22 : target.current;
    const speed = sleepy ? 0.8 : goal > glow.current ? 7 : 5;
    glow.current += (goal - glow.current) * Math.min(1, dt * speed);
    const flicker = goal > 0.5 ? 1 + Math.sin(t * 13 + phase) * 0.04 + Math.sin(t * 29 + phase * 2) * 0.03 : 1;
    const g = Math.max(0, glow.current * flicker);
    glows[cell] = g;

    paper.color.copy(DARK_PAPER).lerp(litPaper, Math.min(1, glow.current));
    paper.emissiveIntensity = g * 2.6;
    if (flame.current) flame.current.scale.setScalar(0.06 + 0.07 * g);
    if (halo.current) {
      const s = 1.2 + g * 0.8;
      halo.current.scale.set(s, s, 1);
      (halo.current.material as THREE.SpriteMaterial).opacity = g * 0.75;
    }
    if (light.current) light.current.intensity = g * 2.2;

    // Pad bob, plus a dip when the frog lands.
    const p = pad.current;
    if (p) {
      const se = stompAt.current < 0 ? 9 : (now - stompAt.current) / 1000;
      const dip = se < 1.2 ? -Math.sin(se * 14) * Math.exp(-se * 4) * 0.09 : 0;
      p.position.y = Math.sin(t * 1.1 + phase) * 0.015 + dip;
      p.rotation.x = Math.sin(t * 0.8 + phase) * 0.02 + dip * 0.4;
      p.rotation.z = Math.cos(t * 0.9 + phase) * 0.02;
    }

    // Lantern: pop when it flips, sway, happy wave on a win, droop when sleepy.
    const l = lantern.current;
    if (l) {
      const pe = pop.current < 0 ? 9 : (now - pop.current) / 1000;
      const popS = pe < 0.6 ? 1 + Math.sin(pe * Math.PI * 2.5) * Math.exp(-pe * 5) * 0.35 : 1;
      const wave = party ? Math.max(0, Math.sin(t * 6 - cell * 0.7)) * 0.25 : 0;
      l.scale.set(popS, popS * (1 + wave * 0.3), popS);
      l.position.y = 0.06 + wave;
      const droop = sleepy ? 0.45 : 0;
      l.rotation.z += (droop + Math.sin(t * 1.4 + phase) * 0.04 - l.rotation.z) * Math.min(1, dt * 3);
    }
  });

  const [x, y, z] = padPos(cell);
  const tex = glowTexture();
  return (
    <group position={[x, y, z]}>
      <Clickable onClick={onClick} disabled={disabled} hoverScale={1.07}>
        <group ref={pad}>
          {/* lily pad with its little notch */}
          <mesh castShadow receiveShadow material={toon('#3fae5c')} rotation-y={cell * 1.3}>
            <cylinderGeometry args={[0.66, 0.62, 0.06, 18, 1, false, 0.25, Math.PI * 2 - 0.5]} />
          </mesh>
          <mesh position-y={0.032} material={toon('#5cc46f')} rotation-y={cell * 1.3}>
            <cylinderGeometry args={[0.5, 0.5, 0.01, 18, 1, false, 0.3, Math.PI * 2 - 0.6]} />
          </mesh>
          <group ref={lantern}>
            {/* wooden base */}
            <mesh position-y={0.04} castShadow material={toon('#5a3a2c')}>
              <cylinderGeometry args={[0.14, 0.17, 0.08, 8]} />
            </mesh>
            {/* paper body */}
            <mesh geometry={lanternGeo} material={paper} position-y={0.08} castShadow />
            {/* paper ribs */}
            {[0.18, 0.3, 0.42].map((h, i) => (
              <mesh key={i} position-y={0.08 + h} rotation-x={Math.PI / 2} material={toon('#5a3a2c')}>
                <torusGeometry args={[[0.235, 0.26, 0.2][i], 0.012, 4, 14]} />
              </mesh>
            ))}
            {/* top cap and handle */}
            <mesh position-y={0.58} material={toon('#5a3a2c')} castShadow>
              <cylinderGeometry args={[0.07, 0.11, 0.06, 8]} />
            </mesh>
            <mesh position-y={0.66} material={toon('#3b2620')}>
              <torusGeometry args={[0.07, 0.014, 4, 12, Math.PI]} />
            </mesh>
            {/* little flame inside */}
            <mesh ref={flame} position-y={0.3}>
              <sphereGeometry args={[1, 8, 6]} />
              <meshBasicMaterial color={new THREE.Color('#fff6d8').multiplyScalar(4)} toneMapped={false} />
            </mesh>
            <sprite ref={halo} position-y={0.32} renderOrder={3}>
              <spriteMaterial map={tex} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
            </sprite>
            {high && <pointLight ref={light} position-y={0.45} color={color} distance={3.2} decay={2} intensity={0} />}
          </group>
          {/* big invisible tap target */}
          <mesh position-y={0.35} visible={false}>
            <cylinderGeometry args={[0.8, 0.8, 0.9, 10]} />
          </mesh>
        </group>
      </Clickable>
    </group>
  );
}
