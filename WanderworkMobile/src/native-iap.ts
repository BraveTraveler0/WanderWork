import { Purchases, LOG_LEVEL, type MakePurchaseResult, type CustomerInfo } from '@revenuecat/purchases-capacitor'
import { getNativePlatform, isNative } from './native'

// RevenueCat's dashboard maps these product IDs to the real App Store
// Connect / Play Console products — see WanderworkMobile/README.md for the
// exact catalog these must match. Token packs are fixed-price/fixed-quantity
// because Apple/Google IAP (unlike the web app's Stripe flow) can't sell an
// arbitrary token quantity at a dynamic price; only pre-registered products.
export const SUBSCRIPTION_PRODUCTS = {
  pro: 'wanderwork_pro_monthly',
  premium: 'wanderwork_premium_monthly',
} as const

export const TOKEN_PACK_PRODUCTS = [
  { id: 'wanderwork_tokens_10', tokens: 10, label: '10 Tokens' },
  { id: 'wanderwork_tokens_30', tokens: 30, label: '30 Tokens' },
  { id: 'wanderwork_tokens_100', tokens: 100, label: '100 Tokens' },
] as const

const REVENUECAT_API_KEY = {
  ios: import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined,
  android: import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined,
}

let configured = false

/** Call once at app startup (after the user's email is known, if logged in). */
export async function configureIAP(appUserId?: string): Promise<void> {
  if (!isNative) return
  const platform = getNativePlatform()
  const apiKey = REVENUECAT_API_KEY[platform]
  if (!apiKey) return // not configured yet — see README

  if (!configured) {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN })
    await Purchases.configure({ apiKey, appUserID: appUserId })
    configured = true
  } else if (appUserId) {
    await Purchases.logIn({ appUserID: appUserId })
  }
}

export async function iapAvailable(): Promise<boolean> {
  if (!isNative) return false
  const platform = getNativePlatform()
  return Boolean(REVENUECAT_API_KEY[platform])
}

/** Call on logout so the next login doesn't inherit the previous user's entitlements. */
export async function resetIAPUser(): Promise<void> {
  if (!isNative || !configured) return
  await Purchases.logOut().catch(() => {})
}

async function purchaseProduct(productId: string): Promise<MakePurchaseResult> {
  const offerings = await Purchases.getOfferings()
  const pkg = Object.values(offerings.all)
    .flatMap((offering) => offering.availablePackages)
    .find((p) => p.product.identifier === productId)

  if (!pkg) {
    throw new Error(`"${productId}" isn't set up in RevenueCat yet — check the dashboard offerings.`)
  }

  return Purchases.purchasePackage({ aPackage: pkg })
}

/** Buys a subscription tier; resolves once the store purchase sheet completes. */
export async function purchaseSubscription(plan: 'pro' | 'premium'): Promise<MakePurchaseResult> {
  return purchaseProduct(SUBSCRIPTION_PRODUCTS[plan])
}

/** Buys a fixed token pack (consumable, non-renewing). */
export async function purchaseTokenPack(productId: string): Promise<MakePurchaseResult> {
  return purchaseProduct(productId)
}

export async function restorePurchases(): Promise<{ customerInfo: CustomerInfo }> {
  return Purchases.restorePurchases()
}

/**
 * Wraps a native purchase/restore call with the error handling every call
 * site needs: swallow a user-initiated cancellation (RevenueCat sets
 * `userCancelled` on that error, and it isn't a failure worth surfacing),
 * otherwise report a message. Callers still own their own loading-state
 * setters since those vary per call site (a plan key vs. a product id).
 */
export async function withNativePurchase<T>(
  action: () => Promise<T>,
  onError: (message: string) => void | Promise<void>,
  fallbackMessage = 'Purchase failed. Please try again.'
): Promise<T | undefined> {
  try {
    return await action()
  } catch (err: any) {
    if (!err?.userCancelled) await onError(err?.message || fallbackMessage)
    return undefined
  }
}
