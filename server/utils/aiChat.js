// Shared chat-completion client with two routes:
// - default (aiChat): OpenAI first, Nemotron on OpenRouter as a backup when
//   OpenAI is out of credits, rate-limited, down, or has no key. For
//   user-facing work (resumes, cover letters, recruiter emails).
// - prefer: 'cheap' (aiChatCheap): free/cheap Nemotron first, OpenAI only if
//   those fail. For background/bulk work (cleanup, region labels, lookups).
//
// chatCompletion(body) takes an OpenAI chat.completions body and returns the
// OpenAI-shaped response data ({ choices: [{ message: { content } }] }).
// `aiChat`/`aiChatCheap` mimic the OpenAI SDK (.chat.completions.create(body))
// so SDK call sites can swap their client without other changes.
//
// Env: OPENAI_API_KEY, OPENROUTER_API_KEY, OPENROUTER_BACKUP_MODELS
// (comma-separated, overrides the Nemotron rotation below).

const axios = require('axios')

// Backup when OpenAI fails (user-facing calls). Checked against OpenRouter's
// model list 2026-11: nemotron-3-super-120b-a12b no longer has a :free tier.
const NEMOTRON_ROTATION = [
    'nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3.5-super-vl',
]

// Background work (description cleanup, region labels, company lookups,
// Capital Watch) runs on free Nemotron first, then the cheapest paid Nemotron
// (about half of gpt-4o-mini's price), and OpenAI only if all of those fail.
const BACKGROUND_ROTATION = [
    'nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-super-120b-a12b',
]

// A model that answers 429 (rate limited) is skipped for a minute, so a busy
// batch doesn't pay a failed round trip on every call.
const COOLDOWN_MS = 60 * 1000
const cooldownUntil = new Map()
const coolingDown = (model) => (cooldownUntil.get(model) || 0) > Date.now()

const backupModels = () => (process.env.OPENROUTER_BACKUP_MODELS || NEMOTRON_ROTATION.join(','))
    .split(',').map((m) => m.trim()).filter(Boolean)

const describeError = (e) => {
    const apiError = e.response?.data?.error
    return [e.response?.status, apiError?.code || apiError?.type, apiError?.message || e.message]
        .filter(Boolean).join(' ')
}

// Nemotron can emit reasoning in <think> tags or wrap JSON in code fences.
function cleanContent(content, wantsJson) {
    if (typeof content !== 'string') return content
    let text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    if (wantsJson) {
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
        if (fenced) text = fenced[1].trim()
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')
        if (start !== -1 && end > start) text = text.slice(start, end + 1)
    }
    return text
}

async function callOpenAIDirect(body, timeout, signal) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout,
        signal,
    })
    return response.data
}

async function callOpenRouter(body, model, timeout, signal) {
    // Nemotron reasons by default, and the hidden reasoning counts against
    // max_tokens: tested 2026-11, a 200-token summary came back cut off
    // mid-sentence or empty. These tasks don't need it, so it's off (also
    // cheaper: reasoning tokens are billed).
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', { ...body, model, reasoning: { enabled: false } }, {
        headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://wanderwork.io',
            'X-Title': 'Wander/Work',
        },
        timeout,
        signal,
    })
    const data = response.data
    if (data?.error) throw Object.assign(new Error(data.error.message || 'OpenRouter error'), { response: { status: data.error.code, data } })
    const wantsJson = body.response_format?.type === 'json_object'
    for (const choice of data?.choices || []) {
        if (choice?.message) choice.message.content = cleanContent(choice.message.content, wantsJson)
    }
    if (!data?.choices?.[0]?.message?.content) throw new Error(`OpenRouter ${model} returned no content`)
    // Hit the token limit: the text is cut off. Never save a truncated
    // summary or document; let the next model (or OpenAI) answer instead.
    if (data.choices[0].finish_reason === 'length') throw new Error(`OpenRouter ${model} output was truncated`)
    return data
}

async function tryOpenRouter(body, models, backupTimeout, signal, { quiet = false } = {}) {
    let lastErr = null
    for (const model of models) {
        if (signal?.aborted) break
        if (coolingDown(model)) continue
        try {
            const data = await callOpenRouter(body, model, backupTimeout, signal)
            if (!quiet) console.log(`[aiChat] answered by OpenRouter ${model}`)
            return { data }
        } catch (e) {
            lastErr = e
            if (e.response?.status === 429) cooldownUntil.set(model, Date.now() + COOLDOWN_MS)
            if (!quiet) console.warn(`[aiChat] OpenRouter ${model} failed (${describeError(e)})`)
        }
    }
    return { err: lastErr }
}

// prefer: 'openai' (default; user-facing quality) tries OpenAI then Nemotron.
// prefer: 'cheap' (background/bulk work) tries Nemotron then OpenAI.
async function chatCompletion(body, { timeout = 30000, backupTimeout = 90000, signal, prefer = 'openai' } = {}) {
    let lastErr = null
    const hasRouter = !!process.env.OPENROUTER_API_KEY

    if (prefer === 'cheap' && hasRouter) {
        const r = await tryOpenRouter(body, BACKGROUND_ROTATION, backupTimeout, signal, { quiet: true })
        if (r.data) return r.data
        lastErr = r.err
    }

    if (process.env.OPENAI_API_KEY && !signal?.aborted) {
        try {
            return await callOpenAIDirect(body, timeout, signal)
        } catch (e) {
            lastErr = e
            console.warn(`[aiChat] OpenAI failed (${describeError(e)})${prefer === 'cheap' ? '' : '; trying OpenRouter backup'}`)
        }
    }

    if (prefer !== 'cheap' && hasRouter) {
        const r = await tryOpenRouter(body, backupModels(), backupTimeout, signal)
        if (r.data) return r.data
        lastErr = r.err || lastErr
    }

    throw lastErr || new Error('No AI provider configured (set OPENAI_API_KEY or OPENROUTER_API_KEY)')
}

const hasAIProvider = () => !!(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY)

// Mirrors the OpenAI SDK's create(body, { timeout, signal }).
const makeClient = (prefer) => ({
    chat: {
        completions: {
            create: (body, opts = {}) => chatCompletion(body, {
                ...(opts.timeout ? { timeout: opts.timeout, backupTimeout: Math.max(opts.timeout, 90000) } : {}),
                signal: opts.signal,
                prefer,
            }),
        },
    },
})
const aiChat = makeClient('openai')
// Same interface, Nemotron first. For scheduled/bulk jobs, not user requests.
const aiChatCheap = makeClient('cheap')

module.exports = { chatCompletion, hasAIProvider, aiChat, aiChatCheap, NEMOTRON_ROTATION, BACKGROUND_ROTATION }
