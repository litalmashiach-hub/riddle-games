import type { LicenceId } from './licenceTexts';

/**
 * Every open-source work that ships inside the game: the libraries in the built JavaScript, the fonts,
 * the style reset, and the native shell of the iPhone and iPad app.
 *
 * `packages` are the npm packages a notice answers for. The build fails when a package that ends up in
 * the bundle has no notice here (see releaseChecks.ts), so a new dependency cannot ship unnoticed.
 */
export interface Notice {
  name: string;
  /** What it does in the game, in a few words. */
  use: string;
  copyright: string;
  licence: LicenceId;
  packages: string[];
}

const META = 'Copyright (c) Meta Platforms, Inc. and affiliates.';

export const NOTICES: Notice[] = [
  { name: 'three.js', use: '3D drawing', copyright: 'Copyright © 2010-2026 three.js authors', licence: 'MIT', packages: ['three'] },
  { name: 'React', use: 'screens and buttons', copyright: META, licence: 'MIT', packages: ['react', 'react-dom', 'scheduler', 'use-sync-external-store'] },
  // @react-three/fiber carries its own copy of React's reconciler (Meta, MIT) inside its build.
  { name: 'React Three Fiber', use: '3D scenes in React', copyright: `Copyright (c) 2019-2025 Poimandres. Includes react-reconciler, ${META}`, licence: 'MIT', packages: ['@react-three/fiber'] },
  { name: 'Drei', use: 'sky, lights and labels', copyright: 'Copyright (c) 2020 react-spring', licence: 'MIT', packages: ['@react-three/drei'] },
  { name: 'React Postprocessing', use: 'screen effects', copyright: 'Copyright (c) 2020 react-spring', licence: 'MIT', packages: ['@react-three/postprocessing'] },
  { name: 'postprocessing', use: 'screen effects', copyright: 'Copyright © 2015 Raoul van Rüschen', licence: 'Zlib', packages: ['postprocessing'] },
  { name: 'N8AO', use: 'soft shading (part of the effects library)', copyright: 'By N8python. Dedicated to the public domain.', licence: 'CC0-1.0', packages: ['n8ao'] },
  { name: 'three-stdlib', use: 'camera controls and loaders', copyright: 'Copyright (c) 2021-2023 Poimandres', licence: 'MIT', packages: ['three-stdlib'] },
  { name: 'maath', use: 'maths helpers', copyright: 'Copyright (c) Poimandres', licence: 'MIT', packages: ['maath'] },
  { name: 'its-fine', use: 'React helpers', copyright: 'Copyright (c) 2022-2025 Poimandres', licence: 'MIT', packages: ['its-fine'] },
  { name: 'react-use-measure', use: 'screen measuring', copyright: 'Copyright (c) 2019-2025 Poimandres', licence: 'MIT', packages: ['react-use-measure'] },
  { name: 'suspend-react', use: 'loading helpers', copyright: 'Copyright (c) 2021 Paul Henschel', licence: 'MIT', packages: ['suspend-react'] },
  { name: 'Zustand', use: 'game state', copyright: 'Copyright (c) 2019 Paul Henschel', licence: 'MIT', packages: ['zustand'] },
  // motion-utils' easing curve is adapted from bezier-easing (MIT), as its source says.
  { name: 'Motion', use: 'screen animation', copyright: 'Copyright (c) 2018 Framer B.V. Copyright (c) 2024 Motion B.V. Includes code adapted from bezier-easing, Copyright (c) 2014 Gaëtan Renaudeau.', licence: 'MIT', packages: ['motion', 'framer-motion', 'motion-dom', 'motion-utils'] },
  { name: 'fflate', use: 'unpacking data', copyright: 'Copyright (c) 2020 Arjun Barrett', licence: 'MIT', packages: ['fflate'] },
  { name: 'gainmap-js', use: 'image loading', copyright: 'Copyright (c) 2023 MONOGRID', licence: 'MIT', packages: ['@monogrid/gainmap-js'] },
  { name: 'Babel runtime helpers', use: 'JavaScript helpers', copyright: 'Copyright (c) 2014-present Sebastian McKenzie and other contributors', licence: 'MIT', packages: ['@babel/runtime'] },
  // Tailwind's style reset is written into the built stylesheet by its plugin, so the bundle check cannot see it.
  { name: 'Tailwind CSS', use: 'style reset', copyright: 'Copyright (c) Tailwind Labs, Inc.', licence: 'MIT', packages: ['tailwindcss'] },
  { name: 'Fredoka (font)', use: 'titles and buttons', copyright: 'Copyright 2016 The Fredoka Project Authors (https://github.com/hafontia/Fredoka-One)', licence: 'OFL-1.1', packages: ['@fontsource/fredoka'] },
  { name: 'Nunito (font)', use: 'text', copyright: 'Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito)', licence: 'OFL-1.1', packages: ['@fontsource/nunito'] },
  // The native shell (apps/mobile): linked into the iPhone and iPad app. Its JavaScript (@capacitor/core) and the
  // two plugins' are in the app build's bundle too, where the build check finds them; the website has none of them.
  { name: 'Capacitor', use: 'the iPhone and iPad app shell', copyright: 'Copyright (c) 2017-present Drifty Co.', licence: 'MIT', packages: ['@capacitor/ios', '@capacitor/core'] },
  { name: 'Capacitor Haptics', use: 'the tap response in the iPhone and iPad app', copyright: 'Copyright 2020-present Ionic (https://ionic.io)', licence: 'MIT', packages: ['@capacitor/haptics'] },
  { name: 'Capacitor Preferences', use: 'the second copy of your stars and settings in the iPhone and iPad app', copyright: 'Copyright 2020-present Ionic (https://ionic.io)', licence: 'MIT', packages: ['@capacitor/preferences'] },
  { name: 'Apache Cordova (inside Capacitor)', use: 'the iPhone and iPad app shell', copyright: 'Copyright The Apache Software Foundation', licence: 'Apache-2.0', packages: [] },
  // gainmap-js says in its source that its metadata reader is based on libultrahdr.
  { name: 'libultrahdr (basis of parts of gainmap-js)', use: 'image loading', copyright: 'Copyright The Android Open Source Project', licence: 'Apache-2.0', packages: [] },
];

/** The licences in use, in the order the screen shows their texts. */
export const LICENCES_IN_USE: LicenceId[] = ['MIT', 'Zlib', 'OFL-1.1', 'Apache-2.0', 'CC0-1.0'];

/** The npm package that a module path belongs to, or null for the game's own code. */
export function packageOf(modulePath: string): string | null {
  const clean = modulePath.replace(/\\/g, '/').replace(/^\0/, '');
  const at = clean.lastIndexOf('/node_modules/');
  if (at < 0) return null;
  const [a, b] = clean.slice(at + '/node_modules/'.length).split('/');
  return a.startsWith('@') ? `${a}/${b}` : a;
}

/** Shipped packages that no notice answers for. Empty when the list is complete. */
export function missingNotices(shipped: Iterable<string>, notices: Notice[] = NOTICES): string[] {
  const covered = new Set(notices.flatMap((n) => n.packages));
  return [...new Set(shipped)].filter((p) => !covered.has(p)).sort();
}
