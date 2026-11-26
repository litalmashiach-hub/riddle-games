import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_INFO, releaseAsked } from './appInfo';
import { identityBlockers, readIdentity } from './identity';

const FILE = join(__dirname, '..', '..', '..', 'mobile', 'ios', 'AppIdentity.xcconfig');
const READY = '// a comment = not a value\nAPP_BUNDLE_ID = com.someone.riddlebrook\nAPP_DISPLAY_NAME = Riddlebrook\nAPP_VERSION = 1.0\nAPP_BUILD = 3\n';
const RELEASE = releaseAsked((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.RELEASE);

describe('the name under the icon and the name in the game', () => {
  it('reads the values and skips comments', () => {
    expect(readIdentity(READY)).toEqual({ APP_BUNDLE_ID: 'com.someone.riddlebrook', APP_DISPLAY_NAME: 'Riddlebrook', APP_VERSION: '1.0', APP_BUILD: '3' });
  });

  it('names each difference', () => {
    const info = { name: 'Riddlebrook', version: '1.0' };
    expect(identityBlockers(READY, info)).toEqual([]);
    expect(identityBlockers(READY.replace('= Riddlebrook', '= Riddle Games'), info)[0]).toMatch(/name under the icon/);
    expect(identityBlockers(READY.replace('= 1.0', '= 1.0.1'), info)[0]).toMatch(/version/);
    expect(identityBlockers(READY.replace('com.someone', 'com.example'), info)[0]).toMatch(/example one/);
  });

  it('can read the real file', () => {
    const id = readIdentity(readFileSync(FILE, 'utf8'));
    expect(Object.keys(id).sort()).toEqual(['APP_BUILD', 'APP_BUNDLE_ID', 'APP_DISPLAY_NAME', 'APP_VERSION']);
  });

  /** Like the placeholder check in appInfo.test.ts: fails under RELEASE=1, warns otherwise. */
  it('RELEASE CHECK: one name and one version, and the owner\'s bundle identifier', () => {
    const blockers = identityBlockers(readFileSync(FILE, 'utf8'), APP_INFO);
    if (blockers.length === 0) return;
    const list = blockers.map((b) => `  - ${b}`).join('\n');
    if (RELEASE) expect.fail(`\n\nNOT READY FOR RELEASE:\n${list}\n`);
    console.warn(`\n⚠️  NOT READY FOR RELEASE (this test fails under RELEASE=1):\n${list}\n`);
  });
});
