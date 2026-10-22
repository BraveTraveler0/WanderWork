// Funnel events for the search-first landing page. Each step of the journey
// (view, search, open a job, ask to customize) goes to Google Analytics so the
// drop-off between landing and the sign_up event (signupTracking.ts) is visible.
// Searches and job views also go to the Meta pixel as standard events, which
// gives ad delivery a mid-funnel signal before the sign-up itself.
// Fire-and-forget: tracking can never break the page.

export type LandingEvent =
  | 'landing_view'
  | 'job_search'
  | 'job_filter'
  | 'job_view'
  | 'job_apply_click'
  | 'job_save_click'
  | 'show_more_gate'
  | 'customize_click'
  | 'landing_signup_click'
  | 'recruiter_click'

export function trackLandingEvent(name: LandingEvent, params: Record<string, unknown> = {}): void {
  try { window.gtag?.('event', name, { page_path: window.location.pathname, ...params }) } catch { /* ignore */ }
  try {
    if (name === 'job_search') window.fbq?.('track', 'Search', { search_string: params.search_term })
    else if (name === 'job_view') window.fbq?.('track', 'ViewContent', { content_ids: [params.job_id], content_type: 'job' })
    else if (name === 'customize_click') window.fbq?.('trackCustom', 'CustomizeApplicationClick', { job_id: params.job_id })
  } catch { /* ignore */ }
}
