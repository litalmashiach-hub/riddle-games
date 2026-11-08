import { Html } from '@react-three/drei';
import type { ReactNode } from 'react';

/** A speech/emote bubble floating in 3D space, drawn as HTML. */
export function Bubble({ position, children, tone = 'white' }: { position: [number, number, number]; children: ReactNode; tone?: 'white' | 'red' | 'gold' }) {
  const bg = tone === 'red' ? '#ef476f' : tone === 'gold' ? '#ffd166' : '#ffffff';
  const fg = tone === 'red' ? '#fff' : '#1f2937';
  return (
    <Html position={position} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          background: bg,
          color: fg,
          padding: '4px 12px',
          borderRadius: 999,
          fontFamily: 'Fredoka, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 20,
          boxShadow: '0 6px 16px rgba(0,0,0,.3)',
          whiteSpace: 'nowrap',
          animation: 'riddle-pop .35s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {children}
      </div>
      <style>{`@keyframes riddle-pop{from{transform:scale(0)}to{transform:scale(1)}}`}</style>
    </Html>
  );
}
