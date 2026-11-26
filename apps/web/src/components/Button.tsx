import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { sfx } from '@riddle/fx';

type Tone = 'gold' | 'glass' | 'readout' | 'green' | 'red';
const TONES: Record<Tone, string> = {
  gold: 'bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 text-amber-950',
  green: 'bg-gradient-to-b from-emerald-300 to-emerald-500 text-emerald-950',
  red: 'bg-gradient-to-b from-rose-300 to-rose-500 text-rose-950',
  glass: 'glass text-white',
  // Tinted glass for buttons that sit over the scene, so their white icons stay readable over a white sky.
  // The play screen's round buttons and the About screen's back button wear it, and they are drawn smaller
  // than a fingertip: `touch-44` (index.css) gives each an unseen pad, so it takes touches over 44 by 44
  // points. A button that does not centre its content needs more, as the About tabs do (`touch-44-tab`).
  readout: 'glass-readout touch-44 text-white',
};

export function Button({
  tone = 'glass',
  children,
  className = '',
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; children: ReactNode }) {
  return (
    <button
      {...rest}
      onClick={(e) => {
        sfx.click();
        onClick?.(e);
      }}
      className={`btn-3d inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 font-display text-base font-semibold disabled:opacity-40 disabled:pointer-events-none ${TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}
