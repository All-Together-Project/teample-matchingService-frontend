// Edge Function: ai-recommend
//   요청: POST {
//     mode: 'project' | 'member',
//     prompt: string,
//     postId?: number,    // member 모드 전용 — 어떤 모집 공고의 팀원인지
//   }
//   동작:
//     - project 모드: prompt 임베딩 → match_posts → 각 결과에 AI 추천 이유 첨부
//     - member 모드: postId의 태그 기반 후보 검색 → AI 추천 이유 첨부 (작성자 본인만 호출 가능)
//
// 인증: 로그인 필수
// 배포:  supabase functions deploy ai-recommend

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { embedText, generateJSON } from '../_shared/gemini.ts'

interface Body {
  mode: 'project' | 'member'
  prompt: string
  postId?: number
}

const STATUS_LABEL: Record<string, string> = {
  RECRUITING: '모집중',
  COMPLETE:   '모집완료',
  FINISHED:   '종료',
  GENERAL:    '일반',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { mode, prompt, postId } = (await req.json()) as Body
    if (!prompt?.trim()) return jsonResponse({ error: 'prompt is required' }, 400)
    if (mode !== 'project' && mode !== 'member') {
      return jsonResponse({ error: 'invalid mode' }, 400)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)

    if (mode === 'project') {
      const result = await recommendProjects(admin, prompt.trim())
      return jsonResponse(result)
    } else {
      if (!postId) return jsonResponse({ error: 'postId required for member mode' }, 400)
      const { data: post } = await admin
        .from('posts')
        .select('id, author_id, title, content')
        .eq('id', postId)
        .single()
      if (!post) return jsonResponse({ error: 'post not found' }, 404)
      if (post.author_id !== user.id) return jsonResponse({ error: 'forbidden — leader only' }, 403)
      const memberResult = await recommendMembers(admin, prompt.trim(), post)
      return jsonResponse(memberResult)
    }
  } catch (e) {
    console.error('ai-recommend error', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

async function recommendProjects(client: any, prompt: string) {
  // 1) 프롬프트 임베딩 + match_posts (그룹 분류 여지를 위해 10개 후보)
  const vector = await embedText(prompt, 'RETRIEVAL_QUERY')
  const { data: matches, error } = await client.rpc('match_posts', {
    query_embedding: vector,
    match_count: 10,
    match_threshold: 0.0,
  })
  if (error) throw error
  if (!matches?.length) {
    return { primary: [], related: [], primaryIntro: '', relatedIntro: '' }
  }

  // 2) 작성자/태그 보강
  const ids = matches.map((m: any) => m.id)
  const { data: details } = await client
    .from('posts')
    .select(`
      id,
      author:users!posts_author_id_fkey(id, nickname, profile_url, temperature),
      post_tags(tag:tags(id, name, category))
    `)
    .in('id', ids)
  const detailMap = new Map((details ?? []).map((d: any) => [d.id, d]))

  // 3) Gemini 분류 + 이유 + 인트로 (단일 호출). 상태도 한국어 라벨로 같이 전달.
  const classification = await classifyAndReason(
    prompt,
    matches.map((m: any) => ({
      label: m.title,
      category: m.category,
      subCategory: m.sub_category,
      statusLabel: STATUS_LABEL[m.status] ?? m.status,
      text: (m.content ?? '').slice(0, 200),
    })),
  )

  const toCard = (m: any, reason: string) => {
    const det: any = detailMap.get(m.id)
    return {
      id: m.id,
      category: m.category,
      subCategory: m.sub_category,
      title: m.title,
      content: m.content,
      capacity: m.capacity,
      currentMemberCount: m.current_member_count,
      status: m.status,
      similarity: m.similarity,
      reason,
      author: det?.author
        ? {
            id: det.author.id,
            nickname: det.author.nickname,
            profileUrl: det.author.profile_url,
            temperature: det.author.temperature,
          }
        : null,
      tags: ((det?.post_tags ?? []) as any[]).map((pt) => pt.tag).filter(Boolean),
    }
  }

  const primary: any[] = []
  const related: any[] = []
  for (const item of classification.items) {
    const m = matches[item.index - 1]
    if (!m) continue
    const card = toCard(m, item.reason ?? '')
    if (item.role === 'primary') primary.push(card)
    else if (item.role === 'related') related.push(card)
  }

  return {
    primary,
    related,
    primaryIntro: classification.primary_intro || '',
    relatedIntro: classification.related_intro || '',
  }
}

async function classifyAndReason(
  userPrompt: string,
  candidates: { label: string; category: string; subCategory: string; statusLabel: string; text: string }[],
): Promise<{
  primary_intro: string
  related_intro: string
  items: { index: number; role: 'primary' | 'related'; reason: string }[]
}> {
  if (candidates.length === 0) {
    return { primary_intro: '', related_intro: '', items: [] }
  }
  const numbered = candidates
    .map((c, i) => `${i + 1}. [${c.category} / ${c.subCategory} / ${c.statusLabel}] ${c.label}\n   ${c.text}`)
    .join('\n\n')

  const prompt = `너는 매칭 플랫폼의 추천 큐레이터야.
사용자가 다음과 같이 요청했어: "${userPrompt}"

게시글 상태 라벨 안내:
- 모집중: 신규 멤버 합류 가능
- 모집완료: 정원은 찼지만 활동 진행 중 (구경/벤치마킹용으로는 볼 수 있음)
- 종료: 이미 마친 활동 (후기/참고용)
- 일반: 커뮤니티 글 (모집 개념 없음, Q&A·후기·정보공유 등)

아래 ${candidates.length}개의 게시글 후보를 두 그룹으로 분류해줘:
- "primary": 사용자 요청에 직접 부합 (핵심 키워드/주제/제약 모두 매칭)
- "related": 의미적으로 연관되지만 직접 일치는 아닌 인접 추천 (다른 세부 카테고리이지만 관심사가 겹칠 만한 것)

후보:
${numbered}

규칙:
- 사용자가 상태에 대해 명시적 의도를 드러내면 그 의도를 최우선 반영:
  - "모집중인 것만", "지금 들어갈 수 있는" → 모집완료/종료 후보는 items에서 제외
  - "끝난 프로젝트 보고 싶어", "후기 참고용" → 종료 후보를 primary에 포함
  - 명시 없음 → 모집중을 primary로, 모집완료/종료는 인접 추천(related)으로 후순위 처리
- primary 3~5개 권장. 명확히 부합하는 후보가 적으면 적게.
- 관련성이 거의 없는 후보는 items에서 제외.
- 각 후보별 추천 이유를 한 줄(45자 이내) 한국어로. 모집완료/종료 후보면 이유에 그 상태도 자연스럽게 언급 (예: "이미 종료된 시즌이지만 후기 참고용으로 좋음").
- 두 그룹별 인트로 멘트(60자 이내):
  - primary_intro: 주 추천 도입 (예: "토익 700~800점 목표에 맞춰 강남권 스터디들을 골랐어요")
  - related_intro: 인접 추천 도입 (예: "어학 자격증 쪽에 관심 있으시면 토플·회화 스터디도 추천드려요")
- related가 비면 related_intro도 빈 문자열로.

JSON으로만 응답:
{
  "primary_intro": "...",
  "related_intro": "...",
  "items": [
    {"index": 1, "role": "primary", "reason": "..."},
    {"index": 2, "role": "related", "reason": "..."}
  ]
}`

  try {
    return await generateJSON<{
      primary_intro: string
      related_intro: string
      items: { index: number; role: 'primary' | 'related'; reason: string }[]
    }>(prompt, { temperature: 0.5 })
  } catch (e) {
    console.warn('classifyAndReason failed, falling back to all-primary', e)
    return {
      primary_intro: '검색 결과입니다.',
      related_intro: '',
      items: candidates.map((_, i) => ({ index: i + 1, role: 'primary' as const, reason: '' })),
    }
  }
}

async function recommendMembers(client: any, prompt: string, post: any) {
  // 1) 게시글 태그
  const { data: postTags } = await client
    .from('post_tags')
    .select('tag_id')
    .eq('post_id', post.id)
  const tagIds: number[] = (postTags ?? []).map((p: any) => p.tag_id)

  // 2) 제외 대상 (작성자 + 기존 멤버)
  const { data: members } = await client.from('post_members').select('user_id').eq('post_id', post.id)
  const excludeIds = new Set<string>([post.author_id, ...((members ?? []).map((m: any) => m.user_id))])

  // 3) 태그 겹치는 사용자 모음 (overlap 카운트)
  const candidates = new Map<string, { user: any; overlap: number }>()
  if (tagIds.length > 0) {
    const { data: userTagRows } = await client
      .from('user_tags')
      .select(`user_id, user:users(id, nickname, profile_url, temperature, introduction)`)
      .in('tag_id', tagIds)

    for (const row of (userTagRows ?? []) as any[]) {
      if (!row.user || excludeIds.has(row.user.id)) continue
      const existing = candidates.get(row.user.id)
      if (existing) existing.overlap++
      else candidates.set(row.user.id, { user: row.user, overlap: 1 })
    }
  }

  // 4) 후보가 8명 미만이면 매너온도 높은 사용자 보충
  if (candidates.size < 8) {
    const { data: extras } = await client
      .from('users')
      .select('id, nickname, profile_url, temperature, introduction')
      .order('temperature', { ascending: false })
      .limit(40)
    for (const u of (extras ?? []) as any[]) {
      if (excludeIds.has(u.id)) continue
      if (candidates.has(u.id)) continue
      candidates.set(u.id, { user: u, overlap: 0 })
      if (candidates.size >= 12) break
    }
  }

  const sorted = Array.from(candidates.values())
    .sort((a, b) =>
      b.overlap - a.overlap || (b.user.temperature ?? 0) - (a.user.temperature ?? 0),
    )
    .slice(0, 8)

  if (sorted.length === 0) return { intro: '', results: [] }

  // 5) 각 사용자 태그
  const userIds = sorted.map((c) => c.user.id)
  const { data: userTagRows2 } = await client
    .from('user_tags')
    .select(`user_id, tag:tags(id, name, category)`)
    .in('user_id', userIds)
  const tagByUser = new Map<string, any[]>()
  for (const row of (userTagRows2 ?? []) as any[]) {
    if (!row.tag) continue
    const arr = tagByUser.get(row.user_id) ?? []
    arr.push(row.tag)
    tagByUser.set(row.user_id, arr)
  }

  // 6) AI 분석 (인트로 + 풍부한 이유)
  const analysis = await generateMemberAnalysis(post, prompt, sorted.map((c) => ({
    nickname: c.user.nickname,
    introduction: c.user.introduction,
    temperature: c.user.temperature,
    tagOverlap: c.overlap,
    tags: (tagByUser.get(c.user.id) ?? []).map((t: any) => t.name),
  })))

  const results = sorted.map((c, i) => ({
    id: c.user.id,
    nickname: c.user.nickname,
    profileUrl: c.user.profile_url,
    temperature: c.user.temperature,
    introduction: c.user.introduction,
    tagOverlap: c.overlap,
    tags: tagByUser.get(c.user.id) ?? [],
    reason: analysis.reasons[i] ?? '',
  }))

  return { intro: analysis.intro, results }
}

async function generateMemberAnalysis(
  post: { title: string; content: string },
  leaderPrompt: string,
  candidates: {
    nickname: string
    introduction: string | null
    temperature: number | null
    tagOverlap: number
    tags: string[]
  }[],
): Promise<{ intro: string; reasons: string[] }> {
  if (candidates.length === 0) return { intro: '', reasons: [] }

  const numbered = candidates
    .map((c, i) =>
      `${i + 1}. ${c.nickname}\n` +
      `   자기소개: ${c.introduction || '(작성 안 함)'}\n` +
      `   매너온도: ${c.temperature ?? 36.5}°C ` +
        `(${interpretTemperature(c.temperature ?? 36.5)})\n` +
      `   태그: ${c.tags.length > 0 ? c.tags.join(', ') : '없음'}\n` +
      `   게시글 태그와 겹치는 개수: ${c.tagOverlap}개`,
    )
    .join('\n\n')

  const prompt = `너는 매칭 플랫폼의 팀원 추천 큐레이터야.

프로젝트 정보:
- 제목: "${post.title}"
- 내용 요약: ${(post.content ?? '').slice(0, 300)}

리더 요청:
"${leaderPrompt}"

후보 ${candidates.length}명:
${numbered}

다음을 생성해줘:
1. "intro" — 후보 풀 전체에 대한 한 줄(80자 이내) 분석 요약.
   예시: "태그 겹침이 많고 매너온도가 높은 베테랑 위주로 골라봤어요. 모두 리더 요청과 직접 연관된 분들입니다."
2. "reasons" — 각 후보별 추천 이유. 후보 순서대로 같은 개수의 배열.
   각 이유는 한국어 2~3문장(120~200자):
   - 첫 문장: 후보의 핵심 강점·매너온도·태그 등 구체 근거 인용
   - 두 번째 문장: 리더 요청·프로젝트와 어떻게 매칭되는지
   - (선택) 세 번째 문장: 함께 할 때 시너지 포인트 또는 가벼운 주의점
   예시: "자기소개에 '커뮤니케이션 중시'를 명시했고 매너온도 44.1°C로 신뢰도가 높은 분이에요. 'React' '프론트엔드' 태그가 겹쳐 프로젝트 핵심 기술 스택과 잘 맞습니다. 진지한 분위기 선호 후보라 빠른 일정 협업에 잘 맞을 듯해요."

규칙:
- 후보 정보에 없는 사실을 만들어내지 말 것 (예: 경력 연차, 특정 회사 등)
- 매너온도 36.5°C(기본값)인 후보는 "신규 사용자"로 부드럽게 언급, 단점으로 강조하지 말 것
- 태그 겹침이 0인 후보는 다른 강점(자기소개·매너온도)으로 추천 이유를 풀 것

JSON으로만 응답:
{
  "intro": "...",
  "reasons": ["...", "...", ...]
}`

  try {
    const result = await generateJSON<{ intro: string; reasons: string[] }>(prompt, {
      temperature: 0.6,
    })
    return {
      intro: result.intro || '',
      reasons: result.reasons ?? candidates.map(() => ''),
    }
  } catch (e) {
    console.warn('generateMemberAnalysis failed', e)
    return { intro: '', reasons: candidates.map(() => '') }
  }
}

function interpretTemperature(t: number): string {
  if (t >= 45) return '인기 사용자'
  if (t >= 42) return '베테랑'
  if (t >= 39) return '활동 우수'
  if (t >= 37) return '활동 양호'
  if (t > 36.5) return '신규에서 활동 시작'
  return '신규 사용자'
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
