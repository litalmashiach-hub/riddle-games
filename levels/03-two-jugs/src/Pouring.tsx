import { useFrame } from '@react-three/fiber';
import { useSettings } from '@riddle/fx';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { pourSound } from './audio';
import { FLOW_END, FLOW_START, clamp01, streamPath, type Anim } from './layout';

const streamVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const streamFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uHead;
  uniform float uTail;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  void main() {
    // uv.x runs along the stream. Wobble the cut-off so the front looks like falling water.
    float wob = sin(vUv.y * 6.283 * 3.0 + uTime * 20.0) * 0.012;
    if (vUv.x > uHead + wob || vUv.x < uTail + wob) discard;
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(viewDir, vNormalW)), 1.5);
    float streak = smoothstep(0.55, 1.0, sin(vUv.x * 60.0 - uTime * 28.0 + vUv.y * 12.0) * 0.5 + 0.5);
    vec3 col = mix(vec3(0.25, 0.72, 0.92), vec3(0.85, 0.97, 1.0), fres * 0.8 + streak * 0.35);
    col += vec3(1.0) * streak * fres * 0.6;
    gl_FragColor = vec4(col, 0.72 + fres * 0.28);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const DROPS_HIGH = 70;
const DROPS_LOW = 24;

/** The falling water of a move: a curved stream, splash droplets and (in the river) ripples. */
export function Pouring({ anim }: { anim: RefObject<Anim> }) {
  const low = useSettings((s) => s.quality) === 'low';
  const count = low ? DROPS_LOW : DROPS_HIGH;
  const stream = useRef<THREE.Mesh>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const ripples = useRef<THREE.Group>(null);
  const shownId = useRef(-1);
  const sounded = useRef(-1);
  const path = useRef<ReturnType<typeof streamPath> | null>(null);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: streamVertex,
        fragmentShader: streamFragment,
        transparent: true,
        depthWrite: false,
        fog: true,
        side: THREE.DoubleSide,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uHead: { value: 0 }, uTail: { value: 0 }, uTime: { value: 0 } }]),
      }),
    [],
  );
  const dropMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#bfefff', emissive: '#6fd3f2', emissiveIntensity: 0.5, roughness: 0.1, transparent: true, opacity: 0.9 }),
    [],
  );
  const parts = useMemo(() => Array.from({ length: count }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, s: 1 })), [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => stream.current?.geometry.dispose(), []);

  useFrame((_, dt) => {
    const a = anim.current;
    const el = performance.now() - a.start;
    mat.uniforms.uTime.value += dt;
    const active = a.forward && a.move;

    // Rebuild the stream curve once per move.
    if (active && shownId.current !== a.id && stream.current) {
      shownId.current = a.id;
      path.current = streamPath(a.move!, a.prev, a.next);
      const { from, ctrl, to } = path.current;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...from), new THREE.Vector3(...ctrl), new THREE.Vector3(...to));
      const thick = a.move!.kind === 'fill' ? 0.042 : 0.052;
      stream.current.geometry.dispose();
      stream.current.geometry = new THREE.TubeGeometry(curve, 48, thick, 10, false);
    }
    if (active && sounded.current !== a.id && el >= FLOW_START) {
      sounded.current = a.id;
      pourSound(FLOW_END - FLOW_START, a.move!.kind === 'empty' ? 'splash' : a.move!.kind === 'fill' ? 'fill' : 'pour');
    }

    const head = active ? clamp01((el - FLOW_START) / 220) : 0;
    const tail = active ? clamp01((el - (FLOW_END - 200)) / 260) : 0;
    mat.uniforms.uHead.value = head;
    mat.uniforms.uTail.value = tail;
    if (stream.current) stream.current.visible = head > 0 && tail < 1;

    // Splash droplets where the water lands.
    const p = path.current;
    const flowing = active && p && head >= 1 && tail < 0.8;
    const m = drops.current;
    if (!m) return;
    if (flowing) {
      const river = p.river;
      let spawn = Math.ceil((river ? 90 : 40) * dt * (low ? 0.5 : 1)) + 1;
      for (const pt of parts) {
        if (spawn <= 0) break;
        if (pt.life > 0) continue;
        pt.p.set(...p.to);
        const ang = Math.random() * Math.PI * 2;
        const sp = river ? 0.6 + Math.random() * 1.2 : 0.3 + Math.random() * 0.5;
        pt.v.set(Math.cos(ang) * sp, (river ? 1.6 : 0.9) + Math.random() * (river ? 1.8 : 0.8), Math.sin(ang) * sp);
        pt.life = 0.35 + Math.random() * 0.4;
        pt.s = 0.6 + Math.random() * 0.8;
        spawn--;
      }
    }
    parts.forEach((pt, i) => {
      if (pt.life > 0) {
        pt.life -= dt;
        pt.v.y -= 9.8 * dt;
        pt.p.addScaledVector(pt.v, dt);
      }
      dummy.position.copy(pt.p);
      dummy.scale.setScalar(pt.life > 0 ? pt.s * Math.min(1, pt.life * 4) : 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;

    // Expanding rings on the river while emptying.
    const rg = ripples.current;
    if (rg) {
      const on = active && p?.river && el > FLOW_START + 150 && el < FLOW_END + 900;
      rg.visible = !!on;
      if (on && p) {
        rg.position.set(p.to[0], 0.06, p.to[2]);
        rg.children.forEach((child, i) => {
          const k = (((el - FLOW_START) / 700 + i / rg.children.length) % 1 + 1) % 1;
          const fade = el > FLOW_END ? 1 - clamp01((el - FLOW_END) / 900) : 1;
          child.scale.setScalar(0.2 + k * 1.4);
          ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7 * fade;
        });
      }
    }
  });

  return (
    <group>
      <mesh ref={stream} material={mat} visible={false} renderOrder={3} frustumCulled={false}>
        <bufferGeometry />
      </mesh>
      <instancedMesh ref={drops} args={[undefined, dropMat, count]} frustumCulled={false}>
        <icosahedronGeometry args={[0.028, 0]} />
      </instancedMesh>
      <group ref={ripples} visible={false}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.36, 0.42, 40]} />
            <meshBasicMaterial color="#f4fbff" transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
