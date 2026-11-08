import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface WaterProps {
  width?: number;
  length?: number;
  position?: [number, number, number];
  shallow?: THREE.ColorRepresentation;
  deep?: THREE.ColorRepresentation;
  foam?: THREE.ColorRepresentation;
  /** Flow direction and speed along the length (z). */
  flow?: number;
  waveHeight?: number;
  segments?: number;
}

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  uniform float uWave;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vHeight;
  float wave(vec2 p) {
    return sin(p.x * 1.3 + uTime * 1.2) * 0.5
         + sin(p.y * 0.9 - uTime * 1.6) * 0.35
         + sin((p.x + p.y) * 2.1 + uTime * 2.3) * 0.15;
  }
  void main() {
    vUv = uv;
    vec3 p = position;
    vec4 w = modelMatrix * vec4(p, 1.0);
    float h = wave(w.xz) * uWave;
    p.z += h; // plane is rotated, local z is world up
    vHeight = h;
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
  uniform float uFlow;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vHeight;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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

  void main() {
    // distance from the banks (uv.x 0 and 1 are the shores)
    float edge = min(vUv.x, 1.0 - vUv.x);
    float depth = smoothstep(0.0, 0.35, edge);
    vec3 col = mix(uShallow, uDeep, depth);

    // normal from analytic-ish noise for lighting
    vec2 flowUv = vWorld.xz * 0.6 + vec2(0.0, uTime * uFlow);
    float n1 = fbm(flowUv);
    float n2 = fbm(flowUv * 1.7 + 4.0 - vec2(uTime * 0.2, 0.0));
    vec3 normal = normalize(vec3((n1 - 0.5) * 0.9, 1.0, (n2 - 0.5) * 0.9));

    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
    col = mix(col, vec3(0.62, 0.84, 0.95), fresnel * 0.3);

    // sun glints
    vec3 h = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(normal, h), 0.0), 180.0);
    col += vec3(1.0, 0.95, 0.8) * spec * 2.2;

    // shore foam + drifting foam streaks
    float foamEdge = 1.0 - smoothstep(0.0, 0.07 + n1 * 0.05, edge);
    float streaks = smoothstep(0.76, 0.84, fbm(vWorld.xz * vec2(1.2, 0.35) + vec2(0.0, uTime * uFlow * 1.4)));
    float crest = smoothstep(0.25, 0.45, vHeight);
    float foam = clamp(foamEdge + streaks * 0.35 + crest * 0.25, 0.0, 1.0);
    col = mix(col, uFoam, foam);

    gl_FragColor = vec4(col, 0.92);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** Stylized animated water strip. Banks run along the plane's left and right edges. */
export function Water({
  width = 6,
  length = 40,
  position = [0, 0, 0],
  shallow = '#3fc1b5',
  deep = '#0d4f7a',
  foam = '#f4fbff',
  flow = 0.35,
  waveHeight = 0.06,
  segments = 128,
}: WaterProps) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uFlow: { value: flow },
          uWave: { value: waveHeight },
          uShallow: { value: new THREE.Color(shallow) },
          uDeep: { value: new THREE.Color(deep) },
          uFoam: { value: new THREE.Color(foam) },
          uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        },
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });
  return (
    <mesh position={position} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[width, length, Math.round(segments * (width / length)) + 8, segments]} />
      <shaderMaterial
        ref={mat}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        fog
      />
    </mesh>
  );
}
