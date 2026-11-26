import { hasSeenGuide, loadProgress, markGuideSeen, recordStars, saveProgress, type Progress, type RiddleLevel } from '@riddle/engine';
import { WORLDS } from '@riddle/fx';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, use, useCallback, useEffect, useState, type ComponentProps } from 'react';
import { LEVELS, type LevelEntry } from './levels';
import { AboutScreen } from './screens/AboutScreen';
import { LevelMap } from './screens/LevelMap';

/** `#/level/wolf-two-sheep` opens a level directly (handy when building one). */
const levelFromHash = () => {
  const m = location.hash.match(/^#\/level\/([\w-]+)/);
  return m ? (LEVELS.find((l) => l.id === m[1] && l.load)?.id ?? null) : null;
};

/** `#/about` is the About and settings screen. */
const aboutFromHash = () => /^#\/about\b/.test(location.hash);

export function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [playing, setPlaying] = useState<string | null>(levelFromHash);
  const [about, setAbout] = useState(aboutFromHash);

  useEffect(() => {
    const onHash = () => {
      setPlaying(levelFromHash());
      setAbout(aboutFromHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const open = useCallback((id: string | null) => {
    location.hash = id ? `#/level/${id}` : '#/';
    setPlaying(id);
    setAbout(false);
  }, []);

  const openAbout = useCallback((show: boolean) => {
    location.hash = show ? '#/about' : '#/';
    setPlaying(null);
    setAbout(show);
  }, []);

  /**
   * Clears the stars, on the device and on screen, and with them the note that level 1's first-play guide was
   * seen, so the guide shows again. The sound and graphics choices are kept apart and stay.
   */
  const resetProgress = useCallback(() => {
    const empty: Progress = { stars: {} };
    saveProgress(empty);
    setProgress(empty);
  }, []);

  const entry = LEVELS.find((l) => l.id === playing);
  const nextBuilt = entry ? LEVELS.find((l) => l.number > entry.number && l.load) : undefined;

  return (
    <AnimatePresence mode="wait">
      {entry?.load ? (
        <motion.div key={entry.id} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <LevelPlay
            entry={entry}
            onExit={() => open(null)}
            onNext={nextBuilt ? () => open(nextBuilt.id) : undefined}
            onSolved={(stars) => setProgress((p) => recordStars(p, entry.id, stars))}
            guideSeen={hasSeenGuide(progress, entry.id)}
            onGuideSeen={() => setProgress((p) => markGuideSeen(p, entry.id))}
          />
        </motion.div>
      ) : about ? (
        <motion.div key="about" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <AboutScreen progress={progress} onBack={() => openAbout(false)} onReset={resetProgress} />
        </motion.div>
      ) : (
        <motion.div key="map" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <LevelMap progress={progress} onPlay={open} onAbout={() => openAbout(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The play screen and the level's own code are loaded only when a level opens (see levels.ts), so the level
 * map comes up without reading three.js and 30 scenes first. Both are asked for at once, and kept once loaded.
 */
type PlayModule = typeof import('./screens/PlayScreen');
let playModule: Promise<PlayModule> | null = null;
const opening = new Map<string, Promise<{ PlayScreen: PlayModule['PlayScreen']; level: RiddleLevel } | null>>();

function openLevel(entry: LevelEntry) {
  let p = opening.get(entry.id);
  if (!p) {
    playModule ??= import('./screens/PlayScreen');
    const play = playModule;
    p = Promise.all([play, entry.load!()]).then(
      ([m, level]) => ({ PlayScreen: m.PlayScreen, level }),
      () => {
        // Not loaded (on the website, the network may have dropped): forget it, so the next tap tries again.
        opening.delete(entry.id);
        if (playModule === play) playModule = null;
        return null;
      },
    );
    opening.set(entry.id, p);
  }
  return p;
}

type LevelPlayProps = { entry: LevelEntry } & Omit<ComponentProps<PlayModule['PlayScreen']>, 'level'>;

function LevelPlay(props: LevelPlayProps) {
  return (
    <Suspense fallback={<LevelLoading entry={props.entry} />}>
      <LoadedLevel {...props} />
    </Suspense>
  );
}

function LoadedLevel({ entry, ...rest }: LevelPlayProps) {
  const loaded = use(openLevel(entry));
  const { onExit } = rest;
  // A level that could not be loaded goes back to the map rather than leave a blank screen.
  useEffect(() => {
    if (!loaded) onExit();
  }, [loaded, onExit]);
  if (!loaded) return <LevelLoading entry={entry} />;
  const { PlayScreen, level } = loaded;
  return <PlayScreen level={level} {...rest} />;
}

/** While a level's code arrives: the same look as the play screen's own loading curtain, so one runs into the other. */
function LevelLoading({ entry }: { entry: LevelEntry }) {
  return (
    <div className="relative h-full overflow-hidden" style={{ background: WORLDS[entry.world].uiGradient }} role="status" aria-label="Loading level">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(255_255_255/0.3),transparent_60%)]" />
      <div className="absolute -bottom-[0.18em] right-[4%] font-display text-[min(70vh,24rem)] font-bold leading-none text-white/15">{entry.number}</div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex items-center gap-3 font-display text-lg font-semibold text-white/90">
          <span className="loading-dots" aria-hidden>
            <i /><i /><i />
          </span>
          Setting the scene
        </div>
      </div>
    </div>
  );
}
