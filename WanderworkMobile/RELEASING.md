# Releasing the WanderWork iPhone app

WanderWork is a Capacitor app (`io.wanderwork.app`), not an Expo app, so the
Aonverse `npm run release` (EAS) flow doesn't apply. It's built in Xcode on the
MacinCloud Mac (the same rented Mac used for Aonverse; the Remote Desktop files
are in `Aonverse/MacinCloud_NY486.zip`) and signed with the same Apple Developer
team as Aonverse. Codemagic (`codemagic.yaml` at the repo root) is a hands-off
backup, see the end.

## One-time setup

### App Store Connect (same Apple team as Aonverse)
1. Certificates, Identifiers & Profiles > Identifiers > **+** > App ID
   `io.wanderwork.app`, and tick **Sign in with Apple**.
2. App Store Connect > Apps > **+** > New App: name WanderWork, bundle ID
   `io.wanderwork.app`, SKU `wanderwork-ios`.
3. Subscriptions and in-app purchases, with these exact product IDs (they're in
   `src/native-iap.ts`):
   - Subscription group "WanderWork": `wanderwork_pro_monthly`,
     `wanderwork_premium_monthly`
   - Consumables: `wanderwork_tokens_10`, `wanderwork_tokens_30`,
     `wanderwork_tokens_100`
4. RevenueCat: add the iOS app, import the products, make one Offering with all
   five, and copy the iOS public API key (`appl_...`). Webhook and server
   settings are in `README.md` under "Native in-app purchases".

### Sign in with Apple key (for account deletion)
Keys > **+** > tick Sign in with Apple > download the `.p8`. On Render, set
`APPLE_TEAM_ID` (top right of the developer site), `APPLE_KEY_ID` and
`APPLE_PRIVATE_KEY` (the `.p8` file's contents).

### On the MacinCloud Mac (once)
```
git clone https://github.com/BraveTraveler0/WanderWork.git
cd WanderWork/WanderworkMobile
npm ci
```
Create `WanderworkMobile/.env.local` (never committed):
```
VITE_REVENUECAT_IOS_API_KEY=appl_xxxxx
# Optional, shows the Google button: an iOS OAuth client in Google Cloud
# VITE_GOOGLE_IOS_CLIENT_ID=xxxxx.apps.googleusercontent.com
```
In Xcode > Settings > Accounts, sign in with the Apple ID of the Aonverse team.

## Every release

On the MacinCloud Mac:
```
cd WanderWork && git pull
cd WanderworkMobile && npm ci
npm run cap:ios          # builds the app, copies it into iOS, installs pods, opens Xcode
```
In Xcode:
1. Select the **App** target > Signing & Capabilities: Team = the Aonverse
   team, "Automatically manage signing" on. Sign in with Apple should already
   be listed (from `App.entitlements`).
2. General: raise **Build** by one each upload (and **Version** for a new
   release, e.g. 1.0.1).
3. Device menu at the top: **Any iOS Device (arm64)**.
4. Product > **Archive**. When the Organizer opens: **Distribute App** >
   App Store Connect > Upload.
5. About 15 minutes later the build is in App Store Connect > TestFlight.
   Install TestFlight on your iPhone or iPad and test it, including a sandbox
   purchase and Restore Purchases.
6. App Store Connect > the version > pick the build > **Submit for Review**.

## Store listing

- **Name:** WanderWork
- **Subtitle:** Remote jobs you can take anywhere
- **Category:** Business (secondary: Productivity)
- **Promotional text:** Remote jobs checked for where you can actually work from, with help applying in seconds.
- **Description:**
  ```
  WanderWork finds remote jobs you can do from anywhere, and helps you land them.

  Every listing is checked for the details job boards bury: where you're allowed to work from, time zones, who can apply, and pay when it's shared. No more getting halfway through an application to find out it's US only.

  Tell WanderWork what you do and where you want to be, and it matches you with roles that fit. Open any job to see a clear summary, then apply on the company's own site.

  Stand out with tailored cover letters and recruiter outreach written from your profile, using tokens included with your account.

  Plans: WanderWork is free to start. Pro and Premium are monthly subscriptions that renew automatically until cancelled in your App Store account settings.

  Terms of Use: https://www.wanderwork.io/terms
  Privacy Policy: https://www.wanderwork.io/privacy
  ```
- **Keywords:** remote,jobs,remote work,digital nomad,work from anywhere,job search,careers,hiring,resume,cover letter
- **Support URL:** https://www.wanderwork.io/bug-report
- **Marketing URL:** https://www.wanderwork.io
- **Privacy Policy URL:** https://www.wanderwork.io/privacy
- **Screenshots:** iPhone 6.9" (1320 x 2868), at least 3: job feed, a job's
  details, profile or matches, plans.
- **Copyright:** 2026 Aon Technology (same as Aonverse, change if WanderWork is
  under another name).

### App Review Information
- **Review account:** make a normal WanderWork account for Apple (like the
  Aonverse one), fill in its profile so it has job matches, and put the email
  and password here. Keep the password out of the repo.
- **Notes:** "WanderWork is a remote job search app. Sign in with the review
  account, or with Sign in with Apple. Subscriptions and token packs use In-App
  Purchase; Restore Purchases is on the Plans screen. Jobs open on the
  employer's own website to apply. Accounts can be deleted in Settings."

### Age rating
No objectionable content, no user-to-user messaging, no unrestricted web
browsing in the app (job links open in Safari). Expect 4+.

### App Privacy (nutrition label)
Matches `ios/App/App/PrivacyInfo.xcprivacy`. Data linked to the user, used for
App Functionality: Contact Info (name, email), User Content (resume, job
preferences), Identifiers (user ID), Purchases. Usage Data (product
interaction) for Analytics, not linked. No tracking.

## Backup: Codemagic (no remote desktop)

If the MacinCloud Mac isn't available, `codemagic.yaml` builds on Codemagic's
Macs and uploads to TestFlight. Setup steps are in `README.md` under "Building
for the App Store without a Mac".
