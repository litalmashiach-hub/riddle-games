import { describe, expect, it } from 'vitest';
import { APP_INFO, releaseAsked, releaseBlockers, type AppInfo } from './appInfo';
import { policyPhrases, privacyPolicy } from './privacyPolicy';

const READY: AppInfo = { name: 'Riddlebrook', version: '1.0', contactEmail: 'hello@riddlebrook.app', publisherName: 'A. Publisher', policyEffectiveDate: '1 December 2026' };

/** Set by whoever makes a store build: `RELEASE=1 pnpm test`. */
const RELEASE = releaseAsked((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.RELEASE);

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

  it('is asked for by RELEASE=1, and not by 0, false or nothing', () => {
    for (const off of [undefined, null, '', '  ', '0', 'false', 'FALSE', ' false ']) expect(releaseAsked(off), JSON.stringify(off)).toBe(false);
    for (const on of ['1', 'true', 'yes', 'store']) expect(releaseAsked(on), on).toBe(true);
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
    expect(headings).toEqual(['What we collect', 'What is saved on your device', 'Sharing', 'Keeping and deleting', 'If you write to us', 'Children', 'Apple', 'Changes', 'Contact']);
  });

  it('says of the game what the launch policy says, in the five places where the two once differed', () => {
    const all = privacyPolicy(READY).sections.flatMap((s) => s.blocks.flatMap((b) => (typeof b === 'string' ? [b] : b.points))).join('\n');
    for (const sentence of [
      'The game never connects to the internet.',
      'The game never sends this information anywhere. We cannot see it, and nobody receives it from us.',
      "To erase your stars, use Reset progress on the Settings page of the game's About & settings screen; your sound and graphics choices stay. To erase everything the game has saved, delete the app.",
      "The game's Contact page opens your own email app. If you send us an email, we receive your email address and whatever you write, and we use them only to answer you.",
      "If you back up your device, the backup may include the game's saved stars and settings, as it does for your other apps. All of that is governed by Apple's own privacy policy, not this one.",
    ]) {
      expect(all).toContain(sentence);
    }
    expect(all).not.toMatch(/while you play|never leaves your device|Settings page of this screen/);
  });

  it('gives the search of the built files words from every sentence, the name and the blanks cut out', () => {
    const phrases = policyPhrases(READY);
    const blocks = privacyPolicy(READY).sections.flatMap((s) => s.blocks.flatMap((b) => (typeof b === 'string' ? [b] : b.points)));
    for (const block of blocks) {
      if (block.startsWith('Questions about this policy')) continue; // too short once the address is cut out; the heading test covers it
      expect(phrases.some((phrase) => block.includes(phrase)), block).toBe(true);
    }
    for (const phrase of phrases) {
      expect(phrase.length).toBeGreaterThanOrEqual(24);
      expect(phrase).not.toMatch(/Riddlebrook|A\. Publisher|hello@|['"`]/);
    }
    expect(phrases).toContain('The game never connects to the internet.');
    expect(phrases).toContain('your sound and graphics choices stay.');
  });
});
