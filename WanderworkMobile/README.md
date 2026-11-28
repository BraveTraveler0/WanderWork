# WanderWork Mobile

Capacitor-wrapped native shell for the WanderWork web app. This is a separate
echo of the root [`src/`](../src) project — the live web app at wanderwork.io
is untouched. Pull changes over manually as the two diverge; there's no shared
build step between them.

## Structure

- `src/`, `index.html`, `vite.config.ts`, etc. — copied from the root app.
- `Landing/src/assets/` — Figma asset files the `figma:asset/` resolver in
  `vite.config.ts` needs (copied from the root `Landing/` folder).
- `android/`, `ios/` — native Capacitor projects. Committed to git (this is
  Capacitor's recommended practice), with build output/Pods/Gradle caches
  gitignored inside each.
- `capacitor.config.ts` — app id `io.wanderwork.app`, plugin config.
- `src/native.ts` — all native-platform glue (status bar, splash screen,
  Android back button, deep links, native Google sign-in).

## Building

```
npm install
npm run build        # tsc + vite build -> dist/
npm run cap:android   # build, sync, open Android Studio
npm run cap:ios       # build, sync, open Xcode (requires a Mac)
```

iOS can only be built/run on a Mac (Xcode + CocoaPods). Android can be built
on Windows once Android Studio/SDK is installed.

## App icon & splash screen

`resources/icon-source.png` is the WanderWork enso mark, extracted from the
web app's `public/favicon.svg` (which embeds it as a base64 PNG). Run
`node resources/build-icons.cjs` to recomposite `icon.png` /
`icon-background.png` / `icon-foreground.png` / `splash.png` if the brand
background color or padding ever changes, then regenerate everything with:

```
npx capacitor-assets generate
npx cap sync
```

## Native Google sign-in — setup required

The web app's Google login (`@react-oauth/google`, popup-based) doesn't work
inside a native WebView — Google blocks OAuth from embedded user agents. On
native platforms this app instead opens the system browser and does a PKCE
authorization-code flow, redirecting back via the `io.wanderwork.app://`
custom URL scheme (already registered in both `AndroidManifest.xml` and
`Info.plist`).

This requires **new OAuth client IDs** in Google Cloud Console — the existing
`VITE_GOOGLE_CLIENT_ID` ("Web application" type) can't be used because Google
only allows custom-scheme redirects for the iOS/Android client types:

1. In [Google Cloud Console](https://console.cloud.google.com) → APIs &
   Services → Credentials, create:
   - An **iOS** OAuth client with bundle ID `io.wanderwork.app`.
   - An **Android** OAuth client with package name `io.wanderwork.app` and
     the SHA-1 fingerprint of your signing key (debug key while testing,
     release key before shipping).
2. Set these as build-time env vars for this project (`.env.local`, not
   committed):
   ```
   VITE_GOOGLE_IOS_CLIENT_ID=xxxxx.apps.googleusercontent.com
   VITE_GOOGLE_ANDROID_CLIENT_ID=xxxxx.apps.googleusercontent.com
   ```
3. On the backend (Render dashboard env vars), add:
   ```
   GOOGLE_IOS_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_ANDROID_CLIENT_ID=xxxxx.apps.googleusercontent.com
   ```
   `server/routes/oauthRoutes.js` accepts all three client IDs (web + iOS +
   Android) as valid token audiences — the existing web flow is unaffected
   whether or not these are set.

Until those env vars exist, tapping "Continue with Google" on a native build
shows "Google sign-in isn't set up for this app build yet" instead of
crashing.

LinkedIn sign-in needs no new setup — it already redirects through the
backend, which now returns to the mobile deep link instead of the website
when the request originated from `openOAuthInSystemBrowser()`.

## Native in-app purchases — setup required

Apple/Google require App Store In-App Purchase / Google Play Billing for
digital subscriptions and consumables bought inside the app — the web app's
Stripe checkout can't be shown on native builds. This uses
[RevenueCat](https://www.revenuecat.com) (free up to $2.5k/mo tracked
revenue) so we don't have to implement Apple's App Store Server API or
Google's Play Developer API receipt validation ourselves — RevenueCat
validates receipts and calls our webhook instead.

**Product catalog** (must be created identically in all three places —
product IDs are matched literally, there's no fuzzy lookup):

| Product ID                    | Type                    | Grants          |
|--------------------------------|-------------------------|-----------------|
| `wanderwork_pro_monthly`       | Auto-renewing subscription | `plan = 'pro'` ($19/mo to match web) |
| `wanderwork_premium_monthly`   | Auto-renewing subscription | `plan = 'premium'` ($49/mo to match web) |
| `wanderwork_tokens_10`         | Consumable / non-renewing  | +10 tokens |
| `wanderwork_tokens_30`         | Consumable / non-renewing  | +30 tokens |
| `wanderwork_tokens_100`        | Consumable / non-renewing  | +100 tokens |

The token packs are **fixed price/quantity** — unlike the web app's +/-
stepper (any quantity at 3 tokens/$1 via Stripe's dynamic pricing), Apple/
Google IAP only sells pre-registered products, so native purchases show
this fixed list instead (see `NativeTokenPackModal` in `PlansPage.tsx`,
reused by `StatsPanel.tsx`'s token modal). Adjust the exact pack
sizes/prices in `src/native-iap.ts`'s `TOKEN_PACK_PRODUCTS` and this table
together — they must stay in sync with whatever you actually register.

**Setup steps:**

1. Create the 5 products above in **App Store Connect** (once the Apple
   Developer Program + app record exist) and in **Play Console** (once the
   app record exists there). Exact IDs, matching the table.
2. Create a free [RevenueCat](https://app.revenuecat.com) account, add the
   iOS and Android apps, and connect each to the matching store product
   catalog (RevenueCat's dashboard walks through linking App Store
   Connect / Play Console).
3. Create a RevenueCat **Offering** containing all 5 products as packages.
4. Grab the iOS and Android **public API keys** from RevenueCat → Project
   Settings → API Keys, and set as build-time env vars (`.env.local`, not
   committed):
   ```
   VITE_REVENUECAT_IOS_API_KEY=appl_xxxxx
   VITE_REVENUECAT_ANDROID_API_KEY=goog_xxxxx
   ```
5. In RevenueCat → Project Settings → Webhooks, add a webhook pointing at
   `https://wanderwork-backend-server.onrender.com/revenuecat/webhook`,
   with an **Authorization header value** you choose yourself (any random
   string works — RevenueCat just echoes it back verbatim on every call,
   this isn't a signed/HMAC secret). Set the same value on the backend
   (Render dashboard env vars):
   ```
   REVENUECAT_WEBHOOK_SECRET=<same random string as step 5>
   ```

Until the API keys exist, `configureIAP()` in `src/native.ts` no-ops and
purchase attempts fail with "isn't set up in RevenueCat yet" rather than
crashing.

**Android build note:** the RevenueCat plugin's `android/build.gradle`
pins `kotlin-gradle-plugin:1.8.20`, which doesn't recognize JVM target 21.
Build with a JDK 17 `JAVA_HOME` (not Android Studio's bundled JBR, which is
JDK 21) or the Kotlin compile step fails with "Unknown Kotlin JVM target: 21".

## Sign in with Apple — setup required

The App Store requires Sign in with Apple because the app also offers Google and
LinkedIn. The iPhone app shows "Continue with Apple" first on the sign-in and
sign-up screens (`src/components/AppleAuthButton.tsx`); the server verifies it at
`POST /oauth/apple` (`server/utils/appleSignIn.js`).

1. Apple Developer → Certificates, Identifiers & Profiles → Identifiers →
   `io.wanderwork.app` → turn on **Sign in with Apple**. (The app already has
   the entitlement in `ios/App/App/App.entitlements`.)
2. Keys → create a key with **Sign in with Apple** enabled, download the `.p8`.
3. On Render, add `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (the
   `.p8` file's contents). Sign-in works without these; they're needed so that
   deleting an account also revokes the person's Apple sign-in, which Apple
   requires.

## Building for the App Store without a Mac

iOS apps can only be built on a Mac, so `codemagic.yaml` (repo root) builds on
Codemagic's Macs and uploads to TestFlight. One-time setup:

1. Apple Developer Program membership ($99/year) and an app record in
   App Store Connect with bundle ID `io.wanderwork.app`.
2. App Store Connect → Users and Access → Integrations → App Store Connect API
   → create a key with **App Manager** access; download the `.p8`.
3. Sign up at codemagic.io with GitHub and add the WanderWork repo.
4. Codemagic → Team settings → Integrations → Developer Portal → add the key
   from step 2, named exactly **WanderWork App Store Connect**.
5. Codemagic → the app → Environment variables → group `wanderwork_ios`:
   `VITE_REVENUECAT_IOS_API_KEY` (from RevenueCat), and optionally
   `VITE_GOOGLE_IOS_CLIENT_ID` (the Google button stays hidden without it).
6. Put the app's numeric Apple ID (App Store Connect → App Information) in
   `APP_STORE_APPLE_ID` in `codemagic.yaml`.
7. Start the **WanderWork iOS to TestFlight** workflow. When it finishes,
   install TestFlight on an iPhone or iPad and test the build there.

## App Store submission checklist

Done in the project:
- iPhone only (`TARGETED_DEVICE_FAMILY = 1`), arm64.
- Privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`). Answer App Privacy in
  App Store Connect to match it: email, name, user ID, purchases, user content
  (resume and job preferences), all linked to the person and used for app
  functionality; page views for analytics, not linked; no tracking.
- `ITSAppUsesNonExemptEncryption = false` (HTTPS only), so no export questions
  on each upload.
- Sign in with Apple; Google is hidden until configured.
- In-app account deletion (Settings), which also revokes Apple sign-in.
- Purchases only through Apple (RevenueCat), Restore Purchases, and the
  subscription terms with Terms of Use and Privacy Policy links on the Plans
  screen.

Needed from you in App Store Connect:
- Subscriptions and token packs created with the product IDs in
  `src/native-iap.ts`, and RevenueCat set up (see above). Apple tests a real
  purchase in the sandbox, so this has to work before review.
- A demo account (email and password) with some job matches, in App Review
  Information, so the reviewer can get past sign-in.
- Privacy Policy URL https://www.wanderwork.io/privacy and a support URL.
- Terms of Use: add https://www.wanderwork.io/terms to the description (or use
  Apple's standard EULA) since the app sells subscriptions.
- iPhone screenshots: 6.9" (1320 × 2868) at minimum.
- Age rating questionnaire, category (Business), description, keywords.

## Still to do

- Deeper mobile UI pass (offline/error states)
- Secure token storage (currently `localStorage`, same as web)
- Push notifications (optional, but strengthens the App Store "not a
  repackaged website" case)
- Store listing assets (screenshots, descriptions, keywords, ratings)
