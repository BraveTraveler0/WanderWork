export const NEW_JOB_WINDOW_DAYS = 3
export const JOB_PURGE_DAYS = 90
export const MS_PER_DAY = 1000 * 60 * 60 * 24

export function getJobDate(job: any): Date | null {
  const raw = job?.postedAt || job?.rawDate || job?.datePosted || job?.date_posted || job?.preparedAt
  if (!raw) return null
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed
  if (typeof raw === 'string') {
    const withZ = new Date(`${raw}Z`)
    if (!Number.isNaN(withZ.getTime())) return withZ
  }
  if (!Number.isNaN(Number(raw))) {
    const asNum = new Date(Number(raw))
    if (!Number.isNaN(asNum.getTime())) return asNum
  }
  return null
}

export function isNewJob(job: any): boolean {
  const date = getJobDate(job)
  if (!date) return false
  const daysAgo = (Date.now() - date.getTime()) / MS_PER_DAY
  return daysAgo >= 0 && daysAgo <= NEW_JOB_WINDOW_DAYS
}
