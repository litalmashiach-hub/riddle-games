import { useFrame } from '@react-three/fiber';
import { toon } from '@riddle/props';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { quackSound } from './audio';
import { FLOW_START, streamPath, type Anim } from './layout';
import { Overlay, Pill } from './Overlay';

const HOME_X = 1.8;
const HOME_Z = -1.75;

/**
 * A little duck paddling by the pier. When a jug is emptied on top of it, it gets
 * soaked: it pops out of the water, spins, quacks, then shakes itself dry and sulks back.
 */
export function Duck({ anim }: { anim: RefObject<Anim> }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const splashedId = useRef(-1);
  const hitAt = useRef(-1e9);
  const [quack, setQuack] = useState(0);
  const pos = useRef(new THREE.Vector3(HOME_X, 0, HOME_Z));
  const yellow = toon('#ffd84a', { rough: 0.7 });
  const white = toon('#fff8e6');
  const orange = toon('#ff8a2a');
  const eye = toon('#141414', { flat: false, rough: 0.2 });
  const eyeWhite = toon('#ffffff', { flat: false, rough: 0.3 });

  useFrame(({ clock }) => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    const t = clock.elapsedTime;
    const now = performance.now();
    const a = anim.current;

    // Where the water lands on an "empty" move. The duck wanders into it, of course.
    let target = new THREE.Vector3(HOME_X + Math.cos(t * 0.35) * 0.35, 0, HOME_Z + Math.sin(t * 0.5) * 0.25);
    if (a.forward && a.move?.kind === 'empty') {
      const p = streamPath(a.move, a.prev, a.next).to;
      const el = now - a.start;
      if (el < FLOW_START + 1100) target = new THREE.Vector3(p[0] + 0.05, 0, p[2] + 0.08);
      if (el > FLOW_START + 180 && splashedId.current !== a.id) {
        splashedId.current = a.id;
        hitAt.current = now;
        quackSound();
        setQuack((q) => q + 1);
      }
    }
    const since = (now - hitAt.current) / 1000;
    const soaked = since < 2.6;
    // After the splash, flee a bit, then drift back.
    if (soaked && since > 1.1) target = new THREE.Vector3(HOME_X - 0.6, 0, HOME_Z - 0.5);

    const prev = pos.current.clone();
    pos.current.lerp(target, soaked ? 0.06 : 0.012);
    const v = pos.current.clone().sub(prev);
    g.position.set(pos.current.x, 0.02 + Math.sin(t * 2.2) * 0.015, pos.current.z);
    if (v.lengthSq() > 1e-7) {
      let d = Math.atan2(v.x, v.z) - g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.rotation.y += d * 0.1;
    }

    // The soaking: jump with a full spin, then a fast dry-off shake.
    b.position.y = 0;
    b.rotation.set(0, 0, 0);
    let flap = Math.sin(t * 3) * 0.1;
    if (since < 0.7) {
      const k = since / 0.7;
      b.position.y = Math.sin(Math.PI * k) * 0.55;
      b.rotation.y = k * Math.PI * 2;
      b.rotation.x = -Math.sin(Math.PI * k) * 0.4;
      flap = Math.sin(since * 60) * 1.1;
    } else if (since < 1.6) {
      const k = (since - 0.7) / 0.9;
      b.rotation.z = Math.sin(since * 55) * 0.35 * (1 - k);
      flap = Math.sin(since * 50) * 0.6 * (1 - k);
    }
    if (wingL.current) wingL.current.rotation.z = 0.2 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.2 - flap;
    if (head.current) head.current.rotation.x = soaked && since > 1.6 ? 0.35 : Math.sin(t * 1.7) * 0.12;
  });

  const showQuack = quack > 0;
  return (
    <group ref={root} position={[HOME_X, 0.02, HOME_Z]}>
      <group ref={body} scale={1.25}>
        <mesh position-y={0.1} scale={[1, 0.75, 1.35]} material={white} castShadow>
          <icosahedronGeometry args={[0.16, 1]} />
        </mesh>
        <mesh position={[0, 0.2, -0.2]} rotation-x={-0.9} material={white} castShadow>
          <coneGeometry args={[0.06, 0.14, 5]} />
        </mesh>
        <mesh ref={wingL} position={[0.14, 0.14, -0.02]} scale={[0.35, 0.7, 1.2]} material={toon('#f2e7cf')}>
          <icosahedronGeometry args={[0.1, 0]} />
        </mesh>
        <mesh ref={wingR} position={[-0.14, 0.14, -0.02]} scale={[0.35, 0.7, 1.2]} material={toon('#f2e7cf')}>
          <icosahedronGeometry args={[0.1, 0]} />
        </mesh>
        <group ref={head} position={[0, 0.3, 0.14]}>
          <mesh material={yellow} castShadow>
            <icosahedronGeometry args={[0.1, 1]} />
          </mesh>
          <mesh position={[0, -0.02, 0.11]} scale={[1.2, 0.45, 1]} material={orange}>
            <sphereGeometry args={[0.055, 8, 6]} />
          </mesh>
          {[1, -1].map((s) => (
            <group key={s} position={[s * 0.05, 0.03, 0.08]}>
              <mesh material={eyeWhite}>
                <sphereGeometry args={[0.026, 10, 10]} />
              </mesh>
              <mesh position-z={0.016} material={eye}>
                <sphereGeometry args={[0.014, 8, 8]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      {showQuack && <QuackBubble key={quack} follow={root} />}
    </group>
  );
}

function QuackBubble({ follow }: { follow: RefObject<THREE.Group | null> }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 1800);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <Overlay follow={follow} position={[0, 0.95, 0]}>
      <Pill>QUACK!! 💦</Pill>
    </Overlay>
  );
}
