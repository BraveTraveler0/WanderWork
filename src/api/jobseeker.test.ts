import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAllJobSeekerData, isUnauthorizedError } from './jobseeker.ts'

describe('jobseeker API errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves the HTTP status when the session is unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid or expired token' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      }),
    ))

    let caught: unknown
    try {
      await getAllJobSeekerData()
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({
      status: 401,
      message: 'Invalid or expired token',
    })
  })

  it('recognizes a status 401 error as an expired session', () => {
    expect(isUnauthorizedError({ status: 401 })).toBe(true)
    expect(isUnauthorizedError({ status: 500 })).toBe(false)
    expect(isUnauthorizedError(new Error('401 in message only'))).toBe(false)
  })
})
