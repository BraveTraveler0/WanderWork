// Funnel events for the search-first landing page. Each step of the journey
// (view, search, open a job, ask to customize) goes to Google Analytics so the
// drop-off between landing and the sign_up event (signupTracking.ts) is visible.
// Fire-and-forget: tracking can never break the page.

export type LandingEvent =
  | 'landing_view'
  | 'job_search'
  | 'job_filter'
  | 'job_view'
  | 'job_apply_click'
  | 'job_save_click'
  | 'customize_click'
  | 'landing_signup_click'

export function trackLandingEvent(name: LandingEvent, params: Record<string, unknown> = {}): void {
  try { window.gtag?.('event', name, { page_path: window.location.pathname, ...params }) } catch { /* ignore */ }
}
