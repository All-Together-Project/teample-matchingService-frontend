// 모든 게시글의 sub_category와 태그를 Gemini로 재정립
// 사용법:
//   $env:SUPABASE_URL="..."
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."
//   $env:GEMINI_API_KEY="..."
//   node scripts/retag-posts.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY   = process.env.GEMINI_API_KEY

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
  console.error('환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SUB_CATEGORIES = {
  STUDY:     ['어학', '자격증/시험', '독서', '코딩/개발', '기타 학습'],
  PROJECT:   ['개발', '디자인', '공모전', '창업/사이드', '기타 협업'],
  MEETUP:    ['운동/스포츠', '취미/문화', '네트워킹', '밥약/번개', '기타 모임'],
  COMMUNITY: ['자유게시판', '후기', 'Q&A', '정보공유', '공지사항'],
}

const MODEL = 'gemini-2.5-flash-lite'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`

async function classify(post, tagsByCategory) {
  const subOptions = SUB_CATEGORIES[post.category]
  const eligibleCats = post.category === 'COMMUNITY' ? ['GENERAL'] : [post.category, 'GENERAL']
  const tagList = eligibleCats
    .map(cat => `[${cat}] ${(tagsByCategory[cat] ?? []).join(', ')}`)
    .join('\n')

  const prompt = `너는 한국어 매칭 플랫폼의 게시글 분류기야. 게시글 내용을 분석해서 가장 어울리는 sub_category 1개와 태그 3-5개를 골라.

# 게시글
제목: ${post.title}
내용: ${(post.content || '').slice(0, 1200)}
대분류: ${post.category}

# 가능한 sub_category (정확히 한 개)
${subOptions.join(' / ')}

# 가능한 태그 (반드시 아래 목록의 정확한 이름만 사용)
${tagList}

# 응답 규칙
- subCategory는 위 목록 중 정확히 한 개
- tagNames는 위 목록에서 3-5개 (정확한 표기)
- 게시글 의미와 가장 잘 맞는 것 우선
- 새 태그를 만들지 말 것

JSON 형식으로만 답변:
{
  "subCategory": "...",
  "tagNames": ["...", "...", "..."]
}`

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!jsonText) throw new Error('Gemini empty response')
  return JSON.parse(jsonText)
}

async function main() {
  console.log('태그/게시글 로드 중...')

  const { data: tags, error: tagErr } = await supabase
    .from('tags')
    .select('id, name, category')
  if (tagErr) throw tagErr

  const tagsByCategory = {}
  for (const t of tags) {
    (tagsByCategory[t.category] ??= []).push(t.name)
  }

  // 동명이태그 가능성 — (name, category) 둘 다로 매칭
  const tagIdByKey = new Map()
  for (const t of tags) tagIdByKey.set(`${t.name}|${t.category}`, t.id)

  const { data: posts, error: postErr } = await supabase
    .from('posts')
    .select('id, title, content, category, sub_category')
    .order('id')
  if (postErr) throw postErr

  console.log(`대상 ${posts.length}개\n`)

  let ok = 0, fail = 0
  for (const [i, post] of posts.entries()) {
    try {
      const result = await classify(post, tagsByCategory)
      const eligibleCats = post.category === 'COMMUNITY' ? ['GENERAL'] : [post.category, 'GENERAL']

      // sub_category 갱신
      if (
        result.subCategory &&
        SUB_CATEGORIES[post.category]?.includes(result.subCategory) &&
        result.subCategory !== post.sub_category
      ) {
        await supabase.from('posts').update({ sub_category: result.subCategory }).eq('id', post.id)
      }

      // 태그명 → id 매핑 (대분류 우선, GENERAL 폴백)
      const newTagIds = []
      for (const name of (result.tagNames ?? []).slice(0, 5)) {
        let id
        for (const cat of eligibleCats) {
          id = tagIdByKey.get(`${name}|${cat}`)
          if (id) break
        }
        if (id && !newTagIds.includes(id)) newTagIds.push(id)
      }

      // post_tags 재구성
      if (newTagIds.length > 0) {
        await supabase.from('post_tags').delete().eq('post_id', post.id)
        const rows = newTagIds.map(tag_id => ({ post_id: post.id, tag_id }))
        const { error: insErr } = await supabase.from('post_tags').insert(rows)
        if (insErr) throw insErr
      }

      ok++
      console.log(
        `[${i + 1}/${posts.length}] ✓ #${post.id} ${result.subCategory} | ${(result.tagNames ?? []).join(', ')}`
      )
    } catch (e) {
      fail++
      console.error(`[${i + 1}/${posts.length}] ✗ #${post.id}`, e.message)
    }
    // free tier 15 RPM — 4.5초 간격
    await new Promise(r => setTimeout(r, 4500))
  }

  console.log(`\n완료 — 성공 ${ok} / 실패 ${fail}`)
}

main().catch(e => { console.error(e); process.exit(1) })
