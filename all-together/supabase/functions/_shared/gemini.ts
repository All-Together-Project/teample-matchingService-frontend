// Gemini Embedding API (gemini-embedding-001, 768 dim)
// docs: https://ai.google.dev/gemini-api/docs/embeddings

const MODEL = 'gemini-embedding-001'
const OUTPUT_DIM = 768
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`

export async function embedText(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  // 너무 긴 텍스트는 잘라냄
  const trimmed = text.slice(0, 8000)

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text: trimmed }] },
      taskType,
      outputDimensionality: OUTPUT_DIM,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${errBody}`)
  }

  const data = await res.json()
  const values: number[] | undefined = data?.embedding?.values
  if (!values || values.length === 0) {
    throw new Error('Gemini API returned empty embedding')
  }
  return values
}

// Gemini chat (JSON output) — 추천 이유 생성 등에 사용
export async function generateJSON<T = any>(
  prompt: string,
  options?: { temperature?: number; model?: string },
): Promise<T> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const model = options?.model ?? 'gemini-2.5-flash-lite'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: options?.temperature ?? 0.5,
      },
    }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Gemini chat ${res.status}: ${errBody.slice(0, 300)}`)
  }
  const data = await res.json()
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!jsonText) throw new Error('Gemini empty response')
  return JSON.parse(jsonText) as T
}
