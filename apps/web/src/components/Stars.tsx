import { motion } from 'motion/react';

const Star = ({ on, size }: { on: boolean; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path
      d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"
      fill={on ? 'url(#star-gold)' : 'rgb(255 255 255 / 0.18)'}
      stroke={on ? '#b7791f' : 'rgb(255 255 255 / 0.35)'}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="star-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3b0" />
        <stop offset="0.5" stopColor="#ffd166" />
        <stop offset="1" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
  </svg>
);

export function Stars({ count, size = 18, animate = false }: { count: number; size?: number; animate?: boolean }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((i) =>
        animate ? (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.25 + i * 0.22, type: 'spring', stiffness: 260, damping: 12 }}
          >
            <Star on={i <= count} size={size} />
          </motion.div>
        ) : (
          <Star key={i} on={i <= count} size={size} />
        ),
      )}
    </div>
  );
}
