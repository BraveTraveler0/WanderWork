// Per-account recruiter-contact caps that bypass the standard plan tiers
// (PLAN_MAX / PLAN_MAX_CONTACTS). Every entry here is a one-off exception
// granted to a specific account, not a change to what any plan offers.
const RECRUITER_CONTACTS_MAX_OVERRIDES = {
  'darrienccarter@gmail.com': 999,
  'sephrim07@gmail.com': 100,
}

function getRecruiterContactsMaxOverride(email) {
  if (!email) return null
  return RECRUITER_CONTACTS_MAX_OVERRIDES[String(email).toLowerCase().trim()] ?? null
}

module.exports = { getRecruiterContactsMaxOverride }
