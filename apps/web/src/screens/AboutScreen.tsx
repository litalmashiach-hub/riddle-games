import type { Progress } from '@riddle/engine';
import { sfx, useSettings } from '@riddle/fx';
import { useEffect, useId, useRef, useState } from 'react';
import { APP_VERSION } from '../about/appInfo';
import { LICENCE_NAMES, LICENCE_TEXTS, type LicenceId } from '../about/licenceTexts';
import { LICENCES_IN_USE, NOTICES } from '../about/notices';
import { PAGES, SHOWN_NAME, type PageId } from '../about/shown';
import { APP_SHELL } from '../appShell';
import { ContactPage, PageTitle, PrivacyPage } from './AboutStorePages';
import { Button } from '../components/Button';
import { Stars } from '../components/Stars';

const ICON = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
/** The cog on the level map that opens this screen. */
export const GearIcon = () => (
  <svg {...ICON}>
    <circle cx="12" cy="12" r="6.2" />
    <circle cx="12" cy="12" r="2.2" />
    <path d="M12 2.6v3.2M12 18.2v3.2M2.6 12h3.2M18.2 12h3.2M5.35 5.35l2.27 2.27M16.38 16.38l2.27 2.27M5.35 18.65l2.27-2.27M16.38 7.62l2.27-2.27" />
  </svg>
);
const BackIcon = () => (<svg {...ICON}><path d="M15 5l-7 7 7 7" /></svg>);

/** The same night-blue as the level map, so the screen reads as part of it. */
const BACKGROUND = 'radial-gradient(1200px 700px at 20% -10%, #3b82c4 0%, #1b3b5f 45%, #0f2236 100%)';

/**
 * About and settings: the two switches, reset of progress and the open-source notices, and in the app build
 * also the privacy policy and the contact line (src/about/shown.ts decides which build shows what).
 * Everything on it is text inside the game: it reads no file and makes no request, and its one link out
 * is the contact address.
 *
 * Layout: a slim header with the way back, then the page names (a rail on the left where the screen is
 * wide enough, a row on top on an upright phone) beside one card that scrolls inside itself.
 */
export function AboutScreen({ progress, onBack, onReset }: { progress: Progress; onBack: () => void; onReset: () => void }) {
  const [page, setPage] = useState<PageId>('settings');
  const card = useRef<HTMLDivElement>(null);
  const tabs = useId();

  useEffect(() => {
    card.current?.scrollTo({ top: 0 });
  }, [page]);

  const version = (
    <p className="font-display text-xs font-medium tracking-wide text-sky-100/60" data-testid="version">
      {SHOWN_NAME} · Version {APP_VERSION}
    </p>
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: BACKGROUND }}>
      <header className="relative flex shrink-0 items-center gap-3 pb-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] short:pb-1.5 short:pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button tone="readout" onClick={onBack} aria-label="Back to levels" className="!rounded-full !px-3.5 !py-2">
          <BackIcon />
          <span>Levels</span>
        </Button>
        <h1 className="title-shadow min-w-0 truncate font-display text-2xl font-bold leading-tight sm:text-3xl short:text-2xl">
          <span className="bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-transparent">About &amp; settings</span>
        </h1>
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:flex-row sm:gap-4">
        <nav className="flex shrink-0 flex-col sm:w-40 short:w-36" aria-label="About and settings">
          <div role="tablist" aria-orientation="horizontal" className={`grid ${APP_SHELL ? 'grid-cols-4' : 'grid-cols-2'} gap-2 sm:grid-cols-1 short:gap-1.5`}>
            {PAGES.map((p) => (
              <Button
                key={p.id}
                role="tab"
                id={`${tabs}-tab-${p.id}`}
                aria-selected={page === p.id}
                aria-controls={`${tabs}-page`}
                tone={page === p.id ? 'gold' : 'readout'}
                onClick={() => setPage(p.id)}
                // `before:hidden`: no touch pad here (see `.touch-44` in index.css). On a wide screen a tab's text is not centred, and the pad would not be either.
                className="!px-2 !py-2.5 text-sm before:hidden sm:!justify-start sm:!px-4 sm:text-base short:!py-2"
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="mt-auto hidden pb-1 pl-1 pt-3 sm:block">{version}</div>
        </nav>

        <div
          ref={card}
          id={`${tabs}-page`}
          role="tabpanel"
          aria-labelledby={`${tabs}-tab-${page}`}
          tabIndex={0}
          data-testid="about-page"
          className="panel min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-3xl px-5 py-4 outline-none [-webkit-overflow-scrolling:touch] sm:px-7 sm:py-5"
        >
          {page === 'settings' && <SettingsPage progress={progress} onReset={onReset} />}
          {APP_SHELL && page === 'privacy' && <PrivacyPage />}
          {APP_SHELL && page === 'contact' && <ContactPage />}
          {page === 'credits' && <CreditsPage />}
        </div>
        <div className="shrink-0 text-center sm:hidden">{version}</div>
      </div>
    </div>
  );
}

/** An on/off switch in the game's own look: a gold pill when on. */
function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        onChange();
        // After the change, so that turning the sound on is heard and turning it off is not.
        sfx.click();
      }}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white/[0.07] px-4 py-3 text-left short:py-2.5"
    >
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold leading-tight">{label}</span>
        <span className="mt-0.5 block text-sm leading-snug text-sky-100/80">{hint}</span>
      </span>
      <span className={`btn-3d relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-gradient-to-b from-amber-200 to-amber-500' : 'bg-slate-500/70'}`} aria-hidden>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-[left] duration-150 ${on ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  );
}

function SettingsPage({ progress, onReset }: { progress: Progress; onReset: () => void }) {
  const { sound, toggleSound, quality, setQuality } = useSettings();
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);
  const stars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const solved = Object.values(progress.stars).filter((n) => n > 0).length;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      {/* On a sideways phone the gold tab already names the page, and without the title all three rows fit. */}
      <PageTitle className="short:sr-only">Settings</PageTitle>
      <Switch label="Sound" hint="The game's sound effects." on={sound} onChange={toggleSound} />
      <Switch label="HD graphics" hint="Sharper picture and glow. Turn it off if the game feels slow." on={quality === 'high'} onChange={() => setQuality(quality === 'high' ? 'low' : 'high')} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl bg-white/[0.07] px-4 py-3 short:py-2.5">
        <div className="min-w-0 flex-1 basis-56">
          <span className="block font-display text-lg font-semibold leading-tight">Progress</span>
          <span className="mt-0.5 flex items-start gap-1.5 text-sm leading-snug text-sky-100/80" data-testid="progress-line" aria-live="polite">
            {stars > 0 ? (
              <>
                <span className="mt-0.5 shrink-0"><Stars count={1} size={14} single /></span>
                <span>{stars} {stars === 1 ? 'star' : 'stars'} on {solved} {solved === 1 ? 'riddle' : 'riddles'}, saved on this device.</span>
              </>
            ) : done ? (
              'Progress reset. Every star is gone.'
            ) : (
              'No stars yet.'
            )}
          </span>
        </div>
        <Button tone="red" disabled={stars === 0} onClick={() => setAsking(true)} className="shrink-0 !py-2">
          Reset progress
        </Button>
      </div>

      {asking && (
        <ConfirmReset
          stars={stars}
          onKeep={() => setAsking(false)}
          onErase={() => {
            onReset();
            setAsking(false);
            setDone(true);
          }}
        />
      )}
    </div>
  );
}

/** The red of the game's "try again" card, without its see-through: the page behind must not show through the question. */
const CONFIRM_BACKGROUND = 'linear-gradient(180deg, rgb(136 19 55), rgb(76 5 25))';

/**
 * The confirm step of the reset: a solid red card over the screen. Keeping the stars is the gold, inviting
 * button and the one in focus; erasing is the plain one.
 */
function ConfirmReset({ stars, onKeep, onErase }: { stars: number; onKeep: () => void; onErase: () => void }) {
  const title = useId();
  const text = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onKeep();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKeep]);
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/55 p-[max(1rem,env(safe-area-inset-top))_max(1rem,env(safe-area-inset-right))_max(1rem,env(safe-area-inset-bottom))_max(1rem,env(safe-area-inset-left))]" onClick={onKeep}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={title} aria-describedby={text} className="panel max-h-full w-full max-w-md overflow-y-auto rounded-3xl p-5 text-center short:p-4" style={{ background: CONFIRM_BACKGROUND }} onClick={(e) => e.stopPropagation()}>
        <h3 id={title} className="text-outline font-display text-2xl font-bold">Erase your stars?</h3>
        <p id={text} className="mx-auto mt-2 max-w-sm text-base leading-snug text-rose-50/95">
          {stars === 1 ? 'Your star' : `All ${stars} of your stars`} will be gone, and the riddles after the first lock again. Your sound and graphics choices stay. This can't be undone.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button autoFocus tone="gold" onClick={onKeep}>Keep my stars</Button>
          <Button onClick={onErase}>Erase stars</Button>
        </div>
      </div>
    </div>
  );
}

function CreditsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>Open-source credits</PageTitle>
      <p className="mt-3 text-base leading-relaxed text-sky-50/90">{SHOWN_NAME} is built with these open-source libraries and fonts. Thank you to the people who made them. Each is used under the licence named beside it; the full licence texts follow the list.</p>
      <ul className="mt-4 space-y-2" data-testid="notices">
        {NOTICES.map((n) => (
          <li key={n.name} className="rounded-2xl bg-white/[0.07] px-4 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-display text-base font-semibold">{n.name}</span>
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-amber-200/90">{LICENCE_NAMES[n.licence]}</span>
            </div>
            <p className="text-sm leading-snug text-sky-100/75">{n.use}</p>
            <p className="mt-0.5 break-words text-sm leading-snug text-sky-50/90">{n.copyright}</p>
          </li>
        ))}
      </ul>
      <h3 className="mt-6 font-display text-lg font-semibold text-amber-100">Licence texts</h3>
      <div className="mt-2 space-y-2">
        {LICENCES_IN_USE.map((id) => (<LicenceText key={id} id={id} />))}
      </div>
    </div>
  );
}

/** One licence in full, folded away until asked for: the longest runs to several screens. */
function LicenceText({ id }: { id: LicenceId }) {
  const [open, setOpen] = useState(false);
  const body = useId();
  return (
    <div className="rounded-2xl bg-white/[0.07]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={body}
        onClick={() => {
          sfx.click();
          setOpen((o) => !o);
        }}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-display text-base font-semibold"
      >
        <span>{LICENCE_NAMES[id]}</span>
        <span className="shrink-0 rounded-full bg-white/15 px-3 py-0.5 text-sm">{open ? 'Hide' : 'Read'}</span>
      </button>
      {open && (
        <pre id={body} className="whitespace-pre-wrap break-words px-4 pb-4 font-sans text-xs leading-relaxed text-sky-50/85">
          {LICENCE_TEXTS[id]}
        </pre>
      )}
    </div>
  );
}
