const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const TIMEOUT_MS = 30_000
const FALLBACK_MESSAGE = 'Xin lỗi, tôi đang bận. Vui lòng thử lại.'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionParams {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
}

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = err instanceof ApiError ? err.status : 0
      const isRetryable = status === 429 || status >= 500
      if (isRetryable && attempt < MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export async function chatCompletion(
  params: ChatCompletionParams,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('[openrouter] OPENROUTER_API_KEY not set')
    return FALLBACK_MESSAGE
  }

  try {
    const result = await withRetry(async () => {
      const res = await fetchWithTimeout(
        OPENROUTER_API_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer':
              process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          },
          body: JSON.stringify({
            model: params.model,
            messages: params.messages,
            ...(params.max_tokens != null && { max_tokens: params.max_tokens }),
            ...(params.temperature != null && {
              temperature: params.temperature,
            }),
          }),
        },
        TIMEOUT_MS,
      )

      if (!res.ok) {
        throw new ApiError(`OpenRouter API error: ${res.status}`, res.status)
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content ?? ''
    })

    return result
  } catch (err) {
    console.error('[openrouter] chatCompletion failed:', err)
    return FALLBACK_MESSAGE
  }
}
