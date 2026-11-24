# The About and settings screen

The cog on the level map opens it (`#/about`). It holds what Apple and the open-source licences ask to be inside
the app, and the player's own controls:

| Page | What is on it | Source |
| --- | --- | --- |
| Settings | Sound and HD graphics switches; Reset progress, with a confirm step | `apps/web/src/screens/AboutScreen.tsx` |
| Privacy | The privacy policy, as text | `apps/web/src/about/privacyPolicy.ts` |
| Contact | The contact address (the screen's one link out) | `apps/web/src/about/appInfo.ts` |
| Credits | Every open-source library and font that ships, and each licence in full | `apps/web/src/about/notices.ts`, `licenceTexts.ts` |

Everything is text inside the bundle. The screen reads no file and makes no network request.

## The one place for the name and the contact

`apps/web/src/about/appInfo.ts` holds the game's name, its version, the contact email, the publisher's name and the
privacy policy's date. The screen and the policy read them from there. (The name under the home-screen icon and the
bundle identifier are in `apps/mobile/ios/AppIdentity.xcconfig`; the title on the level map is still written in
`LevelMap.tsx`.)

The contact email, the publisher's name and the policy's date are **placeholders** (`null`) until the owner gives
them. Meanwhile the screen leaves those lines out.

## The release check

A store build must not ship with a placeholder. Build and test a release with `RELEASE=1`:

```sh
RELEASE=1 pnpm test        # fails, and names each placeholder that is left
RELEASE=1 pnpm ios:sync    # the build itself refuses, with the same list
```

Without `RELEASE=1` the same test passes and prints the list as a warning, and the build warns, so everyday work
and the repository's checks stay green. The check is `releaseBlockers()` in `appInfo.ts`; the test is
`appInfo.test.ts`; the build step is `apps/web/releaseChecks.ts`.

## The open-source notices

`notices.ts` lists each work with its copyright line and licence. Every build compares that list with the packages
that really end up in the built files (code that survived tree-shaking, stylesheets and fonts) and **fails, naming
the package, if one has no notice**. So after adding or updating a dependency: build, and add what the build names.

Three entries are not found by that comparison and are kept by hand: Tailwind CSS (its style reset is written into
the stylesheet), and Capacitor with its Cordova layer (linked into the iPhone and iPad app, not the website).

The licence texts in `licenceTexts.ts` are copied word for word from the licence files of the installed packages.

## Tests

`e2e/tests/about.spec.ts` (run with `pnpm test:e2e`): the screen opens from the map and leads back; every section
is there; nothing overflows at three sideways iPhone sizes, an upright phone and an iPad both ways up; reset clears
the stars after the confirm and not before, and leaves the settings; the switches work; no link out but the contact.
