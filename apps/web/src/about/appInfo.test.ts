import { describe, expect, it } from 'vitest';
import { APP_INFO, releaseBlockers, type AppInfo } from './appInfo';
import { privacyPolicy } from './privacyPolicy';

const READY: AppInfo = { name: 'Riddlebrook', version: '1.0', contactEmail: 'hello@riddlebrook.app', publisherName: 'A. Publisher', policyEffectiveDate: '1 December 2026' };

/** Set by whoever makes a store build: `RELEASE=1 pnpm test`. */
const RELEASE = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.RELEASE;

describe('release placeholders', () => {
  it('names each placeholder that stops a release', () => {
    expect(releaseBlockers(READY)).toEqual([]);
    expect(releaseBlockers({ ...READY, contactEmail: null })[0]).toMatch(/contact email is still a placeholder/);
    expect(releaseBlockers({ ...READY, contactEmail: '  ' })).toHaveLength(1);
    expect(releaseBlockers({ ...READY, contactEmail: 'you@example.com' })[0]).toMatch(/not a real address/);
    expect(releaseBlockers({ ...READY, contactEmail: 'not an address' })[0]).toMatch(/not a real address/);
    expect(releaseBlockers({ ...READY, publisherName: null })[0]).toMatch(/publisher's name/);
    expect(releaseBlockers({ ...READY, policyEffectiveDate: null })[0]).toMatch(/effective date/);
    expect(releaseBlockers({ ...READY, version: 'one' })[0]).toMatch(/not a version number/);
    expect(releaseBlockers({ ...READY, contactEmail: null, publisherName: null, policyEffectiveDate: null })).toHaveLength(3);
  });

  /**
   * The loud one. With RELEASE=1 it fails while a placeholder is left, and says which.
   * Without RELEASE it passes, and prints the same list as a warning, so everyday checks stay green.
   */
  it('RELEASE CHECK: the contact, publisher and policy date are filled in', () => {
    const blockers = releaseBlockers(APP_INFO);
    if (blockers.length === 0) return;
    const list = blockers.map((b) => `  - ${b}`).join('\n');
    if (RELEASE) {
      expect.fail(`\n\nNOT READY FOR RELEASE. The game still has placeholders:\n${list}\n`);
    }
    console.warn(`\n⚠️  NOT READY FOR RELEASE (this test fails under RELEASE=1):\n${list}\n`);
  });
});

describe('the privacy policy text', () => {
  it('uses the name, publisher, date and contact from the one place', () => {
    const p = privacyPolicy(READY);
    const all = JSON.stringify(p);
    expect(p.title).toBe('Riddlebrook Privacy Policy');
    expect(p.effective).toBe('Effective 1 December 2026');
    expect(p.intro).toContain('by A. Publisher');
    expect(all).toContain('Questions about this policy: hello@riddlebrook.app');
    expect(privacyPolicy({ ...READY, name: 'Other' }).short).toContain('Other collects nothing');
  });

  it('shows no bracketed blank and no "null" while the placeholders are open', () => {
    const p = privacyPolicy({ ...READY, contactEmail: null, publisherName: null, policyEffectiveDate: null });
    expect(p.effective).toBeNull();
    const shown = [p.title, p.intro, p.short, ...p.sections.flatMap((s) => [s.heading, ...s.blocks.flatMap((b) => (typeof b === 'string' ? [b] : b.points))])];
    for (const text of shown) expect(text).not.toMatch(/\[[A-Z' ]+\]|null|undefined/);
    expect(p.intro).toBe('Riddlebrook is a puzzle game. This policy covers the Riddlebrook app for iPhone and iPad.');
  });

  it('has every part that Apple asks a policy to answer', () => {
    const headings = privacyPolicy(READY).sections.map((s) => s.heading);
    expect(headings).toEqual(['What we collect', 'What is saved on your device', 'Sharing', 'Keeping and deleting', 'Children', 'Apple', 'Changes', 'Contact']);
  });
});
