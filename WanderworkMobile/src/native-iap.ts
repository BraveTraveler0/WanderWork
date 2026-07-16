import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'
import { isNative } from './native'

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
export async function configureIAP(appUserId?: string) {
  if (!isNative) return
  const platform = Capacitor.getPlatform() as 'ios' | 'android'
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
  const platform = Capacitor.getPlatform() as 'ios' | 'android'
  return Boolean(REVENUECAT_API_KEY[platform])
}

/** Call on logout so the next login doesn't inherit the previous user's entitlements. */
export async function resetIAPUser() {
  if (!isNative || !configured) return
  await Purchases.logOut().catch(() => {})
}

async function purchaseProduct(productId: string) {
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
export async function purchaseSubscription(plan: 'pro' | 'premium') {
  return purchaseProduct(SUBSCRIPTION_PRODUCTS[plan])
}

/** Buys a fixed token pack (consumable, non-renewing). */
export async function purchaseTokenPack(productId: string) {
  return purchaseProduct(productId)
}

export async function restorePurchases() {
  return Purchases.restorePurchases()
}
