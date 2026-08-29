import { config } from '../config/env'

// This is the ONE file that knows the buyer agent talks to Gemini
// specifically. buyerAgent.ts only calls generateStructuredJSON() with a
// prompt and a JSON schema — swap this file out for OpenAI/Claude/whatever
// and nothing else in the agent needs to change.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface GenerateStructuredParams {
  systemInstruction?: string
  prompt: string
  // OpenAPI-subset JSON Schema — see https://ai.google.dev/gemini-api/docs/structured-output
  schema: Record<string, unknown>
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export async function generateStructuredJSON<T>(params: GenerateStructuredParams): Promise<T> {
  if (!config.llm.apiKey) {
    throw new Error('LLM_API_KEY is not set — add your Gemini API key to server/.env before running the buyer agent.')
  }

  const url = `${GEMINI_API_BASE}/${config.llm.model}:generateContent`

  const body = {
    ...(params.systemInstruction ? { systemInstruction: { parts: [{ text: params.systemInstruction }] } } : {}),
    contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: params.schema,
    },
  }

  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.llm.apiKey,
      },
      body: JSON.stringify(body),
    }),
    config.llm.requestTimeoutMs,
    'Gemini API call',
  )

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`Gemini API error ${res.status}: ${errorText.slice(0, 300)}`)
  }

  const data = (await res.json()) as GeminiGenerateContentResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (typeof text !== 'string') {
    throw new Error('Gemini response did not include the expected text content.')
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Gemini response was not valid JSON: ${text.slice(0, 300)}`)
  }
}
