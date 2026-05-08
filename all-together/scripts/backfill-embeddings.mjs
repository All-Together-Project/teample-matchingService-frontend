// 기존 게시글들에 일괄 임베딩 생성
// 사용법:
//   1) .env 또는 환경변수에 다음 두 개 설정 (Project Settings → API에서 확인)
//      SUPABASE_URL=https://xxx.supabase.co
//      SUPABASE_SERVICE_ROLE_KEY=eyJhb...    ← 절대 클라이언트에 노출 X
//      GEMINI_API_KEY=AIza...
//   2) node scripts/backfill-embeddings.mjs
//
// 무료 티어 한도 (~15 req/min) 고려해서 1초 간격으로 호출

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY   = process.env.GEMINI_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
  console.error('환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const MODEL = 'gemini-embedding-001'
const OUTPUT_DIM = 768
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${GEMINI_KEY}`

async function embedText(text) {
  const trimmed = text.slice(0, 8000)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${MODEL}`,
      content: { parts: [{ text: trimmed }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: OUTPUT_DIM,
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.embedding.values
}

async function main() {
  console.log('임베딩 누락 게시글 조회...')
  const { data: posts, error } = await supabase
    .from('posts_missing_embedding')
    .select('id, title, content')
  if (error) throw error
  console.log(`대상 ${posts.length}개`)

  let ok = 0, fail = 0
  for (const [i, p] of posts.entries()) {
    const text = `${p.title}\n\n${p.content ?? ''}`.trim()
    try {
      const vector = await embedText(text)
      const { error: updErr } = await supabase
        .from('posts')
        .update({ embedding: vector })
        .eq('id', p.id)
      if (updErr) throw updErr
      ok++
      console.log(`[${i + 1}/${posts.length}] ✓ #${p.id} ${p.title.slice(0, 30)}`)
    } catch (e) {
      fail++
      console.error(`[${i + 1}/${posts.length}] ✗ #${p.id}`, e.message)
    }
    // free tier rate limit (~15 req/min) 고려
    await new Promise(r => setTimeout(r, 1100))
  }
  console.log(`\n완료 — 성공 ${ok} / 실패 ${fail}`)
}

main().catch(e => { console.error(e); process.exit(1) })
