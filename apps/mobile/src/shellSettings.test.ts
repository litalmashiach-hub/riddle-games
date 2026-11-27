/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the iOS shell's orientation settings without a Mac: the app is sideways only on iPhone and iPad
 * (every scene is built wide), and the iPad side keeps UIRequiresFullScreen, without which an iPad app has to
 * list all four orientations. Info.plist and GameViewController.swift must say the same. See docs/ios-app.md.
 */
const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', 'ios', 'App', 'App');
const plist = readFileSync(join(app, 'Info.plist'), 'utf8');
const controller = readFileSync(join(app, 'GameViewController.swift'), 'utf8');

const SIDEWAYS = ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];

/** The value right after <key>name</key> in the top-level dictionary, as raw XML. */
function valueOf(name: string): string | undefined {
  const at = plist.indexOf(`<key>${name}</key>`);
  if (at < 0) return undefined;
  const rest = plist.slice(at + `<key>${name}</key>`.length).trimStart();
  if (rest.startsWith('<true/>')) return '<true/>';
  if (rest.startsWith('<false/>')) return '<false/>';
  const array = rest.match(/^<array>([\s\S]*?)<\/array>/);
  return array ? array[0] : rest.split('\n')[0];
}

function stringsOf(name: string): string[] | undefined {
  const raw = valueOf(name);
  if (raw === undefined || !raw.startsWith('<array>')) return undefined;
  return [...raw.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
}

describe('iOS shell orientation settings', () => {
  it('iPhone: sideways only, both directions', () => {
    expect(stringsOf('UISupportedInterfaceOrientations')).toEqual(SIDEWAYS);
  });

  it('iPad: sideways only, both directions', () => {
    expect(stringsOf('UISupportedInterfaceOrientations~ipad')).toEqual(SIDEWAYS);
  });

  it('iPad: keeps UIRequiresFullScreen, which a sideways-only iPad app needs', () => {
    expect(valueOf('UIRequiresFullScreen')).toBe('<true/>');
  });

  it('the view controller allows the same orientations, on every device', () => {
    const body = controller.match(/override var supportedInterfaceOrientations: UIInterfaceOrientationMask \{([^}]*)\}/);
    expect(body, 'supportedInterfaceOrientations is missing from GameViewController.swift').not.toBeNull();
    expect(body![1].trim()).toBe('.landscape');
  });
});

/**
 * The lowest iOS the app allows. 16.4 is the floor the game's style tool (Tailwind CSS 4) is built for: below 16.2
 * the gold, green and red buttons lose their gradient fill, and below 15.4 the app never starts. `cap sync`
 * rewrites CapApp-SPM/Package.swift from the major number alone, so the package says .v16 while the app says 16.4.
 */
describe('iOS minimum system', () => {
  const pbx = readFileSync(join(here, '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
  const spm = readFileSync(join(here, '..', 'ios', 'App', 'CapApp-SPM', 'Package.swift'), 'utf8');

  it('every build setting of the Xcode project says 16.4', () => {
    const targets = [...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(0);
    expect(new Set(targets)).toEqual(new Set(['16.4']));
  });

  it('the Swift package says iOS 16, as cap sync writes it', () => {
    expect(spm).toContain('platforms: [.iOS(.v16)]');
  });
});
