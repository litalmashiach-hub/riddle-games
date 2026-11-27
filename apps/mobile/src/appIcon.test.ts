/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the app icon's asset catalog without a Mac. iOS 18 and later can show home screen icons Dark or
 * Tinted; the app ships its own versions of both beside the standard icon (see docs/ios-app.md), and older
 * iOS ignores the extra entries. Apple refuses a standard icon with an alpha channel; the dark one may keep
 * a transparent background, and the tinted one is a greyscale image that iOS colours.
 */
const here = dirname(fileURLToPath(import.meta.url));
const set = join(here, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');

type Entry = { filename?: string; idiom: string; platform?: string; size: string; appearances?: { appearance: string; value: string }[] };
const entries: Entry[] = JSON.parse(readFileSync(join(set, 'Contents.json'), 'utf8')).images;

/** Width, height and PNG colour type (0 grey, 2 RGB, 4 grey with alpha, 6 RGB with alpha) from the header. */
function png(file: string) {
  const b = readFileSync(join(set, file));
  expect(b.subarray(1, 4).toString('latin1'), `${file} is a PNG`).toBe('PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colourType: b[25] };
}

const look = (e: Entry) => e.appearances?.find((a) => a.appearance === 'luminosity')?.value ?? 'any';

describe('app icon', () => {
  it('has exactly one standard, one dark and one tinted 1024 pixel iOS icon', () => {
    expect(entries.map(look).sort()).toEqual(['any', 'dark', 'tinted']);
    for (const e of entries) {
      expect(e).toMatchObject({ idiom: 'universal', platform: 'ios', size: '1024x1024' });
      expect(e.filename, `${look(e)} has a file`).toBeTruthy();
      expect(e.appearances ?? [], `${look(e)} names only the luminosity look`).toHaveLength(look(e) === 'any' ? 0 : 1);
    }
  });

  it('keeps each picture in the form iOS expects', () => {
    const byLook = Object.fromEntries(entries.map((e) => [look(e), png(e.filename!)]));
    for (const [name, p] of Object.entries(byLook)) expect([p.width, p.height], name).toEqual([1024, 1024]);
    expect(byLook.any.colourType, 'standard icon: opaque RGB, no alpha').toBe(2);
    expect(byLook.dark.colourType, 'dark icon: RGB with a transparent background').toBe(6);
    expect(byLook.tinted.colourType, 'tinted icon: opaque greyscale').toBe(0);
  });
});
