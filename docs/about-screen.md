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

## Two builds, two screens

| | Website build (`pnpm build`) | App build (`pnpm build:app`) |
| --- | --- | --- |
| Pages | Settings, Credits | Settings, Privacy, Contact, Credits |
| Name shown | Riddle Games (`WEBSITE_NAME`) | the working name (`APP_NAME`) |

Every merge to main publishes the website build at once. The privacy policy and the contact line are not public
until the owner has read and published them, and the working name is not chosen yet, so the website build shows
none of the three, and **holds none of them in its built files**: no tab, no address and no pointer leads to the
two pages, and their text is not in `apps/web/dist` at all. The app needs both pages, since Apple asks for them.

`apps/web/src/about/shown.ts` is the one place that decides this. The two app-only pages live in
`apps/web/src/screens/AboutStorePages.tsx`, drawn behind `APP_SHELL`, so the bundler drops them from the website.
To put the pages on the website one day, change `shown.ts` and the `APP_SHELL &&` lines in `AboutScreen.tsx`; the
build check below will then need the same change, on purpose.

Every build checks itself (`apps/web/releaseChecks.ts`, with the words to look for in `APP_ONLY_WORDS` of
`appInfo.ts`): a website build that holds a sentence of the policy, the contact line or the working name fails,
and so does an app build that has lost one of them. The policy is searched for whole: `policyPhrases()` in
`privacyPolicy.ts` gives runs of words from every one of its sentences, so a sentence added there is covered at once.

The policy's wording is the launch policy's, word for word. The public page of the policy must say the same, and
what it says of the game (no connection, two saved things, what Reset progress removes and keeps, the Contact
page's email link) must stay true of the code: change the two together.

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

`RELEASE` unset, empty, `0` or `false` leaves the check off; any other value turns it on. Without it the same test passes and prints the list as a warning, and the build warns, so everyday work
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

`e2e/tests/about.spec.ts` (run with `pnpm test:e2e`, which builds both builds) runs against **both**: the
`iphone-*` projects open the website build and expect two pages and the website's name; the `app-iphone-*` projects
open the app build and expect all four pages and the working name. The level play-throughs run against the website
build only, as before. One test reads the built files of both builds for the policy, the contact line and the
working name. `apps/web/src/about/shown.test.ts` (in `pnpm test`) loads `shown.ts` in each build's mode.

What the tests cover: the screen opens from the map and leads back; every section of that build
is there; nothing overflows at three sideways iPhone sizes, an upright phone and an iPad both ways up; reset clears
the stars after the confirm and not before, and leaves the settings; the switches work; no link out but the contact; the confirm card is solid, and keeping the stars is its gold button.
