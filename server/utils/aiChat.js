// Shared chat-completion client: OpenAI first, then Nemotron on OpenRouter
// as a backup when OpenAI is out of credits, rate-limited, down, or has no key.
//
// chatCompletion(body) takes an OpenAI chat.completions body and returns the
// OpenAI-shaped response data ({ choices: [{ message: { content } }] }).
// `aiChat` mimics the OpenAI SDK (aiChat.chat.completions.create(body)) so
// SDK call sites can swap their client without other changes.
//
// Env: OPENAI_API_KEY, OPENROUTER_API_KEY, OPENROUTER_BACKUP_MODELS
// (comma-separated, overrides the Nemotron rotation below).

const axios = require('axios')

const NEMOTRON_ROTATION = [
    'nvidia/nemotron-3.5-super-vl:free',
    'nvidia/nemotron-3.5-super-vl',
    'nvidia/nemotron-3-super-120b-a12b:free',
]

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
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', { ...body, model }, {
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
    return data
}

async function chatCompletion(body, { timeout = 30000, backupTimeout = 90000, signal } = {}) {
    let lastErr = null

    if (process.env.OPENAI_API_KEY) {
        try {
            return await callOpenAIDirect(body, timeout, signal)
        } catch (e) {
            lastErr = e
            console.warn(`[aiChat] OpenAI failed (${describeError(e)}); trying OpenRouter backup`)
        }
    }

    if (process.env.OPENROUTER_API_KEY) {
        for (const model of backupModels()) {
            if (signal?.aborted) break
            try {
                const data = await callOpenRouter(body, model, backupTimeout, signal)
                console.log(`[aiChat] answered by OpenRouter ${model}`)
                return data
            } catch (e) {
                lastErr = e
                console.warn(`[aiChat] OpenRouter ${model} failed (${describeError(e)})`)
            }
        }
    }

    throw lastErr || new Error('No AI provider configured (set OPENAI_API_KEY or OPENROUTER_API_KEY)')
}

const hasAIProvider = () => !!(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY)

// Mirrors the OpenAI SDK's create(body, { timeout, signal }).
const aiChat = {
    chat: {
        completions: {
            create: (body, opts = {}) => chatCompletion(body, {
                ...(opts.timeout ? { timeout: opts.timeout, backupTimeout: Math.max(opts.timeout, 90000) } : {}),
                signal: opts.signal,
            }),
        },
    },
}

module.exports = { chatCompletion, hasAIProvider, aiChat, NEMOTRON_ROTATION }
