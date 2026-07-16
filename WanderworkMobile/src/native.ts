import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNative = Capacitor.isNativePlatform()

/** Capacitor.getPlatform() narrowed to the two native targets this app ships. */
export function getNativePlatform(): 'ios' | 'android' {
  return Capacitor.getPlatform() as 'ios' | 'android'
}

export async function initNativeApp(): Promise<void> {
  if (!isNative) return

  try {
    await StatusBar.setStyle({ style: Style.Light })
    if (getNativePlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#F9FAFB' })
    }
  } catch {
    // status bar plugin unavailable on this platform/build
  }

  await SplashScreen.hide()
}

/**
 * Capacitor's WebView does NOT automatically route target="_blank" links or
 * window.open() to the system browser the way a real browser tab would —
 * by default they silently no-op. This is a single, centralized fix instead
 * of touching every apply-link/share-link/external-link call site in the
 * app individually: intercept both mechanisms once and hand them to
 * @capacitor/browser. Critically this covers job "Apply Now" links, which
 * would otherwise be silently broken (the single most important user
 * journey in the app) on native builds.
 */
export function interceptExternalLinks(): () => void {
  if (!isNative) return () => {}

  const originalOpen = window.open.bind(window)
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url) {
      Browser.open({ url: url.toString() }).catch(() => {})
      return null
    }
    return originalOpen(url, target, features)
  }) as typeof window.open

  const onClick = (e: MouseEvent) => {
    const anchor = (e.target as HTMLElement)?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null
    if (anchor?.href) {
      e.preventDefault()
      Browser.open({ url: anchor.href }).catch(() => {})
    }
  }
  document.addEventListener('click', onClick, true)

  return () => {
    document.removeEventListener('click', onClick, true)
    window.open = originalOpen
  }
}

/**
 * Wires the Android hardware/gesture back button to an app-supplied handler.
 * The handler owns the decision of what "back" means for the current screen
 * (close a modal, pop to dashboard, or exit the app) since there is no router.
 */
export function registerBackHandler(onBack: () => void): () => void {
  if (!isNative) return () => {}

  const listenerPromise = CapacitorApp.addListener('backButton', onBack)
  return () => {
    listenerPromise.then((listener) => listener.remove())
  }
}

export function exitApp(): void {
  if (isNative) CapacitorApp.exitApp()
}

const DEEP_LINK_REDIRECT_URI = 'io.wanderwork.app://oauth-callback'

// Native (iOS/Android) OAuth client IDs from Google Cloud Console. These are
// separate from VITE_GOOGLE_CLIENT_ID (the "Web application" client used by
// the browser build) because Google only allows a custom URL scheme redirect
// for the iOS/Android client types. Sign-in with Google is disabled on native
// until these are configured — see WanderworkMobile/README.md.
const GOOGLE_NATIVE_CLIENT_ID: Record<string, string | undefined> = {
  ios: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined,
  android: import.meta.env.VITE_GOOGLE_ANDROID_CLIENT_ID as string | undefined,
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64UrlEncode(new Uint8Array(digest))
  return { verifier, challenge }
}

let pendingGoogleAuth: { verifier: string; resolve: (idToken: string) => void; reject: (err: Error) => void } | null = null

/**
 * Starts Google sign-in via the system browser using the OAuth 2.0
 * authorization-code + PKCE flow for installed apps (no client secret
 * needed). Resolves with a Google ID token to hand to the existing
 * POST /oauth/google backend endpoint as `credential`.
 */
export async function signInWithGoogleNative(): Promise<string> {
  const platform = getNativePlatform()
  const clientId = GOOGLE_NATIVE_CLIENT_ID[platform]
  if (!clientId) {
    throw new Error('Google sign-in isn’t set up for this app build yet.')
  }

  const { verifier, challenge } = await createPkcePair()

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', DEEP_LINK_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  const idTokenPromise = new Promise<string>((resolve, reject) => {
    pendingGoogleAuth = { verifier, resolve, reject }
  })

  // If the user closes the system browser without completing sign-in (no
  // deep-link callback ever arrives), the promise would otherwise hang
  // forever and the caller's loading state would spin indefinitely.
  const finishedListener = await Browser.addListener('browserFinished', () => {
    if (pendingGoogleAuth) {
      const pending = pendingGoogleAuth
      pendingGoogleAuth = null
      const err: any = new Error('Sign-in cancelled')
      err.userCancelled = true
      pending.reject(err)
    }
  })

  try {
    await Browser.open({ url: authUrl.toString() })
    return await idTokenPromise
  } finally {
    finishedListener.remove()
  }
}

async function handleGoogleNativeCallback(code: string): Promise<void> {
  const pending = pendingGoogleAuth
  if (!pending) return
  pendingGoogleAuth = null
  Browser.close().catch(() => {})

  try {
    const platform = getNativePlatform()
    const clientId = GOOGLE_NATIVE_CLIENT_ID[platform] || ''
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: pending.verifier,
        grant_type: 'authorization_code',
        redirect_uri: DEEP_LINK_REDIRECT_URI,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.id_token) {
      throw new Error(data.error_description || 'Google sign-in failed')
    }
    pending.resolve(data.id_token)
  } catch (err) {
    pending.reject(err instanceof Error ? err : new Error('Google sign-in failed'))
  }
}

/**
 * Handles the io.wanderwork.app:// custom-scheme deep link that OAuth
 * callbacks (Google/LinkedIn) redirect to on native platforms.
 *
 * Two shapes come through here:
 *  - `?code=...`  -> mid-flight Google native sign-in, resolved locally via
 *                    handleGoogleNativeCallback and never touches app state.
 *  - `?token=&user=...` -> LinkedIn (or a completed Google exchange) already
 *                    has a session; hand it to a full in-app navigation and
 *                    let the existing App.tsx effect (which parses
 *                    window.location.search) log the user in.
 */
export function registerDeepLinkHandler(): () => void {
  if (!isNative) return () => {}

  const listenerPromise = CapacitorApp.addListener('appUrlOpen', (event) => {
    try {
      const url = new URL(event.url)
      const code = url.searchParams.get('code')
      if (code && pendingGoogleAuth) {
        handleGoogleNativeCallback(code)
        return
      }
      if (url.search) {
        window.location.href = `/${url.search}`
      }
    } catch {
      // malformed or unrelated deep link, ignore
    }
  })
  return () => {
    listenerPromise.then((listener) => listener.remove())
  }
}

/**
 * Opens a server-driven OAuth flow (LinkedIn) in the system browser, tagged
 * so the backend redirects back to the app's deep link instead of the website.
 */
export async function openOAuthInSystemBrowser(authUrl: string): Promise<void> {
  const url = new URL(authUrl)
  url.searchParams.set('platform', 'mobile')
  await Browser.open({ url: url.toString() })
}

/**
 * Starts the LinkedIn login redirect — system browser + deep-link tagging on
 * native, a plain navigation on web. Shared so LoginPage/SignupPage/
 * ParticleProfile don't each repeat the isNative branch themselves.
 */
export function startLinkedInAuth(linkedinUrl: string): void {
  if (isNative) {
    openOAuthInSystemBrowser(linkedinUrl)
    return
  }
  window.location.href = linkedinUrl
}
