import type { Progress } from '@riddle/engine';
import { WORLDS, sfx, useSettings } from '@riddle/fx';
import { motion } from 'motion/react';
import { Stars } from '../components/Stars';
import { LockIcon, PlayIcon, SoundIcon } from '../components/Icons';
import { LEVELS, WORLD_ORDER, type LevelEntry } from '../levels';

/** A built level is open when every built level before it is solved. `?all` opens everything. */
function isUnlocked(entry: LevelEntry, progress: Progress) {
  if (new URLSearchParams(location.search).has('all') || import.meta.env.DEV) return true;
  return LEVELS.filter((l) => l.level && l.number < entry.number).every((l) => (progress.stars[l.id] ?? 0) > 0);
}

export function LevelMap({ progress, onPlay }: { progress: Progress; onPlay: (id: string) => void }) {
  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const { sound, toggleSound } = useSettings();
  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden" style={{ background: 'radial-gradient(1200px 700px at 20% -10%, #3b82c4 0%, #1b3b5f 45%, #0f2236 100%)' }}>
      <Backdrop />
      <div className="relative mx-auto max-w-5xl pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(6rem,env(safe-area-inset-bottom))] pt-[max(4.25rem,calc(env(safe-area-inset-top)+3.25rem))] sm:pt-16">
        <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]">
          <button className="glass btn-3d rounded-full p-2.5" onClick={toggleSound} aria-label={sound ? 'Mute' : 'Unmute'}>
            <SoundIcon on={sound} />
          </button>
        </div>
        <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }} className="text-center">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.35em] text-amber-200/90">{LEVELS.length} legendary puzzles</p>
          <h1 className="text-outline mt-2 font-display text-5xl font-bold leading-none sm:text-7xl">
            <span className="bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-transparent">Riddle Games</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-sky-100/85 sm:text-lg">Cross rivers, measure potions and outsmart the scales. Every level is harder than the last.</p>
          <div className="glass mx-auto mt-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5">
            <Stars count={1} size={16} />
            <span className="font-display font-semibold">{totalStars} / {LEVELS.length * 3}</span>
          </div>
        </motion.header>

        {WORLD_ORDER.map((w, wi) => {
          const look = WORLDS[w];
          const levels = LEVELS.filter((l) => l.world === w);
          return (
            <motion.section key={w} initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: 0.05 * wi, type: 'spring', stiffness: 90, damping: 16 }} className="mt-12">
              <div className="mb-4 flex items-baseline gap-3">
                <span className="font-display text-sm font-semibold uppercase tracking-widest" style={{ color: look.accent }}>World {wi + 1}</span>
                <h2 className="text-outline font-display text-2xl font-semibold sm:text-3xl">{look.name}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {levels.map((entry) => (
                  <LevelCard key={entry.id} entry={entry} stars={progress.stars[entry.id] ?? 0} unlocked={isUnlocked(entry, progress)} onPlay={onPlay} />
                ))}
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}

function LevelCard({ entry, stars, unlocked, onPlay }: { entry: LevelEntry; stars: number; unlocked: boolean; onPlay: (id: string) => void }) {
  const look = WORLDS[entry.world];
  const playable = !!entry.level && unlocked;
  return (
    <motion.button
      whileHover={playable ? { y: -6, rotate: -0.6 } : undefined}
      whileTap={playable ? { scale: 0.97 } : undefined}
      onClick={() => (playable ? onPlay(entry.id) : sfx.denied())}
      className={`group relative h-44 overflow-hidden rounded-3xl text-left shadow-[0_18px_40px_rgb(0_0_0/0.35)] ${playable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ background: look.uiGradient }}
      aria-label={`Level ${entry.number}: ${entry.title}${entry.level ? '' : ' (coming soon)'}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(255_255_255/0.35),transparent_60%)]" />
      <div className="absolute -bottom-10 -right-6 font-display text-[9rem] font-bold leading-none text-white/15 transition-transform duration-500 group-hover:scale-110">{entry.number}</div>
      <div className={`relative flex h-full flex-col p-5 ${playable ? '' : 'opacity-70 saturate-50'}`}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-black/25 px-2.5 py-0.5 font-display text-xs font-semibold tracking-wider">LEVEL {entry.number}</span>
          {entry.level ? (unlocked ? <Stars count={stars} size={18} /> : <LockIcon />) : <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold">Coming soon</span>}
        </div>
        <h3 className="text-outline mt-auto font-display text-xl font-semibold leading-tight">{entry.title}</h3>
        <p className="mt-1 text-sm text-white/85">{entry.tagline}</p>
      </div>
      {playable && (
        <div className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white text-slate-900 opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100">
          <PlayIcon />
        </div>
      )}
    </motion.button>
  );
}

/** Slow drifting light blobs behind the map. */
function Backdrop() {
  const blobs = [
    { c: '#ffd166', x: '10%', y: '12%', s: 380, d: 18 },
    { c: '#06d6a0', x: '75%', y: '30%', s: 460, d: 24 },
    { c: '#ef476f', x: '30%', y: '70%', s: 420, d: 21 },
    { c: '#818cf8', x: '85%', y: '85%', s: 360, d: 27 },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full opacity-25 blur-3xl"
          style={{ left: b.x, top: b.y, width: b.s, height: b.s, background: b.c, translateX: '-50%', translateY: '-50%' }}
          animate={{ x: [0, 60, -40, 0], y: [0, -50, 40, 0], scale: [1, 1.15, 0.9, 1] }}
          transition={{ duration: b.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
