import { useFrame, useThree } from '@react-three/fiber';
import type { SceneProps } from '@riddle/engine';
import { Burst, Clickable, ComicWord, DizzyStars, FocusCam, Shake, easeInOut, seeded, sfx, useSettings } from '@riddle/fx';
import { Bubble, HintRing, toon } from '@riddle/props';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { coinFaceTexture, vaultSfx } from './art';
import { Balance, PIVOT_Y, SCALE_POS, panCentre, type Beam } from './Balance';
import { COINS, MAX_WEIGHINGS, coinName, revealFake, type Know, type Move, type State, type Tilt, type Weighing } from './rules';
import { DOOR_POS, TABLE_Y, TABLE_Z, Vault } from './Vault';

export const MOVE_MS = 3000;
/** Weighing timeline (ms after Weigh is pressed). */
const T_RELEASE = 200;
const T_RESULT = 1500;
const T_RETURN = 2300;
/** Accusation timeline. */
const T_DOOR = 900;
const T_PARTY = 1400;
const T_DROP = 950;
const T_FAKE = 1250;
const T_CUCKOO = 1700;
const T_WAH = 2300;

const COIN_R = 0.24;
const COIN_H = 0.07;
const TRAY_RX = 0.55;
const SHOWCASE = new THREE.Vector3(0, 2.45, 0.55);
const SHOW_SCALE = 2.3;

const TILT_ANGLE: Record<Tilt, number> = { left: 0.24, right: -0.24, even: 0 };
const TILT_TEXT: Record<Tilt, string> = { left: 'Left side is heavier!', right: 'Right side is heavier!', even: 'Perfect balance!' };

function traySlot(i: number, out = new THREE.Vector3()) {
  const col = i % 6;
  const row = Math.floor(i / 6);
  return out.set((col - 2.5) * 0.8, TABLE_Y + 0.13, TABLE_Z - 0.35 + row * 0.72);
}

function panSlot(side: 'L' | 'R', index: number, count: number, angle: number, out = new THREE.Vector3()) {
  panCentre(side, angle, out);
  if (count <= 1) return out;
  const r = count <= 3 ? 0.3 : count <= 5 ? 0.42 : 0.48;
  const a = (index / count) * Math.PI * 2 + Math.PI / 2;
  return out.set(out.x + Math.cos(a) * r, out.y, out.z + Math.sin(a) * r);
}

type Anim =
  | { kind: 'weigh'; start: number; w: Weighing }
  | { kind: 'win'; start: number; coin: number }
  | { kind: 'lose'; start: number; coin: number; fake: number; heavy: boolean };

export function Scene({ state, previous, lastMove, status, play, busy, hint, resetCount, moveCount }: SceneProps<State, Move>) {
  const high = useSettings((s) => s.quality) === 'high';
  const [left, setLeft] = useState<number[]>([]);
  const [right, setRight] = useState<number[]>([]);
  const [accusing, setAccusing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [clues, setClues] = useState(true);
  const [revealed, setRevealed] = useState(moveCount);
  const [bubble, setBubble] = useState<{ text: string; pos: [number, number, number]; tone: 'gold' | 'red' | 'white' } | null>(null);
  /** How far the wrong-answer gag has got (drives the shared cartoon pieces). */
  const [gag, setGag] = useState(0);
  const [shake, setShake] = useState(0);
  const [burst, setBurst] = useState(0);
  const [rain, setRain] = useState(0);

  const anim = useRef<Anim | null>(null);
  const beam = useRef<Beam>({ angle: 0, vel: 0, target: 0, locked: true });
  const doorOpen = useRef(0);
  const blast = useRef(0);
  const lastCount = useRef(moveCount);
  const ui = useRef({ left, right, picked, accusing });
  ui.current = { left, right, picked, accusing };

  const over = status.kind !== 'playing';
  const pending = moveCount > revealed && lastMove?.kind === 'weigh';
  // Until the beam has settled, show what we knew before this weighing.
  const shown = pending && previous ? previous : state;
  const used = shown.log.length;

  // ---- React to moves, undo and restart ----
  useEffect(() => {
    const forward = moveCount > lastCount.current;
    lastCount.current = moveCount;
    setLeft([]);
    setRight([]);
    setAccusing(false);
    setPicked(null);
    setBubble(null);
    setGag(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    const now = performance.now();

    if (forward && lastMove?.kind === 'weigh') {
      const w = state.log[state.log.length - 1];
      anim.current = { kind: 'weigh', start: now, w };
      at(T_RELEASE, () => {
        vaultSfx.clank();
        beam.current.locked = false;
        beam.current.target = TILT_ANGLE[w.tilt];
        if (w.tilt !== 'even') vaultSfx.creak();
        else beam.current.vel = 0.25;
      });
      at(T_RESULT, () => {
        setRevealed(moveCount);
        setBubble({ text: TILT_TEXT[w.tilt], pos: [SCALE_POS[0], PIVOT_Y + 1.05, SCALE_POS[2]], tone: w.tilt === 'even' ? 'white' : 'gold' });
        if (w.tilt === 'even') vaultSfx.chime();
        else vaultSfx.thud();
      });
      at(T_RETURN, () => {
        beam.current.locked = true;
        beam.current.target = 0;
        vaultSfx.clank();
      });
      at(MOVE_MS - 100, () => setBubble(null));
    } else if (forward && lastMove?.kind === 'accuse') {
      setRevealed(moveCount);
      if (status.kind === 'won') {
        anim.current = { kind: 'win', start: now, coin: lastMove.coin };
        sfx.select();
        at(T_DOOR - 300, () => setBubble({ text: `Coin ${coinName(lastMove.coin)}: ${lastMove.heavy ? 'heavier' : 'lighter'}!`, pos: [SHOWCASE.x, SHOWCASE.y + 1.2, SHOWCASE.z], tone: 'gold' }));
        at(T_DOOR, vaultSfx.door);
        at(T_PARTY, () => {
          setBurst((b) => b + 1);
          setRain((r) => r + 1);
        });
      } else {
        const fake = revealFake(state)!;
        anim.current = { kind: 'lose', start: now, coin: lastMove.coin, fake: fake.coin, heavy: fake.heavy };
        sfx.select();
        sfx.squeak();
        at(T_DROP, () => {
          vaultSfx.thud();
          setGag(1);
          setShake((n) => n + 1);
        });
        at(T_FAKE, () => {
          sfx.poof();
          vaultSfx.steam();
          vaultSfx.giggle();
          setGag(2);
          setBubble({ text: `Hehe! I was ${fake.heavy ? 'heavier' : 'lighter'}!`, pos: [SHOWCASE.x, SHOWCASE.y + 1.2, SHOWCASE.z], tone: 'red' });
        });
        at(T_CUCKOO, () => {
          sfx.boing();
          vaultSfx.cuckoo(0.15);
          vaultSfx.cuckoo(0.75);
          setGag(3);
        });
        at(T_WAH, sfx.sadTrombone);
      }
    } else {
      // Undo or restart: everything goes back quickly.
      anim.current = null;
      beam.current.locked = true;
      beam.current.target = 0;
      setRevealed(moveCount);
      setRain(0);
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount, resetCount]);

  // ---- Coin input ----
  const canAct = !busy && !over && !pending;
  const onCoin = (i: number) => {
    if (!canAct) return;
    if (accusing) {
      sfx.select();
      setPicked(i);
      return;
    }
    if (used >= MAX_WEIGHINGS) {
      sfx.denied();
      return;
    }
    if (left.includes(i)) {
      setLeft(left.filter((c) => c !== i));
      if (right.length < 6) setRight([...right, i]);
      sfx.hop();
    } else if (right.includes(i)) {
      setRight(right.filter((c) => c !== i));
      sfx.deselect();
    } else if (left.length < 6) {
      setLeft([...left, i]);
      sfx.hop();
    } else if (right.length < 6) {
      setRight([...right, i]);
      sfx.hop();
    } else sfx.denied();
  };
  const canWeigh = canAct && used < MAX_WEIGHINGS && left.length > 0 && left.length === right.length;
  const weigh = () => {
    if (!canWeigh) return sfx.denied();
    play({ kind: 'weigh', left, right });
  };
  const accuse = (heavy: boolean) => {
    if (!canAct || picked == null) return;
    play({ kind: 'accuse', coin: picked, heavy });
  };

  // ---- Coin materials (one engraved face per coin) ----
  const faces = useMemo(
    () =>
      Array.from({ length: COINS }, (_, i) => {
        const map = coinFaceTexture(coinName(i));
        return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0, metalness: 0.75, roughness: 0.3 });
      }),
    [],
  );
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d29b32', metalness: 0.9, roughness: 0.35 }), []);
  const coinGeo = useMemo(() => new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 36), []);
  useEffect(() => () => faces.forEach((m) => (m.map?.dispose(), m.dispose())), [faces]);

  // ---- Per-frame choreography of the coins, door, steam and alarm ----
  const outer = useRef<(THREE.Group | null)[]>([]);
  const tilt = useRef<(THREE.Group | null)[]>([]);
  const hops = useMemo(
    () => Array.from({ length: COINS }, () => ({ key: '', from: new THREE.Vector3(), start: 0, dur: 1, h: 0, flip: 0, rx0: 0, landed: true })),
    [],
  );
  const alarm = useRef<THREE.PointLight>(null);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const knowRef = useRef<Know[]>(shown.know);
  knowRef.current = shown.know;
  const cluesRef = useRef(clues);
  cluesRef.current = clues;

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const now = performance.now();
    const a = anim.current;
    const el = a ? now - a.start : Infinity;
    const u = ui.current;
    const ang = beam.current.angle;

    // Door and steam.
    const doorTarget = a?.kind === 'win' ? THREE.MathUtils.clamp((el - T_DOOR) / 2300, 0, 1) : 0;
    doorOpen.current = a?.kind === 'win' ? doorTarget : Math.max(0, doorOpen.current - dt * 1.5);
    const blastTarget = a?.kind === 'lose' && el > T_FAKE && el < T_FAKE + 1800 ? 1 : 0;
    blast.current = THREE.MathUtils.lerp(blast.current, blastTarget, dt * 4);
    if (alarm.current) alarm.current.intensity = a?.kind === 'lose' && el > T_DROP ? (0.5 + 0.5 * Math.sin(clock.elapsedTime * 9)) * 14 : 0;

    for (let i = 0; i < COINS; i++) {
      const g = outer.current[i];
      const t = tilt.current[i];
      if (!g || !t) continue;
      // Where should this coin be?
      let key = 'tray';
      let rx = TRAY_RX;
      let spin = false;
      let dur = 420;
      traySlot(i, tgt);
      const wl = a?.kind === 'weigh' && el < T_RETURN + i * 45 ? a.w : null;
      if (wl && (wl.left.includes(i) || wl.right.includes(i))) {
        const side = wl.left.includes(i) ? 'L' : 'R';
        const list = side === 'L' ? wl.left : wl.right;
        panSlot(side, list.indexOf(i), list.length, ang, tgt);
        key = `${side}${list.indexOf(i)}`;
        rx = 0;
      } else if (a?.kind === 'win' && a.coin === i) {
        tgt.copy(SHOWCASE);
        tgt.y += Math.sin(clock.elapsedTime * 2) * 0.06;
        key = 'show';
        rx = Math.PI / 2;
        spin = true;
        dur = 800;
      } else if (a?.kind === 'lose' && a.coin === i && el < T_DROP) {
        tgt.set(SHOWCASE.x - 0.9, SHOWCASE.y - 0.2, SHOWCASE.z);
        key = 'accused';
        rx = Math.PI / 2;
        dur = 650;
      } else if (a?.kind === 'lose' && a.fake === i && el > T_FAKE) {
        tgt.copy(SHOWCASE);
        key = 'show';
        rx = Math.PI / 2;
        dur = 600;
      } else if (!a || a.kind === 'weigh') {
        if (u.accusing && u.picked === i) {
          tgt.y += 0.28;
          key = 'picked';
          rx = 1.0;
          dur = 260;
        } else if (u.left.includes(i) || u.right.includes(i)) {
          const side = u.left.includes(i) ? 'L' : 'R';
          const list = side === 'L' ? u.left : u.right;
          panSlot(side, list.indexOf(i), list.length, ang, tgt);
          key = `${side}${list.indexOf(i)}:${list.length}`;
          rx = 0;
        }
      }

      const hp = hops[i];
      if (hp.key === '') {
        g.position.copy(tgt);
        t.rotation.x = rx;
        hp.key = key;
      } else if (hp.key !== key) {
        const fromTray = hp.key === 'tray' || hp.key === 'picked';
        const toPan = key[0] === 'L' || key[0] === 'R';
        const samePan = toPan && hp.key[0] === key[0];
        hp.from.copy(g.position);
        hp.start = now;
        hp.dur = samePan ? 220 : dur;
        hp.h = samePan ? 0.08 : hp.from.distanceTo(tgt) > 1 ? 0.9 : 0.3;
        hp.flip = fromTray && toPan ? 1 : 0;
        hp.rx0 = t.rotation.x % (Math.PI * 2);
        hp.key = key;
        hp.landed = false;
      }
      const p = Math.min((now - hp.start) / hp.dur, 1);
      const e = easeInOut(p);
      g.position.lerpVectors(hp.from, tgt, e);
      g.position.y += Math.sin(Math.PI * p) * hp.h;
      t.rotation.x = THREE.MathUtils.lerp(hp.rx0, rx, e) + hp.flip * Math.PI * 2 * e;
      if (p >= 1 && !hp.landed) {
        hp.landed = true;
        if (key[0] === 'L' || key[0] === 'R' || key === 'tray') vaultSfx.clink();
      }
      // Party: everyone hops on the table.
      if (a?.kind === 'win' && el > T_PARTY && key === 'tray') g.position.y += Math.abs(Math.sin(clock.elapsedTime * 7 + i * 0.9)) * 0.22;
      const sc = THREE.MathUtils.lerp(g.scale.x, key === 'show' ? SHOW_SCALE : key === 'accused' ? 1.6 : 1, Math.min(1, dt * 5));
      g.scale.setScalar(sc);
      // Lose: the fake does a cheeky victory wiggle; the wrongly accused coin wobbles, dizzy.
      let roll = 0;
      if (a?.kind === 'lose' && key === 'show') {
        const ct = clock.elapsedTime;
        g.position.y += Math.abs(Math.sin(ct * 6)) * 0.22;
        g.position.x += Math.sin(ct * 3) * 0.25;
        roll = Math.sin(ct * 6) * 0.28;
      } else if (a?.kind === 'lose' && i === a.coin && el > T_DROP) roll = Math.sin(clock.elapsedTime * 4) * 0.18;
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, roll, Math.min(1, dt * 10));
      if (spin) g.rotation.y += dt * 2.6;
      else g.rotation.y = THREE.MathUtils.lerp(Math.atan2(Math.sin(g.rotation.y), Math.cos(g.rotation.y)), 0, Math.min(1, dt * 8));

      // Glow and dimming.
      const m = faces[i];
      const glowing = key === 'show' && a ? (a.kind === 'win' ? 1.1 : 0.9) : key === 'picked' ? 0.35 : 0;
      m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, glowing, dt * 4);
      m.emissive.set(a?.kind === 'lose' && key === 'show' ? '#7dff6b' : '#ffcf6b');
      const dim = cluesRef.current && knowRef.current[i] === 'G' && key === 'tray' && a?.kind !== 'win' ? 0.38 : 1;
      const c = THREE.MathUtils.lerp(m.color.r, dim, dt * 5);
      m.color.setRGB(c, c, c);
    }
  });

  // ---- Hint rings ----
  const hintRings: { coin: number; color: string }[] = [];
  if (hint && !busy && !pending) {
    if (hint.kind === 'weigh') {
      hint.left.forEach((c) => hintRings.push({ coin: c, color: '#ffd166' }));
      hint.right.forEach((c) => hintRings.push({ coin: c, color: '#7dd3fc' }));
    } else hintRings.push({ coin: hint.coin, color: '#ff7b9c' });
  }

  const loseInfo = status.kind === 'lost' && lastMove?.kind === 'accuse' ? { coin: lastMove.coin, fake: revealFake(state)?.coin ?? -1 } : null;
  const showMarkers = clues && !over && !(anim.current && anim.current.kind !== 'weigh');
  const onPan = (i: number) =>
    left.includes(i) || right.includes(i) || (busy && lastMove?.kind === 'weigh' && (lastMove.left.includes(i) || lastMove.right.includes(i)));

  return (
    <Shake trigger={shake}>
      <Vault high={high} doorOpen={doorOpen} blast={blast} />
      <Balance beam={beam} used={used} high={high} />
      <pointLight ref={alarm} position={[0, 4.5, -1]} color="#ff3b3b" intensity={0} distance={14} decay={1.4} />

      {Array.from({ length: COINS }, (_, i) => (
        <group key={i} ref={(g) => void (outer.current[i] = g)}>
          <group ref={(g) => void (tilt.current[i] = g)}>
            <Clickable onClick={() => onCoin(i)} disabled={!canAct} hoverScale={1.12}>
              <mesh geometry={coinGeo} material={[edge, faces[i], faces[i]]} rotation-y={Math.PI / 2} castShadow receiveShadow />
              <mesh visible={false}>
                <cylinderGeometry args={[0.4, 0.4, 0.34, 10]} />
              </mesh>
            </Clickable>
            {loseInfo && (i === loseInfo.fake || i === loseInfo.coin) && <CoinFace anim={anim} cheeky={i === loseInfo.fake} />}
          </group>
          {loseInfo && i === loseInfo.coin && gag >= 1 && <DizzyStars position={[0, 0.42, 0]} radius={0.34} />}
          {showMarkers && !onPan(i) && (shown.know[i] === 'H' || shown.know[i] === 'L') && <Marker heavy={shown.know[i] === 'H'} seed={i} />}
        </group>
      ))}

      {hintRings.map(({ coin, color }) => {
        const p = traySlot(coin);
        return <HintRing key={`${coin}${color}`} position={[p.x, TABLE_Y + 0.012, p.z]} radius={0.4} color={color} />;
      })}
      {accusing && picked != null && (
        <HintRing position={[traySlot(picked).x, TABLE_Y + 0.012, traySlot(picked).z]} radius={0.42} color="#ff7b9c" />
      )}

      <Cuckoo anim={anim} />
      {loseInfo && gag >= 1 && gag < 3 && <ComicWord position={[traySlot(loseInfo.coin).x, TABLE_Y + 0.9, traySlot(loseInfo.coin).z]} text="CLONK!" />}
      {gag >= 3 && <ComicWord position={[DOOR_POS[0] + 2.7, DOOR_POS[1] + 0.9, DOOR_POS[2] + 3.4]} text="CUCKOO!" color="#ff8fb1" tilt={8} />}
      <FocusCam target={[0.4, 1.9, -0.2]} active={gag >= 2} closer={0.85} />
      {bubble && (
        <Bubble key={bubble.text} position={bubble.pos} tone={bubble.tone}>
          {bubble.text}
        </Bubble>
      )}
      <Burst trigger={burst} position={[SHOWCASE.x, SHOWCASE.y, SHOWCASE.z]} count={high ? 260 : 120} />
      <CoinRain trigger={rain} count={high ? 80 : 30} />

      {!over && (
        <Overlay>
          <Ledger log={shown.log} />
          {canAct && (
            <Controls
              used={used}
              left={left.length}
              right={right.length}
              accusing={accusing}
              picked={picked}
              clues={clues}
              canWeigh={canWeigh}
              onWeigh={weigh}
              onClear={() => {
                sfx.deselect();
                setLeft([]);
                setRight([]);
              }}
              onAccuse={() => {
                sfx.click();
                setLeft([]);
                setRight([]);
                setPicked(null);
                setAccusing(true);
              }}
              onCancel={() => {
                sfx.deselect();
                setAccusing(false);
                setPicked(null);
              }}
              onVerdict={accuse}
              onClues={() => setClues((c) => !c)}
            />
          )}
        </Overlay>
      )}
    </Shake>
  );
}

// ---------------- Slapstick for a wrong answer ----------------

type AnimRef = React.MutableRefObject<Anim | null>;
const loseTime = (anim: AnimRef) => (anim.current?.kind === 'lose' ? performance.now() - anim.current.start : -1);
/** 0 → 1 with a springy overshoot. */
const popIn = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/**
 * A cartoon face on a coin's top side (coin-local: +y is the face, -z is "up" on the number).
 * The fake gets a cheeky grin and a tongue; the wrongly accused coin gets shocked eyes, then X eyes.
 */
function CoinFace({ anim, cheeky }: { anim: AnimRef; cheeky: boolean }) {
  const root = useRef<THREE.Group>(null);
  const pupils = useRef<THREE.Group>(null);
  const tongue = useRef<THREE.Mesh>(null);
  const shocked = useRef<THREE.Group>(null);
  const dizzy = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const el = loseTime(anim);
    const r = root.current;
    if (!r) return;
    const from = cheeky ? T_FAKE + 150 : 120;
    r.scale.setScalar(el < 0 ? 0 : Math.max(0, popIn((el - from) / 350)));
    const t = clock.elapsedTime;
    if (pupils.current) pupils.current.position.x = Math.sin(t * 2.5) * 0.018;
    if (tongue.current) tongue.current.rotation.y = Math.sin(t * 14) * 0.5;
    if (!cheeky) {
      const knocked = el > T_DROP;
      if (shocked.current) shocked.current.visible = !knocked;
      if (dizzy.current) {
        dizzy.current.visible = knocked;
        dizzy.current.rotation.y = t * 9;
      }
    }
  });
  const white = toon('#ffffff', { rough: 0.4, flat: false });
  const ink = toon('#1d1010', { rough: 0.3, flat: false });
  const pink = toon('#ff6f91', { rough: 0.5, flat: false });
  const h = COIN_H / 2 + 0.006;
  const eye = (x: number, r = 0.058) => (
    <mesh key={x} position={[x, h, -0.06]} scale={[1, 0.35, 1]} material={white}>
      <sphereGeometry args={[r, 14, 10]} />
    </mesh>
  );
  return (
    <group ref={root} scale={0}>
      {cheeky ? (
        <>
          {eye(-0.085)}
          {eye(0.085)}
          <group ref={pupils}>
            {[-0.085, 0.085].map((x) => (
              <mesh key={x} position={[x, h + 0.02, -0.075]} scale={[1, 0.4, 1]} material={ink}>
                <sphereGeometry args={[0.028, 10, 8]} />
              </mesh>
            ))}
          </group>
          {/* sly eyebrows */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.085, h + 0.01, -0.135]} rotation-y={s * 0.45} material={ink}>
              <boxGeometry args={[0.09, 0.012, 0.018]} />
            </mesh>
          ))}
          {/* big grin */}
          <mesh position={[0, h, 0.045]} rotation-x={Math.PI / 2} material={ink}>
            <torusGeometry args={[0.085, 0.017, 6, 20, Math.PI]} />
          </mesh>
          <mesh ref={tongue} position={[0.035, h + 0.006, 0.135]} material={pink}>
            <boxGeometry args={[0.055, 0.012, 0.075]} />
          </mesh>
        </>
      ) : (
        <>
          <group ref={shocked}>
            {eye(-0.085, 0.066)}
            {eye(0.085, 0.066)}
            {[-0.085, 0.085].map((x) => (
              <mesh key={x} position={[x, h + 0.022, -0.06]} scale={[1, 0.4, 1]} material={ink}>
                <sphereGeometry args={[0.018, 10, 8]} />
              </mesh>
            ))}
            {/* little "o" mouth */}
            <mesh position={[0, h, 0.09]} rotation-x={Math.PI / 2} material={ink}>
              <torusGeometry args={[0.032, 0.012, 6, 16]} />
            </mesh>
          </group>
          <group ref={dizzy} visible={false}>
            {[-0.085, 0.085].map((x) =>
              [1, -1].map((s) => (
                <mesh key={`${x}${s}`} position={[x, h, -0.06]} rotation-y={s * Math.PI / 4} material={ink}>
                  <boxGeometry args={[0.1, 0.012, 0.02]} />
                </mesh>
              )),
            )}
            {/* wobbly mouth */}
            <mesh position={[0, h, 0.11]} rotation-x={-Math.PI / 2} material={ink}>
              <torusGeometry args={[0.05, 0.012, 6, 16, Math.PI]} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}

/** A clockwork cuckoo bird that springs out of the vault door to announce a wrong answer. */
function Cuckoo({ anim }: { anim: AnimRef }) {
  const root = useRef<THREE.Group>(null);
  const bird = useRef<THREE.Group>(null);
  const beak = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Group[]>([]);
  const coils = useRef<THREE.Group>(null);
  const COILS = 7;
  /** Where the bird ends up, relative to the door hub: out, to the side, clear of the balance. */
  const END = new THREE.Vector3(1.5, 0.35, 3.4);
  useFrame(({ clock }) => {
    const r = root.current;
    if (!r) return;
    const el = loseTime(anim);
    const ext = el > T_CUCKOO ? popIn((el - T_CUCKOO) / 450) : 0;
    r.visible = ext > 0.001;
    const t = clock.elapsedTime;
    const wobble = el > T_CUCKOO + 450 ? Math.sin(t * 7) * 0.06 : 0;
    if (bird.current) {
      bird.current.position.set(END.x * ext, END.y * ext, 0.2 + (END.z - 0.2) * ext + wobble);
      bird.current.rotation.z = Math.sin(t * 5) * 0.15;
      bird.current.rotation.x = -0.15 + Math.sin(t * 9) * 0.06;
    }
    // Beak opens on each "cuck-oo".
    const since = el - T_CUCKOO - 150;
    const call = since > 0 && since % 600 < 420 ? Math.abs(Math.sin((since % 600) / 420 * Math.PI * 2)) : 0;
    if (beak.current) beak.current.rotation.x = call * 0.6;
    wings.current.forEach((w, k) => w && (w.rotation.z = (k ? -1 : 1) * (0.3 + Math.abs(Math.sin(t * 16)) * 0.7)));
    if (coils.current)
      coils.current.children.forEach((c, k) => {
        const f = ((k + 0.5) / COILS) * ext;
        c.position.set(END.x * f, END.y * f - 0.25 * (k / COILS) * ext, 0.2 + (END.z - 0.2) * f + wobble * (k / COILS));
        c.lookAt(END.x, END.y, END.z + 5);
      });
  });
  const red = toon('#e94b3c', { rough: 0.6 });
  const cream = toon('#ffe9c2', { rough: 0.7 });
  const yellow = toon('#ffc23a', { rough: 0.5 });
  const brassMat = toon('#d9a441', { metal: 0.85, rough: 0.32, flat: false });
  const ink = toon('#1d1010', { flat: false });
  const white = toon('#ffffff', { flat: false });
  return (
    <group ref={root} position={DOOR_POS} visible={false}>
      <group ref={coils}>
        {Array.from({ length: COILS }, (_, k) => (
          <mesh key={k} material={brassMat} castShadow>
            <torusGeometry args={[0.11, 0.025, 6, 14]} />
          </mesh>
        ))}
      </group>
      <group ref={bird} scale={1.7}>
        {/* body */}
        <mesh position-y={0.05} scale={[1, 0.95, 1.15]} material={red} castShadow>
          <icosahedronGeometry args={[0.26, 1]} />
        </mesh>
        <mesh position={[0, 0.0, 0.17]} scale={[0.8, 0.8, 0.5]} material={cream}>
          <icosahedronGeometry args={[0.2, 1]} />
        </mesh>
        {/* head */}
        <group position={[0, 0.36, 0.08]}>
          <mesh material={red} castShadow>
            <icosahedronGeometry args={[0.19, 1]} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.08, 0.04, 0.15]}>
              <mesh material={white}>
                <sphereGeometry args={[0.055, 12, 10]} />
              </mesh>
              <mesh position-z={0.04} material={ink}>
                <sphereGeometry args={[0.026, 10, 8]} />
              </mesh>
            </group>
          ))}
          {/* crest */}
          {[-0.05, 0, 0.05].map((x, k) => (
            <mesh key={x} position={[x, 0.2, -0.02 - k * 0.02]} rotation-z={-x * 4} material={yellow}>
              <coneGeometry args={[0.03, 0.14, 5]} />
            </mesh>
          ))}
          {/* beak: top fixed, bottom opens */}
          <mesh position={[0, -0.01, 0.2]} rotation-x={Math.PI / 2} material={yellow}>
            <coneGeometry args={[0.06, 0.16, 6]} />
          </mesh>
          <group ref={beak} position={[0, -0.05, 0.14]}>
            <mesh position={[0, 0, 0.06]} rotation-x={Math.PI / 2} scale={[1, 1, 0.5]} material={toon('#e89a1c')}>
              <coneGeometry args={[0.05, 0.13, 6]} />
            </mesh>
          </group>
        </group>
        {/* wings */}
        {[-1, 1].map((s, k) => (
          <group key={s} position={[s * 0.22, 0.1, 0]} ref={(g) => void (g && (wings.current[k] = g))}>
            <mesh position={[s * 0.12, 0, 0]} scale={[1, 0.35, 0.8]} material={red} castShadow>
              <icosahedronGeometry args={[0.15, 0]} />
            </mesh>
          </group>
        ))}
        {/* tail */}
        <mesh position={[0, 0.12, -0.3]} rotation-x={-0.9} material={yellow}>
          <coneGeometry args={[0.1, 0.25, 5]} />
        </mesh>
      </group>
    </group>
  );
}

/** A small glowing arrow over a coin: up = "if fake, it is heavy", down = "if fake, it is light". */
function Marker({ heavy, seed }: { heavy: boolean; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.42 + Math.sin(clock.elapsedTime * 3 + seed) * 0.05;
      ref.current.rotation.y = clock.elapsedTime * 1.5;
    }
  });
  const mat = heavy ? toon('#ff8a5c', { emissive: '#ff5a2a', emissiveIntensity: 2.6 }) : toon('#7cc8ff', { emissive: '#3aa0ff', emissiveIntensity: 2.6 });
  return (
    <group ref={ref}>
      <mesh rotation-x={heavy ? 0 : Math.PI} material={mat}>
        <coneGeometry args={[0.09, 0.18, 4]} />
      </mesh>
      <mesh position-y={heavy ? -0.13 : 0.13} material={mat}>
        <boxGeometry args={[0.05, 0.1, 0.05]} />
      </mesh>
    </group>
  );
}

/** Gold coins pouring out of the vault on a win. */
function CoinRain({ trigger, count }: { trigger: number; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () => Array.from({ length: count }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), on: false })),
    [count],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const rnd = seeded(trigger * 31 + 7);
    parts.forEach((pt) => {
      pt.on = trigger > 0;
      // Burst out of the vault door towards the player, in a fan.
      pt.p.set((rnd() - 0.5) * 2.4, 2.3 + rnd() * 1.2, -6 + rnd() * 0.4);
      pt.v.set((rnd() - 0.5) * 6, 3 + rnd() * 4, 4 + rnd() * 4.5);
      pt.r.set(rnd() * 6, rnd() * 6, rnd() * 6);
      pt.w.set((rnd() - 0.5) * 16, (rnd() - 0.5) * 8, (rnd() - 0.5) * 16);
    });
  }, [trigger, parts]);
  useFrame((_, rawDt) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(rawDt, 1 / 30);
    parts.forEach((pt, i) => {
      if (pt.on) {
        pt.v.y -= 9.8 * dt;
        pt.p.addScaledVector(pt.v, dt);
        if (pt.p.y < 0.03) {
          pt.p.y = 0.03;
          pt.v.y = Math.abs(pt.v.y) * 0.35;
          pt.v.x *= 0.6;
          pt.v.z *= 0.6;
          pt.w.multiplyScalar(0.5);
          if (Math.abs(pt.v.y) < 0.4) {
            pt.v.set(0, 0, 0);
            pt.r.x = THREE.MathUtils.lerp(pt.r.x, 0, 0.2);
            pt.r.z = THREE.MathUtils.lerp(pt.r.z, 0, 0.2);
            pt.w.set(0, 0, 0);
          }
        }
        if (pt.p.z > 4) pt.v.z = -Math.abs(pt.v.z) * 0.3;
        pt.r.x += pt.w.x * dt;
        pt.r.y += pt.w.y * dt;
        pt.r.z += pt.w.z * dt;
      }
      o.position.copy(pt.p);
      o.rotation.copy(pt.r);
      o.scale.setScalar(pt.on ? 1 : 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} castShadow material={toon('#f2bf45', { metal: 0.9, rough: 0.3, flat: false })}>
      <cylinderGeometry args={[0.16, 0.16, 0.04, 14]} />
    </instancedMesh>
  );
}

// ---------------- HTML overlay ----------------

/**
 * Pins its children to the screen (not to a point in 3D), in a DOM layer over the canvas.
 * Our own root rather than drei's <Html>: when the shell's Suspense hides and re-shows the scene,
 * <Html> recreates its root while the old one is still unmounting, which empties it.
 */
function Overlay({ children }: { children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const holder = useRef<{ el: HTMLDivElement; root: Root; kill?: ReturnType<typeof setTimeout> } | null>(null);
  useLayoutEffect(() => {
    let h = holder.current;
    if (h?.kill) clearTimeout(h.kill);
    if (!h) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden';
      h = holder.current = { el, root: createRoot(el) };
    }
    const parent = gl.domElement.parentElement;
    if (parent && h.el.parentElement !== parent) parent.appendChild(h.el);
    const mine = h;
    return () => {
      mine.kill = setTimeout(() => {
        mine.root.unmount();
        mine.el.remove();
        if (holder.current === mine) holder.current = null;
      }, 0);
    };
  }, [gl]);
  useLayoutEffect(() => {
    holder.current?.root.render(
      <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily: 'Fredoka, system-ui, sans-serif', color: '#fff7e0' }}>{children}</div>,
    );
  });
  return null;
}

const panel: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(58,38,46,.86), rgba(30,20,28,.86))',
  border: '1px solid rgba(255,206,120,.5)',
  boxShadow: '0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,230,170,.25)',
  borderRadius: 20,
  backdropFilter: 'blur(10px)',
  pointerEvents: 'auto',
};

function Chip({ n, tone }: { n: number; tone: 'L' | 'R' }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 20,
        height: 20,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color: '#4a2a05',
        background: tone === 'L' ? 'radial-gradient(circle at 35% 30%, #fff1b8, #e9b343)' : 'radial-gradient(circle at 35% 30%, #fff1b8, #d9a03a)',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.25)',
      }}
    >
      {coinName(n)}
    </span>
  );
}

function Ledger({ log }: { log: Weighing[] }) {
  return (
    <div style={{ ...panel, position: 'absolute', left: 12, top: 84, padding: '10px 12px', width: 'min(250px, calc(100vw - 24px))', pointerEvents: 'none' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#ffd27a' }}>Weighing ledger</div>
      {Array.from({ length: MAX_WEIGHINGS }, (_, i) => {
        const w = log[i];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, opacity: w ? 1 : 0.45, fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, flexShrink: 0, background: w ? '#4a3a34' : '#ffb84a', boxShadow: w ? 'none' : '0 0 8px #ffae2b' }} />
            {w ? (
              <>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 2, maxWidth: 92 }}>
                  {[...w.left].sort((a, b) => a - b).map((c) => (
                    <Chip key={c} n={c} tone="L" />
                  ))}
                </span>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#ffd27a', minWidth: 14, textAlign: 'center' }}>{w.tilt === 'left' ? '>' : w.tilt === 'right' ? '<' : '='}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 2, maxWidth: 92 }}>
                  {[...w.right].sort((a, b) => a - b).map((c) => (
                    <Chip key={c} n={c} tone="R" />
                  ))}
                </span>
              </>
            ) : (
              <span>Weighing {i + 1}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const btn = (tone: 'gold' | 'plain' | 'red' | 'blue', disabled = false): CSSProperties => ({
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 14,
  padding: '7px 13px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,.55)',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  whiteSpace: 'nowrap',
  color: tone === 'plain' ? '#fff7e0' : tone === 'gold' ? '#3b2405' : '#fff',
  background:
    tone === 'gold'
      ? 'linear-gradient(#ffe39a,#f0a93a)'
      : tone === 'red'
        ? 'linear-gradient(#ff8a5c,#e2482b)'
        : tone === 'blue'
          ? 'linear-gradient(#8fd3ff,#2f8be0)'
          : 'rgba(255,255,255,.12)',
  boxShadow: '0 3px 0 rgba(0,0,0,.3), 0 8px 16px rgba(0,0,0,.25)',
});

interface ControlsProps {
  used: number;
  left: number;
  right: number;
  accusing: boolean;
  picked: number | null;
  clues: boolean;
  canWeigh: boolean;
  onWeigh(): void;
  onClear(): void;
  onAccuse(): void;
  onCancel(): void;
  onVerdict(heavy: boolean): void;
  onClues(): void;
}

/** Centred above the shell's bar on phones; a column on the right on wider screens, clear of the coins. */
const CONTROLS_CSS = `
.tc-controls{position:absolute;left:0;right:0;bottom:92px;display:flex;justify-content:center;padding:0 12px}
.tc-buttons{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
@media (min-width:760px){
  .tc-controls{left:auto;right:12px;bottom:auto;top:84px;width:220px;padding:0}
  .tc-controls>div{width:100%}
  .tc-buttons{flex-direction:column;align-items:stretch}
}`;

function Controls(p: ControlsProps) {
  const left = MAX_WEIGHINGS - p.used;
  let message: string;
  let buttons: ReactNode;
  if (p.accusing) {
    message = p.picked == null ? 'Tap the coin you think is fake.' : `Coin ${coinName(p.picked)} is the fake, and it is…`;
    buttons = (
      <>
        {p.picked != null && (
          <>
            <button style={btn('red')} onClick={() => p.onVerdict(true)}>⬆ Heavier</button>
            <button style={btn('blue')} onClick={() => p.onVerdict(false)}>⬇ Lighter</button>
          </>
        )}
        <button style={btn('plain')} onClick={p.onCancel}>Back</button>
      </>
    );
  } else {
    message =
      left === 0
        ? 'The balance is spent. Name the fake!'
        : p.left + p.right === 0
          ? 'Tap coins to load the pans.'
          : p.left !== p.right
            ? `Left ${p.left} · Right ${p.right}: the pans need the same number.`
            : `Left ${p.left} · Right ${p.right}: ready to weigh.`;
    buttons = (
      <>
        {p.left + p.right > 0 && (
          <button style={btn('plain')} onClick={p.onClear}>Clear</button>
        )}
        {left > 0 && (
          <button style={btn('gold', !p.canWeigh)} onClick={p.onWeigh} disabled={!p.canWeigh}>
            ⚖ Weigh <span style={{ opacity: 0.7, fontSize: 12 }}>({left} left)</span>
          </button>
        )}
        <button style={btn(left === 0 ? 'gold' : 'plain')} onClick={p.onAccuse}>🔍 Name the fake</button>
        <button style={{ ...btn('plain'), fontSize: 12, padding: '6px 10px' }} onClick={p.onClues} title="Show what the weighings prove about each coin">
          Clues {p.clues ? 'on' : 'off'}
        </button>
      </>
    );
  }
  return (
    <div className="tc-controls">
      <style>{CONTROLS_CSS}</style>
      <div style={{ ...panel, padding: '8px 10px', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', fontSize: 13, marginBottom: 6, color: '#ffe6b0' }}>{message}</div>
        <div className="tc-buttons">{buttons}</div>
      </div>
    </div>
  );
}
