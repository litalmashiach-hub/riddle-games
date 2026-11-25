import { sfx } from '@riddle/fx';
import type { ReactNode } from 'react';
import { APP_INFO } from '../about/appInfo';
import { privacyPolicy } from '../about/privacyPolicy';

/**
 * The pages of the About screen that only the app build shows: Privacy and Contact (see src/about/shown.ts).
 * AboutScreen draws them behind APP_SHELL, so the website build leaves this file's two pages, and the policy's
 * text with them, out of its built files.
 */

export function PageTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-outline font-display text-xl font-semibold leading-tight sm:text-2xl ${className}`}>{children}</h2>;
}

export function PrivacyPage() {
  const policy = privacyPolicy();
  return (
    <article className="mx-auto max-w-2xl">
      <PageTitle>{policy.title}</PageTitle>
      {policy.effective && <p className="mt-1 text-sm text-sky-100/70">{policy.effective}</p>}
      <p className="mt-3 text-base leading-relaxed text-sky-50/90">{policy.intro}</p>
      <p className="mt-3 rounded-2xl bg-amber-200/15 px-4 py-2.5 font-display text-base font-semibold text-amber-100">{policy.short}</p>
      {policy.sections.map((s) => (
        <section key={s.heading} className="mt-5">
          <h3 className="font-display text-lg font-semibold text-amber-100">{s.heading}</h3>
          {s.blocks.map((b, i) =>
            typeof b === 'string' ? (
              <p key={i} className="mt-1.5 text-base leading-relaxed text-sky-50/90">{b}</p>
            ) : (
              <ul key={i} className="mt-1.5 list-disc space-y-1 pl-5 text-base leading-relaxed text-sky-50/90 marker:text-amber-300">
                {b.points.map((point) => (<li key={point}>{point}</li>))}
              </ul>
            ),
          )}
        </section>
      ))}
    </article>
  );
}

export function ContactPage() {
  const { name, contactEmail, publisherName, version } = APP_INFO;
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle>Contact</PageTitle>
      <p className="mt-3 text-base leading-relaxed text-sky-50/90">A question, a riddle that misbehaves, or an idea for the game? Write to us. It helps to say which iPhone or iPad you use and which riddle you were on.</p>
      <div className="mt-4 rounded-2xl bg-white/[0.07] px-4 py-4 text-center" data-testid="contact-line">
        {contactEmail ? (
          <>
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent(`${name} ${version}`)}`}
              onClick={() => sfx.click()}
              className="btn-3d inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 px-5 py-2.5 font-display text-base font-semibold text-amber-950"
            >
              Write an email
            </a>
            <p className="mt-3 select-text break-all font-display text-lg font-semibold [-webkit-touch-callout:default]">{contactEmail}</p>
          </>
        ) : (
          <p className="text-base leading-relaxed text-sky-100/80">The contact address will be here before the game is released.</p>
        )}
      </div>
      <p className="mt-4 text-sm text-sky-100/70">
        {name}
        {publisherName ? ` is made by ${publisherName}.` : '.'} Version {version}.
      </p>
    </div>
  );
}

