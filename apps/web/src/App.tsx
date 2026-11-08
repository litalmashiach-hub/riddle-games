import { loadProgress, recordStars, type Progress } from '@riddle/engine';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { LEVELS } from './levels';
import { LevelMap } from './screens/LevelMap';
import { PlayScreen } from './screens/PlayScreen';

/** `#/level/wolf-two-sheep` opens a level directly (handy when building one). */
const levelFromHash = () => {
  const m = location.hash.match(/^#\/level\/([\w-]+)/);
  return m ? (LEVELS.find((l) => l.id === m[1] && l.level)?.id ?? null) : null;
};

export function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [playing, setPlaying] = useState<string | null>(levelFromHash);

  useEffect(() => {
    const onHash = () => setPlaying(levelFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const open = useCallback((id: string | null) => {
    location.hash = id ? `#/level/${id}` : '#/';
    setPlaying(id);
  }, []);

  const entry = LEVELS.find((l) => l.id === playing);
  const nextBuilt = entry ? LEVELS.find((l) => l.number > entry.number && l.level) : undefined;

  return (
    <AnimatePresence mode="wait">
      {entry?.level ? (
        <motion.div key={entry.id} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <PlayScreen
            level={entry.level}
            onExit={() => open(null)}
            onNext={nextBuilt ? () => open(nextBuilt.id) : undefined}
            onSolved={(stars) => setProgress((p) => recordStars(p, entry.id, stars))}
          />
        </motion.div>
      ) : (
        <motion.div key="map" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <LevelMap progress={progress} onPlay={open} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
