import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useSettings } from './settings';

/**
 * Shared post-processing: bloom, vignette, filmic tone mapping, SMAA.
 * Note: N8AO (ambient occlusion) crashes with three 0.187, so it is left out for now.
 */
export function PostFX() {
  const high = useSettings((s) => s.quality) === 'high';
  return high ? (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.9} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.55} />
      <SMAA />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={0.9} intensity={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  );
}
