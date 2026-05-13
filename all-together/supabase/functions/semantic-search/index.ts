// Edge Function: semantic-search
//   요청: POST {
//     query: string,
//     limit?: number,
//     threshold?: number,
//     category?: string,
//     status?: string,
//     subCategory?: string,
//   }
//   동작: 검색어를 Gemini로 임베딩 → match_posts RPC → 유사 게시글 반환
//
// 인증: 익명/로그인 모두 허용 (검색은 누구나 가능)
// 배포:  supabase functions deploy semantic-search

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { embedText } from '../_shared/gemini.ts'

interface Body {
  query: string
  limit?: number
  threshold?: number
  category?: string
  status?: string
  subCategory?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = (await req.json()) as Body
    const query = body.query?.trim()
    if (!query) return jsonResponse({ error: 'query is required' }, 400)

    // 1) 검색어 임베딩 (RETRIEVAL_QUERY 모드)
    const vector = await embedText(query, 'RETRIEVAL_QUERY')

    // 2) match_posts RPC 호출
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const client = createClient(supabaseUrl, serviceKey)

    const requestedLimit = body.limit ?? 12
    const explicitCategory = body.category
    // 카테고리 명시 안 했으면 COMMUNITY 글까지 가져온 뒤 후처리로 제외해야 하므로
    // 여유분(2배) 미리 받아옴
    const fetchCount = explicitCategory ? requestedLimit : requestedLimit * 2

    const { data, error } = await client.rpc('match_posts', {
      query_embedding: vector,
      match_count: fetchCount,
      match_threshold: body.threshold ?? 0.65,  // 한국어 임베딩 베이스라인 컷 (엄격)
      filter_category: explicitCategory ?? null,
      filter_status: body.status ?? null,
      filter_sub_category: body.subCategory ?? null,
    })
    if (error) throw error

    // 2-1) 사용자가 카테고리 명시하지 않았으면 자유게시판(COMMUNITY) 자동 제외
    //      → 검색은 기본적으로 모집 공고 대상. COMMUNITY 검색은 명시 선택 시에만.
    let filtered: any[] = data ?? []
    if (!explicitCategory) {
      filtered = filtered.filter((p) => p.category !== 'COMMUNITY')
    }
    filtered = filtered.slice(0, requestedLimit)

    // 3) 작성자/태그까지 같이 보내기 — 추가 조회
    const postIds = filtered.map((p: any) => p.id)
    let augmented: any[] = filtered
    if (postIds.length > 0) {
      const { data: details } = await client
        .from('posts')
        .select(`
          id,
          author:users!posts_author_id_fkey(id, nickname, profile_url, temperature),
          post_tags(tag:tags(id, name, category))
        `)
        .in('id', postIds)

      const detailMap = new Map(
        (details ?? []).map((d: any) => [d.id, d]),
      )
      augmented = filtered.map((p: any) => {
        const det: any = detailMap.get(p.id)
        return {
          ...p,
          author: det?.author ?? null,
          tags: (det?.post_tags ?? []).map((pt: any) => pt.tag).filter(Boolean),
        }
      })
    }

    return jsonResponse({ matches: augmented })
  } catch (e) {
    console.error('semantic-search error', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
