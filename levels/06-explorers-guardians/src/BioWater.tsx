import { useFrame } from '@react-three/fiber';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** What the scene can drive on the water each frame. */
export interface BioWaterHandle {
  /** Barge position (x, z) for the glowing wake rings. */
  boat: THREE.Vector2;
  /** 0..1, how fast the barge is moving: brighter wake. */
  wake: number;
  /** 0..1 victory glow (whole lake lights up). */
  joy: number;
  /** -1 left bank, 1 right bank, 0 none: the lake blushes red on that side. */
  dangerSide: number;
}

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    float h = sin(w.x * 1.1 + uTime * 0.9) * 0.025 + sin(w.z * 0.8 - uTime * 1.2) * 0.02;
    vec3 p = position;
    p.z += h; // plane is rotated, local z is world up
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec2 uBoat;
  uniform float uWake;
  uniform float uJoy;
  uniform float uDanger;
  uniform float uLow;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  // Distance to the nearest cell edge: bright thin veins like caustics.
  float cells(vec2 p, float t) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash2(i + g);
      o = 0.5 + 0.45 * sin(t + 6.2831 * o);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
    return d2 - d1;
  }
  float lakeHalf(float z) {
    return 2.9 + 1.4 * smoothstep(-3.0, -6.5, z) + sin(z * 0.8 + 1.3) * 0.25 * smoothstep(2.5, 5.0, abs(z));
  }

  void main() {
    vec2 p = vWorld.xz;
    float t = uTime;
    float edge = lakeHalf(p.y) - abs(p.x);           // > 0 inside the lake
    float depth = smoothstep(0.0, 2.2, edge);

    vec3 deep = vec3(0.002, 0.012, 0.022);
    vec3 mid = vec3(0.004, 0.045, 0.06);
    vec3 cyan = vec3(0.2, 1.0, 0.85);
    vec3 jade = vec3(0.35, 1.0, 0.5);
    vec3 col = mix(mid, deep, depth);

    // slow swirling currents
    vec2 flow = p * 0.35 + vec2(fbm(p * 0.25 + t * 0.05), fbm(p * 0.25 - t * 0.04)) * 1.6;
    float swirl = fbm(flow + vec2(0.0, t * 0.06));
    col += vec3(0.0, 0.05, 0.06) * swirl;

    // bioluminescent veins, only where glowing plankton drifts in clouds
    float patchy = smoothstep(0.48, 0.78, fbm(flow * 1.1 + vec2(t * 0.04, 0.0)));
    float c1 = cells(p * 2.2 + vec2(t * 0.05, -t * 0.03), t * 0.7);
    float c2 = uLow > 0.5 ? 1.0 : cells(p * 4.3 - vec2(t * 0.04, t * 0.06), t * 0.9 + 2.0);
    float veins = (1.0 - smoothstep(0.0, 0.05, c1)) * 0.8 + (1.0 - smoothstep(0.0, 0.04, c2)) * 0.4;
    vec3 glowCol = mix(cyan, jade, fbm(p * 0.3 + 3.0));
    col += glowCol * veins * patchy * 1.1 * (0.5 + 0.5 * depth);
    col += glowCol * patchy * 0.05;

    // twinkling plankton specks
    vec2 g = floor(p * 7.0);
    float r = hash(g);
    vec2 cell = fract(p * 7.0) - 0.5 - (hash2(g) - 0.5) * 0.6;
    float tw = pow(0.5 + 0.5 * sin(t * (1.5 + r * 3.0) + r * 40.0), 6.0);
    float speck = step(0.8, r) * (1.0 - smoothstep(0.02, 0.07, length(cell))) * tw;
    col += cyan * speck * 2.2;

    // glowing shoreline
    float shore = 1.0 - smoothstep(0.0, 0.35 + swirl * 0.3, edge);
    col += cyan * shore * (0.3 + 0.15 * sin(t * 2.0 + p.y * 2.0));

    // wake rings around the barge
    float bd = length((p - uBoat) * vec2(0.75, 1.3));
    float rings = sin(bd * 11.0 - t * 5.0) * 0.5 + 0.5;
    float wakeAmt = exp(-bd * 1.4) * (0.25 + uWake * 1.1);
    col += cyan * pow(rings, 4.0) * wakeAmt;
    col += jade * exp(-bd * 2.5) * 0.18;

    // warm sky reflection from the cave opening above
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(viewDir.y, 0.0), 4.0);
    col = mix(col, vec3(0.55, 0.25, 0.1), fres * 0.3);

    // victory: the whole lake lights up in rolling waves
    float wave = 0.5 + 0.5 * sin(length(p - vec2(4.5, 0.0)) * 2.0 - t * 4.0);
    col += mix(jade, vec3(1.0, 0.85, 0.4), 0.4) * uJoy * (0.05 + veins * 1.2 + pow(wave, 4.0) * 0.3);

    // danger: the side where the explorers are outnumbered blushes red
    float side = uDanger * p.x;
    float red = smoothstep(-0.5, 2.5, side) * abs(uDanger);
    col = mix(col, vec3(0.9, 0.12, 0.08) * (0.4 + veins * 1.8 + shore), red * 0.75);

    gl_FragColor = vec4(col, 0.96);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** Dark cave lake full of glowing plankton, with wake rings that follow the barge. */
export const BioWater = forwardRef<BioWaterHandle, { low?: boolean }>(function BioWater({ low = false }, ref) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const handle = useMemo<BioWaterHandle>(() => ({ boat: new THREE.Vector2(-1.6, 0), wake: 0, joy: 0, dangerSide: 0 }), []);
  useImperativeHandle(ref, () => handle, [handle]);
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uBoat: { value: new THREE.Vector2() },
          uWake: { value: 0 },
          uJoy: { value: 0 },
          uDanger: { value: 0 },
          uLow: { value: low ? 1 : 0 },
        },
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    const u = m.uniforms;
    u.uTime.value += dt;
    u.uBoat.value.copy(handle.boat);
    u.uWake.value += (handle.wake - u.uWake.value) * Math.min(1, dt * 4);
    u.uJoy.value += (handle.joy - u.uJoy.value) * Math.min(1, dt * 1.5);
    u.uDanger.value += (handle.dangerSide - u.uDanger.value) * Math.min(1, dt * 3);
    u.uLow.value = low ? 1 : 0;
  });
  return (
    <mesh position={[0, 0, -2]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[30, 40, low ? 30 : 60, low ? 40 : 80]} />
      <shaderMaterial ref={mat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent fog depthWrite={false} />
    </mesh>
  );
});
