// Gemini로 게시글의 sub_category + 태그(3~5개)를 재분류
// 옵션으로 사용자의 user_tags 도 재정립 (introduction + major 기반)
//
// 사용법:
//   1) 환경변수 (Project Settings → API)
//      SUPABASE_URL=https://xxx.supabase.co
//      SUPABASE_SERVICE_ROLE_KEY=eyJhb...        ← 절대 클라이언트 노출 X
//      GEMINI_API_KEY=AIza...
//   2) node scripts/retag-posts.mjs [옵션]
//      또는 node --env-file=.env.local scripts/retag-posts.mjs
//
// 옵션:
//   --dry-run             DB 변경 없이 결과만 출력
//   --target=posts|users|both    기본 posts
//   --limit=<N>           최대 처리 개수
//   --delay=<ms>          호출 간격, 기본 4500 (Gemini 무료 RPM ~15)
//   --reset               이전 진행 체크포인트 초기화 후 처음부터 다시
//
// 체크포인트: scripts/.retag-checkpoint.json 에 성공한 post/user ID 기록.
//             중단 후 같은 명령으로 재실행하면 처리 안 된 항목부터 자동 이어서 진행.
// 정책: 기존 tags 테이블의 태그만 사용. 신규 태그 생성 안 함.

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

// URL은 시크릿이 아니므로 프론트용 VITE_ 접두사 키도 fallback 허용.
// 키들은 절대 fallback 없음 — service_role 과 anon 을 헷갈리면 안 되므로.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY   = process.env.GEMINI_API_KEY

const missing = []
if (!SUPABASE_URL) missing.push('SUPABASE_URL (또는 VITE_SUPABASE_URL)')
if (!SERVICE_KEY)  missing.push('SUPABASE_SERVICE_ROLE_KEY  ← Supabase Dashboard → Project Settings → API → service_role')
if (!GEMINI_KEY)   missing.push('GEMINI_API_KEY  ← https://aistudio.google.com/app/apikey')
if (missing.length) {
  console.error('환경변수 누락:')
  for (const m of missing) console.error('  - ' + m)
  console.error('.env.local 에 위 키를 추가한 뒤 다시 실행하세요.')
  process.exit(1)
}

// CLI 옵션
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)
const DRY_RUN  = !!args['dry-run']
const TARGET   = (args.target ?? 'posts').toString()
const LIMIT    = args.limit ? Number(args.limit) : null
const DELAY_MS = args.delay ? Number(args.delay) : 4500
const RESET    = !!args.reset
const ABORT_AFTER_CONSECUTIVE_FAILS = Number(args['abort-after'] ?? 5)
const MODEL    = (args.model ?? 'gemini-2.5-flash-lite').toString()

// 연속 실패가 임계치를 넘으면 던지는 예외 (정상 중단 신호)
class ConsecutiveFailureAbort extends Error {
  constructor(count) {
    super(`연속 ${count}회 실패 — 네트워크 단절 또는 API 한도 초과로 판단, 안전하게 중단합니다. 인터넷 복구 또는 한도 리셋 후 같은 명령으로 재실행하면 이어서 진행됩니다.`)
    this.name = 'ConsecutiveFailureAbort'
  }
}

// ── 체크포인트 (재개용) ─────────────────────────────────────────────
const CHECKPOINT_PATH = 'scripts/.retag-checkpoint.json'

function loadCheckpoint() {
  if (RESET) {
    try { fs.unlinkSync(CHECKPOINT_PATH) } catch {}
    return { posts: [], users: [] }
  }
  try {
    const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf-8')
    const cp = JSON.parse(raw)
    return { posts: Array.isArray(cp.posts) ? cp.posts : [], users: Array.isArray(cp.users) ? cp.users : [] }
  } catch { return { posts: [], users: [] } }
}

function saveCheckpoint(cp) {
  if (DRY_RUN) return  // 드라이런은 체크포인트 안 씀
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp))
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`

const SUB_CATEGORIES = {
  STUDY:     ['어학', '자격증/시험', '독서', '코딩/개발', '기타 학습'],
  PROJECT:   ['개발', '디자인', '공모전', '창업/사이드', '기타 협업'],
  MEETUP:    ['운동/스포츠', '취미/문화', '네트워킹', '밥약/번개', '기타 모임'],
  COMMUNITY: ['자유게시판', '후기', 'Q&A', '정보공유', '공지사항'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Gemini 호출 — 429/5xx 일시 오류엔 지수 백오프 재시도, 그 외엔 즉시 throw
async function generateJSON(prompt, maxRetries = 3) {
  let lastErr
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      })
      if (res.status === 429 || res.status >= 500) {
        const body = (await res.text()).slice(0, 200)
        throw new Error(`Gemini ${res.status} (재시도 대상): ${body}`)
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Gemini 응답에 텍스트 없음')
      return JSON.parse(text)
    } catch (e) {
      lastErr = e
      const retriable = /\b(429|5\d\d)\b|재시도 대상|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND/.test(e.message)
      if (!retriable || attempt === maxRetries) throw e
      const backoff = Math.min(60000, 5000 * Math.pow(2, attempt))  // 5s → 10s → 20s, 최대 60s
      console.warn(`  ⚠ Gemini 일시 오류 (${e.message.slice(0, 80)}) — ${backoff / 1000}s 후 재시도 (${attempt + 1}/${maxRetries})`)
      await sleep(backoff)
    }
  }
  throw lastErr
}

// 기존 tags 테이블 로드 (재태깅은 기존 태그만 사용)
async function loadTags() {
  const { data, error } = await supabase.from('tags').select('id, name, category')
  if (error) throw error
  return data
}

function pickTagIds(suggestedNames, allTags, postCategory) {
  // 게시글 카테고리와 일치하거나 GENERAL 인 태그만 후보로 인정 (postCategory=null이면 전체)
  const allowed = postCategory
    ? allTags.filter((t) => t.category === postCategory || t.category === 'GENERAL')
    : allTags
  const byNorm = new Map(allowed.map((t) => [t.name.toLowerCase().trim(), t]))
  const ids = []
  const names = []
  for (const raw of suggestedNames) {
    const key = String(raw).toLowerCase().trim()
    const tag = byNorm.get(key)
    if (tag && !ids.includes(tag.id)) {
      ids.push(tag.id)
      names.push(tag.name)
    }
  }
  return { ids, names }
}

// ── Posts 재태깅 ────────────────────────────────────────────────────
async function retagPosts(allTags, checkpoint) {
  let query = supabase
    .from('posts')
    .select('id, category, sub_category, title, content')
    .order('id')
  if (LIMIT) query = query.limit(LIMIT)
  const { data: allPosts, error } = await query
  if (error) throw error

  const done = new Set(checkpoint.posts)
  const posts = allPosts.filter((p) => !done.has(p.id))
  const skipped = allPosts.length - posts.length
  console.log(`\n=== Posts 재태깅: 전체 ${allPosts.length}개 중 ${skipped}개는 이미 완료(스킵), ${posts.length}개 처리 ===`)
  let ok = 0, fail = 0, consecutiveFails = 0

  for (const [i, p] of posts.entries()) {
    const tagPool = allTags
      .filter((t) => t.category === p.category || t.category === 'GENERAL')
      .map((t) => t.name)
    const subPool = SUB_CATEGORIES[p.category] ?? []

    const prompt = [
      '너는 한국어 매칭 플랫폼의 태그/카테고리 큐레이터다.',
      '아래 게시글에 가장 맞는 하위 카테고리 1개와 태그 3~5개를 골라라.',
      '하위 카테고리와 태그는 반드시 주어진 목록의 표기 그대로 사용. 목록에 없는 항목은 절대 만들지 마라.',
      '기존 sub_category 가 게시글 내용과 명백히 어긋날 때만 변경하라. 애매하면 기존 값을 유지하라.',
      'GENERAL 카테고리의 태그(대학생, 직장인, 서울, 주말 등)는 본문 또는 제목에 해당 표현/맥락이 명시적으로 등장할 때만 부여하라. 추측 금지.',
      '응답은 JSON: {"sub_category": "...", "tags": ["...", "..."]}',
      '',
      `[카테고리] ${p.category}`,
      `[기존 sub_category] ${p.sub_category ?? '(없음)'}`,
      `[제목] ${p.title}`,
      `[본문] ${(p.content ?? '').slice(0, 800)}`,
      '',
      `[하위 카테고리 후보] ${subPool.join(', ')}`,
      `[태그 후보] ${tagPool.join(', ')}`,
    ].join('\n')

    try {
      const result = await generateJSON(prompt)
      const newSub = subPool.includes(result.sub_category) ? result.sub_category : p.sub_category
      const { ids, names } = pickTagIds(result.tags ?? [], allTags, p.category)

      console.log(`[${i + 1}/${posts.length}] #${p.id} [${p.category}] "${p.title.slice(0, 30)}"`)
      console.log(`  sub_category: ${p.sub_category} → ${newSub}`)
      console.log(`  tags        : ${names.join(', ') || '(없음)'}`)

      if (!DRY_RUN) {
        if (newSub !== p.sub_category) {
          const { error: subErr } = await supabase
            .from('posts').update({ sub_category: newSub }).eq('id', p.id)
          if (subErr) throw subErr
        }
        if (ids.length) {
          await supabase.from('post_tags').delete().eq('post_id', p.id)
          const rows = ids.map((tag_id) => ({ post_id: p.id, tag_id }))
          const { error: insErr } = await supabase.from('post_tags').insert(rows)
          if (insErr) throw insErr
        }
        checkpoint.posts.push(p.id)
        saveCheckpoint(checkpoint)
      }
      ok++
      consecutiveFails = 0
    } catch (e) {
      fail++
      consecutiveFails++
      console.error(`  ✗ #${p.id}`, e.message)
      if (consecutiveFails >= ABORT_AFTER_CONSECUTIVE_FAILS) {
        console.log(`\nPosts 결과 — 성공 ${ok} / 실패 ${fail} / 이전 완료 스킵 ${skipped}`)
        throw new ConsecutiveFailureAbort(consecutiveFails)
      }
    }
    await sleep(DELAY_MS)
  }
  console.log(`\nPosts 결과 — 성공 ${ok} / 실패 ${fail} / 이전 완료 스킵 ${skipped}`)
}

// ── Users 재태깅 ────────────────────────────────────────────────────
async function retagUsers(allTags, checkpoint) {
  let query = supabase
    .from('users')
    .select('id, nickname, major, introduction')
    .order('created_at')
  if (LIMIT) query = query.limit(LIMIT)
  const { data: allUsers, error } = await query
  if (error) throw error

  const done = new Set(checkpoint.users)
  const users = allUsers.filter((u) => !done.has(u.id))
  const skipped = allUsers.length - users.length
  console.log(`\n=== Users 재태깅: 전체 ${allUsers.length}명 중 ${skipped}명은 이미 완료(스킵), ${users.length}명 처리 ===`)
  let ok = 0, fail = 0, consecutiveFails = 0
  const fullPool = allTags.map((t) => t.name)

  for (const [i, u] of users.entries()) {
    const intro = (u.introduction ?? '').trim()
    const major = (u.major ?? '').trim()
    if (!intro && !major) {
      console.log(`[${i + 1}/${users.length}] @${u.nickname} 정보 부족 → 스킵`)
      continue
    }

    const prompt = [
      '너는 한국어 매칭 플랫폼의 사용자 관심 태그 큐레이터다.',
      '아래 프로필의 흥미/전공/취향에 맞는 태그를 최대 6개 골라라.',
      '반드시 후보 목록의 표기 그대로. 목록에 없는 태그는 생성 금지.',
      '응답은 JSON: {"tags": ["...", "..."]}',
      '',
      `[닉네임] ${u.nickname ?? ''}`,
      `[전공] ${major}`,
      `[자기소개] ${intro.slice(0, 500)}`,
      '',
      `[태그 후보] ${fullPool.join(', ')}`,
    ].join('\n')

    try {
      const result = await generateJSON(prompt)
      const { ids, names } = pickTagIds(result.tags ?? [], allTags, null)
      const picked = ids.slice(0, 6)
      const pickedNames = names.slice(0, 6)
      console.log(`[${i + 1}/${users.length}] @${u.nickname ?? u.id.slice(0, 8)} → ${pickedNames.join(', ') || '(없음)'}`)

      if (!DRY_RUN) {
        if (picked.length) {
          await supabase.from('user_tags').delete().eq('user_id', u.id)
          const rows = picked.map((tag_id) => ({ user_id: u.id, tag_id }))
          const { error: insErr } = await supabase.from('user_tags').insert(rows)
          if (insErr) throw insErr
        }
        checkpoint.users.push(u.id)
        saveCheckpoint(checkpoint)
      }
      ok++
      consecutiveFails = 0
    } catch (e) {
      fail++
      consecutiveFails++
      console.error(`  ✗ @${u.nickname ?? u.id.slice(0, 8)}`, e.message)
      if (consecutiveFails >= ABORT_AFTER_CONSECUTIVE_FAILS) {
        console.log(`\nUsers 결과 — 성공 ${ok} / 실패 ${fail} / 이전 완료 스킵 ${skipped}`)
        throw new ConsecutiveFailureAbort(consecutiveFails)
      }
    }
    await sleep(DELAY_MS)
  }
  console.log(`\nUsers 결과 — 성공 ${ok} / 실패 ${fail} / 이전 완료 스킵 ${skipped}`)
}

// ── 실행 ────────────────────────────────────────────────────────────
async function main() {
  console.log(`재태깅 시작 (mode=${DRY_RUN ? 'DRY-RUN' : 'WRITE'}, target=${TARGET}, model=${MODEL}, delay=${DELAY_MS}ms${LIMIT ? `, limit=${LIMIT}` : ''}${RESET ? ', reset=true' : ''})`)
  const checkpoint = loadCheckpoint()
  if (checkpoint.posts.length || checkpoint.users.length) {
    console.log(`이어서 진행: 이전에 처리 완료된 posts ${checkpoint.posts.length}개 / users ${checkpoint.users.length}명 (스킵)`)
    console.log(`처음부터 다시 하려면 --reset 옵션을 붙여 실행하세요.`)
  }
  const allTags = await loadTags()
  console.log(`기존 태그 ${allTags.length}개 로드`)

  // Ctrl+C 시에도 마지막 체크포인트는 이미 저장된 상태 (성공 직후 저장하므로)
  process.on('SIGINT', () => {
    console.log('\n중단 요청 — 마지막 성공 항목까지 체크포인트 저장됨. 같은 명령으로 재실행하면 이어서 진행됩니다.')
    process.exit(130)
  })

  if (TARGET === 'posts' || TARGET === 'both') await retagPosts(allTags, checkpoint)
  if (TARGET === 'users' || TARGET === 'both') await retagUsers(allTags, checkpoint)

  console.log('\n완료.')
}

main().catch((e) => {
  if (e instanceof ConsecutiveFailureAbort) {
    console.error('\n' + e.message)
    process.exit(2)
  }
  console.error(e)
  process.exit(1)
})
