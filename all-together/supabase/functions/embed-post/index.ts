// Edge Function: embed-post
//   요청: POST { postId: number, text?: string }
//     - text가 없으면 DB에서 title+content 조회
//   동작: Gemini로 임베딩 생성 → posts.embedding 업데이트 (service role)
//
// 호출 권한: authenticated (Supabase JWT 검증) — 본인이 작성한 글만 임베딩 가능
// 배포:    supabase functions deploy embed-post

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { embedText } from '../_shared/gemini.ts'

interface Body {
  postId: number
  text?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { postId, text } = (await req.json()) as Body
    if (!postId) {
      return jsonResponse({ error: 'postId is required' }, 400)
    }

    // 호출자 인증 (Authorization 헤더에 사용자 JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1) 호출자 검증
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return jsonResponse({ error: 'unauthorized' }, 401)

    // 2) 게시글 조회 (작성자 본인 검증) — service role
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: post, error: postErr } = await adminClient
      .from('posts')
      .select('id, title, content, author_id')
      .eq('id', postId)
      .single()
    if (postErr || !post) return jsonResponse({ error: 'post not found' }, 404)
    if (post.author_id !== user.id) {
      return jsonResponse({ error: 'forbidden — only author can embed' }, 403)
    }

    // 3) 임베딩할 텍스트 결정 (요청 body 우선, 없으면 title + content)
    const sourceText = (text && text.trim().length > 0)
      ? text.trim()
      : `${post.title}\n\n${post.content ?? ''}`.trim()

    // 4) Gemini 임베딩
    const vector = await embedText(sourceText, 'RETRIEVAL_DOCUMENT')

    // 5) 저장
    const { error: updErr } = await adminClient
      .from('posts')
      .update({ embedding: vector })
      .eq('id', postId)
    if (updErr) throw updErr

    return jsonResponse({ ok: true, postId, dim: vector.length })
  } catch (e) {
    console.error('embed-post error', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
