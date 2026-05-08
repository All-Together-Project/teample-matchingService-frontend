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
      const results = await recommendProjects(admin, prompt.trim())
      return jsonResponse({ results })
    } else {
      if (!postId) return jsonResponse({ error: 'postId required for member mode' }, 400)
      const { data: post } = await admin
        .from('posts')
        .select('id, author_id, title, content')
        .eq('id', postId)
        .single()
      if (!post) return jsonResponse({ error: 'post not found' }, 404)
      if (post.author_id !== user.id) return jsonResponse({ error: 'forbidden — leader only' }, 403)
      const results = await recommendMembers(admin, prompt.trim(), post)
      return jsonResponse({ results })
    }
  } catch (e) {
    console.error('ai-recommend error', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

async function recommendProjects(client: any, prompt: string) {
  // 1) 프롬프트를 임베딩 후 match_posts
  const vector = await embedText(prompt, 'RETRIEVAL_QUERY')
  const { data: matches, error } = await client.rpc('match_posts', {
    query_embedding: vector,
    match_count: 8,
    match_threshold: 0.0,
  })
  if (error) throw error
  if (!matches?.length) return []

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

  // 3) AI 추천 이유 — 한 번의 호출로 묶어서
  const reasons = await generateReasons(
    prompt,
    matches.map((m: any) => ({
      label: m.title,
      text: (m.content ?? '').slice(0, 200),
    })),
    'project',
  )

  return matches.map((m: any, i: number) => {
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
      reason: reasons[i] ?? '',
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
  })
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

  if (sorted.length === 0) return []

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

  // 6) AI 이유
  const contextPrompt =
    `프로젝트: "${post.title}"\n프로젝트 내용 요약: ${(post.content ?? '').slice(0, 300)}\n` +
    `리더 요청: ${prompt}`

  const reasons = await generateReasons(
    contextPrompt,
    sorted.map((c) => ({
      label: c.user.nickname,
      text:
        `자기소개: ${c.user.introduction || '없음'} / ` +
        `매너온도: ${c.user.temperature ?? 36.5} / ` +
        `태그: ${(tagByUser.get(c.user.id) ?? []).map((t: any) => t.name).join(', ')}`,
    })),
    'member',
  )

  return sorted.map((c, i) => ({
    id: c.user.id,
    nickname: c.user.nickname,
    profileUrl: c.user.profile_url,
    temperature: c.user.temperature,
    introduction: c.user.introduction,
    tagOverlap: c.overlap,
    tags: tagByUser.get(c.user.id) ?? [],
    reason: reasons[i] ?? '',
  }))
}

async function generateReasons(
  userPrompt: string,
  candidates: { label: string; text: string }[],
  mode: 'project' | 'member',
): Promise<string[]> {
  if (candidates.length === 0) return []

  const target = mode === 'project' ? '프로젝트' : '사용자'
  const numbered = candidates
    .map((c, i) => `${i + 1}. ${c.label}\n   ${c.text}`)
    .join('\n\n')

  const prompt = `너는 매칭 플랫폼의 추천 이유 생성기야.
사용자가 다음과 같이 요청했어: "${userPrompt}"

아래 ${candidates.length}개의 ${target} 후보 각각에 대해 "왜 적합한지" 짧은 이유를 한 줄(45자 이내, 한국어)로 만들어줘.

후보:
${numbered}

규칙:
- 각 후보의 특징과 사용자 요청을 연결
- 자연스러운 문장 (예: "리액트 경험이 있고 빠른 일정에 맞춰 작업 가능해서 추천")
- 후보 순서대로 동일한 개수의 reasons 배열을 반환
- 과장/추측은 피하고 후보 정보 안에서만

JSON으로만 응답:
{"reasons": ["...", "...", ...]}`

  try {
    const result = await generateJSON<{ reasons: string[] }>(prompt, { temperature: 0.5 })
    return result.reasons ?? []
  } catch (e) {
    console.warn('generateReasons failed', e)
    return candidates.map(() => '')
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
