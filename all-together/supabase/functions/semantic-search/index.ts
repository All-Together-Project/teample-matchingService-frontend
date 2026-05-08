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

    const { data, error } = await client.rpc('match_posts', {
      query_embedding: vector,
      match_count: body.limit ?? 12,
      match_threshold: body.threshold ?? 0.0,
      filter_category: body.category ?? null,
      filter_status: body.status ?? null,
      filter_sub_category: body.subCategory ?? null,
    })
    if (error) throw error

    // 3) 작성자/태그까지 같이 보내기 — 추가 조회
    const postIds = (data ?? []).map((p: any) => p.id)
    let augmented = data ?? []
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
      augmented = (data ?? []).map((p: any) => {
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
