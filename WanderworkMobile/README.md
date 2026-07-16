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

## Still to do

- Deeper mobile UI pass (bottom nav vs. sidebar, offline/error states)
- Secure token storage (currently `localStorage`, same as web)
- Native IAP for Plans/subscriptions (Apple/Google require this per the
  billing-model decision made for this project)
- Account deletion flow, privacy policy content, store listing assets
