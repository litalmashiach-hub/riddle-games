# From joining Apple's program to Submit for Review

These are your steps, in order, to put the game on the App Store. Each one is marked:

- **Only you**: it needs your own Apple account, your money, your signature or your word to Apple. The team can't take it.
- **The team**: tell the mission when you get there, in the "Ask or tell" box, and the team does it.

Apple's own pages and buttons change their names now and then. Where I write a button's name, it is how I know it, and I haven't seen your account. If a name differs, look for the nearest one. Nothing here asks you to give anyone a password or a key: the key goes only into GitHub's own settings page, by your hand.

The files named here (listing, rating, privacy policy and so on) are in the project's files, in the launch folder.

## Before you start: the name

**Only you.** Choose the store name (the working name is Riddlebrook; launch/names.md has the candidates), and give the mission the contact email and the publisher name (how-to/store-name-contact-publisher.md).

The name decides the **bundle identifier**, the app's permanent ID, such as `com.yourname.riddlebrook`. It can never change once a build is uploaded, so it is chosen once, from the name. Use a reverse domain you control, or `com.` and your own name, then the store name in small letters with no spaces.

**The team** then puts the name, the identifier, the email and the publisher name into the app and the store texts, and finishes the About screen. The upload workflow refuses to build for the store until they are in.

## 1. Join the Apple Developer Program

**Only you** (it costs 99 USD a year, and you accept Apple's terms).

1. Go to developer.apple.com, choose Account, sign in with your Apple Account (it needs two-factor authentication), and choose Enroll.
2. Enrol as an individual, unless you want a company name on the store (then as an organisation, which needs a D-U-N-S number). As an individual, the store shows your legal name as the seller.
3. Pay, and wait for Apple's email that the membership is active. It can take from minutes to a couple of days.

**It worked when** developer.apple.com, Account, shows "Membership details" with a Team ID.

## 2. Agreements and the EU trader question

**Only you** (legal).

1. Go to appstoreconnect.apple.com, sign in, and open Business (sometimes "Agreements, Tax, and Banking").
2. Accept the Apple Developer Program License Agreement. For a free app that is the only agreement needed; no bank or tax forms.
3. Answer the trader status question for the EU's Digital Services Act when App Store Connect asks for it (launch/checklist.md, item 1.7).

## 3. Register the bundle identifier

**Only you.**

1. On developer.apple.com, Account, open Certificates, Identifiers & Profiles, then Identifiers, and press the plus.
2. Choose App IDs, then App, then Continue.
3. Description: the store name. Bundle ID: Explicit, and type the identifier you chose above, exactly.
4. Tick no capabilities (the game needs none). Continue, Register.

## 4. Create the app's record

**Only you.**

1. In App Store Connect, open Apps, press the plus, then New App.
2. Platforms: iOS. Name: the store name. Primary language: English (U.S.). Bundle ID: pick the one you just registered. SKU: any short label of your own, such as `riddlebrook-ios`. User access: Full Access.
3. Create.

**It worked when** the app shows in Apps with a "1.0 Prepare for Submission" version.

## 5. Find your Team ID

On developer.apple.com, Account, Membership details: copy the Team ID, 10 letters and digits. It is not secret.

## 6. Make an App Store Connect API key

**Only you.** This key lets GitHub's Mac upload the build to App Store Connect, without your password. It only uploads: signing uses your own certificate (step 8).

1. In App Store Connect, open Users and Access, then the Integrations tab, then App Store Connect API, Team Keys. The first time, you may have to press "Request Access" and agree; only the account holder can.
2. Press Generate API Key (or the plus). Name: `GitHub TestFlight`.
3. Access: **Developer**. Apple's page on uploading builds lists Account Holder, Admin, App Manager or Developer as the roles that can upload, so Developer is the smallest that can. The workflow no longer asks the key to make certificates or profiles, so it needs no Admin. If a run ever fails at "Upload to TestFlight" with a message about permissions, make a new key with App Manager and replace the three key secrets.
4. Press Generate. Download the key file (`AuthKey_` and the Key ID, ending in `.p8`). **Apple lets you download it only once.**
5. Note the Key ID (beside the key) and the Issuer ID (above the list).

You can revoke the key at any time on the same page; the workflow then stops working until you add a new one.

## 7. Merge the two workflow pull requests

**Only you**, since changes to the repository's workflows are yours to merge. They are "Build the iOS app for the simulator on a macOS runner" (pull request 43) and "TestFlight upload: build the signed store version and send it to Apple" (pull request 73). A second role of the team looks at each before you do. After this, the script of step 8 is on main.

## 8. Make your signing certificate and profile, without a Mac

**Only you** (it is your team's certificate, and its key is yours alone). You do this once; every run then signs with the same files, on whatever Mac GitHub gives it. It takes about 15 minutes.

You need a terminal with openssl. Either:

- **A codespace on GitHub, in the browser** (any computer): on github.com/litalmashiach-hub/riddle-games press Code, the Codespaces tab, then "Create codespace on main". A terminal opens at the bottom. As far as I know this fits in the free monthly allowance of a personal GitHub account; a codespace used for half an hour takes a small part of it.
- **Or Git Bash on Windows** (it comes with Git for Windows), or a terminal on Linux, in a copy of this repository.

Then:

1. In the terminal, run `bash apps/mobile/scripts/make-signing-files.sh request`. It makes a folder `apple-signing` with your private key (`distribution.key`) and a request to Apple (`distribution.csr`). The repository ignores that folder, so it is never committed. Nothing is sent anywhere.
2. Get `distribution.csr` onto your own computer: in a codespace, find `apple-signing` in the file list on the left, right-click `distribution.csr`, Download.
3. On developer.apple.com, Account, Certificates, Identifiers & Profiles, open **Certificates** and press the plus. Choose **Apple Distribution**, Continue, choose the file `distribution.csr`, Continue, then **Download**. You get a `.cer` file.
4. Open **Profiles** and press the plus. Under Distribution, choose **App Store Connect**, Continue. App ID: the identifier from step 3. Certificate: the one you just made (its date is today). Name it, for example `Riddlebrook App Store`. Generate, then **Download**. You get a `.mobileprovision` file.
5. Put both files into the `apple-signing` folder (in a codespace, drag them onto the folder in the file list).
6. Run `bash apps/mobile/scripts/make-signing-files.sh finish apple-signing/<the .cer file> apple-signing/<the .mobileprovision file>`, with the two files' names. It checks that the certificate is made from your key, and that the profile is an App Store profile for that certificate, and says plainly what is wrong if not. Then it writes three text files into `apple-signing`, one per secret of step 9.
7. Keep `distribution.p12` and `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD.txt` from that folder somewhere safe of your own, such as a password manager (in a codespace: right-click, Download).

The certificate lasts a year, and the profile as long as the certificate. When Apple says one has expired, or a run stops saying so, do this step again. Apple allows only a few distribution certificates per team, so revoke an old one you no longer use on the same page.

## 9. Put the key, the certificate and the IDs into GitHub

**Only you.** No one in the team sees these values, now or later.

1. Open github.com/litalmashiach-hub/riddle-games, then Settings, then Secrets and variables, then Actions.
2. On the **Secrets** tab, press New repository secret six times:
   - `APP_STORE_CONNECT_KEY_ID`: the Key ID.
   - `APP_STORE_CONNECT_ISSUER_ID`: the Issuer ID.
   - `APP_STORE_CONNECT_KEY`: open the `.p8` file in a text editor and paste all of it, from the BEGIN line to the END line.
   - `APPLE_DISTRIBUTION_CERTIFICATE`: all of `APPLE_DISTRIBUTION_CERTIFICATE.txt` from step 8.
   - `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD`: all of `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD.txt`.
   - `APPSTORE_PROVISIONING_PROFILE`: all of `APPSTORE_PROVISIONING_PROFILE.txt`.
3. On the **Variables** tab, press New repository variable twice:
   - `APPLE_TEAM_ID`: the Team ID.
   - `APP_BUNDLE_ID`: the bundle identifier, exactly as registered.
4. Keep the `.p8` file somewhere safe of your own, such as a password manager, or delete it: GitHub keeps its copy hidden, and you can always make a new key.
5. Delete the `apple-signing` folder. If you used a codespace, delete the whole codespace: github.com, your picture, Your codespaces, the three dots beside it, Delete.

## 10. Run the upload

**Only you** press the button (it signs with your certificate and sends a build to Apple).

Before you press it:

- The About screen's contact email, publisher name and policy date must be on main (the team does this once you have given them, "Before you start"). Without them the run stops at "Test the game".
- **The encryption declaration.** Every build says to Apple that the app uses no non-exempt encryption, so uploading it is that declaration. It is true of the game today: it makes no network calls and encrypts nothing. Confirm it to yourself now; step 14 only repeats it.
- To try your files first, you can run it once with "Check mode" ticked: it imports your certificate, checks your profile against the team, the identifier and the certificate, and stops before signing, sending nothing to Apple.

1. On the repository's page, open Actions, then "TestFlight upload" on the left, then Run workflow.
2. Branch: main. Leave "Check mode" unticked. Press Run workflow.
3. It takes about 20 to 40 minutes.

**It worked when** the run is green and its summary says "Uploaded to App Store Connect" with a build number. If it stops at its first step, the run lists exactly which secret or variable is missing or wrong; fix that and run again. If it stops at "Import your certificate and profile", it says which of the files of step 8 is wrong and how. If it fails later, tell the mission and the team reads the log.

Every run gets a new, higher build number, and signs the same way as the first, so you can run it again whenever the game changes and you want the new version on your phone.

## 11. Install it on your own iPhone with TestFlight

**Only you.**

1. In App Store Connect, open the app, then TestFlight. The build shows as "Processing" for a few minutes to an hour, then "Ready to Submit" or "Ready to Test".
2. The app asks no export-encryption question: the build already says it uses no encryption of its own (step 14).
3. Under Internal Testing, press the plus to make a group (for example "Me"), and add yourself.
4. On your iPhone, install Apple's TestFlight app from the App Store, open the invitation email on the phone, and press Install.

## 12. Play the levels the simulators couldn't finish

**Only you** (it needs your iPhone and, if you have one, an iPad). Follow how-to/play-levels-on-real-devices.md: levels 26 to 30 on the iPhone, and every level on an iPad. Then tell the mission what you played on and what you saw. **The team** fixes what you find, and writes the "devices tested" line of the note for Apple's reviewer from your words.

## 13. The store listing

**Only you** type it in; **the team** wrote every text, and fits it to the final build first.

1. In App Store Connect, open the app. On the 1.0 version page (Distribution tab), copy in from launch/listing.md: promotional text, description, keywords, support URL, version, copyright. Leave the marketing URL empty.
2. On the App Information page: subtitle, category (Games; Puzzle and Family), content rights (no third-party content).
3. On Pricing and Availability: Free, and the regions (launch/checklist.md, item 2.6).

The support page and the privacy policy must be public before you submit (launch/privacy-policy.md, Parts 1 and 3). Publishing them is your step: read them first.

## 14. The privacy answers, and the encryption answer

**Only you**, since they are your declarations to Apple.

1. App Privacy, then Get Started: answer "No, we do not collect data from this app", and save and publish. Enter the privacy policy's public address. Why it is true: launch/privacy-policy.md, Part 2.
2. Export encryption: the build already declares that the app uses no non-exempt encryption, so App Store Connect should not ask. If it does ask, answer that the app uses no encryption. It is true of the game today: it makes no network calls and encrypts nothing. Your upload in step 10 was that declaration, which that step asked you to confirm first.

## 15. The age rating

**Only you.** On App Information, Age Rating, Edit: answer each question as launch/rating.md says. It comes to 9+, because five levels end a loss in a cartoon fight cloud. Choosing 4+ instead needs the game changed first (rating.md says how).

## 16. Screenshots

**Only you** upload them; **the team** made them.

On the 1.0 version page, under Previews and Screenshots, drag in the iPhone 6.9-inch set and the iPad 13-inch set from launch/screenshots, in their numbered order. launch/screenshots.md says what each shows. If App Store Connect insists on a smaller iPhone size as well, tell the mission and the team makes that set.

## 17. Notes for Apple's reviewer

**Only you.** On the 1.0 version page, under App Review Information: your name, email and phone for Apple, "Sign-in required" unticked, and the note from launch/review-notes.md.

## 18. Choose the build, and how it goes out

**Only you.**

1. On the 1.0 version page, under Build, press the plus and pick the build from step 10 that you played in step 12.
2. Under Version Release, choose "Manually release this version", so that nothing goes live until you press Release.

## 19. Submit for review

**Only you.** Press Add for Review, check the summary, then Submit for Review. Apple says most reviews take under 48 hours. If Apple asks questions or refuses, its message shows in App Store Connect; tell the mission, and the team answers or fixes it with you.
