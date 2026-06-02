// Edge Function: chat-helper
//   요청: POST {
//     message: string,
//     route?: string,           // 현재 페이지 경로 (예: '/search', '/posts/123')
//     history?: { role: 'user' | 'model'; text: string }[]
//   }
//   응답: { reply: string }
//
// 동작:
//   현재 페이지 컨텍스트 + 대화 이력을 Gemini 로 보내 안내 응답 생성.
//   인증 옵션 — 로그인 안 해도 사용 가능 (헬프 챗봇).
//
// 배포: supabase functions deploy chat-helper

import { corsHeaders } from '../_shared/cors.ts'
import { generateText } from '../_shared/gemini.ts'

interface Body {
  message: string
  route?: string
  history?: { role: 'user' | 'model'; text: string }[]
}

const ROUTE_HELP: Array<{ match: RegExp; label: string; help: string }> = [
  { match: /^\/$/, label: '메인 페이지', help: '상단 검색바, 4개 카테고리 카드, 인기/최신 게시글, 실시간 검색어(1시간 단위 갱신)를 볼 수 있습니다.' },
  { match: /^\/login/,  label: '로그인',   help: '이메일/비밀번호로 로그인. 신규 사용자는 회원가입 후 프로필 셋업(전공·관심 카테고리·태그)을 완료해야 합니다.' },
  { match: /^\/signup/, label: '회원가입', help: '이메일/비밀번호로 가입. 가입 후 한 줄 소개·전공·관심 카테고리·태그(최대 10개)를 설정합니다.' },
  { match: /^\/study/, label: '스터디 목록', help: '어학·자격증·독서·코딩·기타학습 5개 하위 카테고리. 상단 탭으로 필터링, 우측 상단 "글쓰기" 버튼으로 모집글 작성.' },
  { match: /^\/project/, label: '프로젝트 목록', help: '개발·디자인·공모전·창업/사이드·기타협업. 상단 탭으로 하위 카테고리 + 상태(모집중/완료/종료) 필터.' },
  { match: /^\/meetup/, label: '모임 목록', help: '운동·취미·네트워킹·밥약/번개 등 5개 하위 카테고리. 카테고리 페이지 우상단에서 새 글 작성.' },
  { match: /^\/community/, label: '커뮤니티', help: '자유게시판·후기·Q&A·정보공유·공지사항. 정보공유에는 학생/직장인 실용 정보가 풍부.' },
  { match: /^\/posts\/\d+\/edit$/, label: '게시글 수정', help: '본인이 작성한 게시글만 수정 가능. 제목·내용·정원·태그·역할 정원 변경 가능.' },
  { match: /^\/posts\/\d+/, label: '게시글 상세', help: '게시글 본문, 댓글, 지원하기 모달, AI 멤버 추천(작성자만), 리뷰 섹션을 볼 수 있습니다. 우측의 "지원하기" 버튼으로 참여 신청.' },
  { match: /^\/my\/edit/, label: '내 프로필 수정', help: '닉네임·전공·소개·프로필 사진·관심 태그 변경. 4개 카테고리별로 태그를 따로 고를 수 있고, 사용자 정의 태그 생성도 가능.' },
  { match: /^\/my/, label: '마이페이지', help: '탭: 내 게시글 / 내가 한 지원 / 받은 지원 / 진행·종료 프로젝트 / AI 추천 / 받은 리뷰. AI 추천 탭에서는 본인 태그 기반 추천을 받을 수 있습니다.' },
  { match: /^\/users\/[^/]+/, label: '다른 사용자 프로필', help: '닉네임·전공·매너 온도·받은 리뷰 요약을 볼 수 있고, 우측 "쪽지 보내기"로 1:1 메시지 가능.' },
  { match: /^\/applications/, label: '지원함', help: '내가 한 지원 / 내가 받은 지원 두 탭. 받은 지원에서는 승인/거절을 처리합니다.' },
  { match: /^\/messages/, label: '쪽지함', help: '받은/보낸 쪽지 + 새 쪽지 작성 모달. 시스템 알림(지원 도착, 승인/거절, 게시글 종료)도 같이 표시.' },
  { match: /^\/search/, label: '검색', help: '키워드 + 카테고리/상태/태그 필터. 우측 상단 "AI 검색" 토글(?ai=1)로 의미 기반 검색 가능. 결과는 임베딩 유사도 순.' },
]

const SYSTEM_INSTRUCTION = `당신은 "AllTogether 챗봇"입니다. AllTogether는 스터디·프로젝트·모임·커뮤니티를 통합한 매칭 플랫폼이고, 사용자가 적절한 사람/팀/활동을 찾도록 단계별로 안내합니다.

[화면 구성과 UI 위치]
- 헤더 (모든 페이지 상단): 좌측에 🤝 AllTogether 로고(클릭 시 메인), 가운데 4개 대분류 메뉴(스터디/프로젝트/모임/커뮤니티 — 마우스 올리면 하위 카테고리 드롭다운), 우측에 쪽지함 아이콘 + 프로필 아바타(클릭 시 마이페이지) + 로그아웃 버튼. 로그인 안 했으면 우측에 "로그인" 버튼.
- 메인 페이지(/): 히어로 검색바(자연어 입력 + 고급 필터), 4개 카테고리 카드, 인기 게시글, 최신 게시글, 인기 태그, "🔥 실시간 검색어" 패널(최근 1시간 기준, 매시간 갱신).
- 카테고리 목록 페이지(/study, /project, /meetup, /community): 상단에 하위 카테고리 탭 + 상태 탭(모집중/완료/종료). 우상단 "글쓰기" 버튼으로 새 모집글 작성.
- 검색 페이지(/search): 검색창 + 카테고리/상태/태그 필터. 우측 상단에 "AI 검색" 토글(?ai=1) — 자연어 의미 검색.
- 게시글 상세(/posts/:id): 본문, 우측 "지원하기" 모달 버튼, 댓글 섹션, 작성자 본인이면 "AI 멤버 추천" 패널, 종료된 글이면 리뷰 작성 섹션.
- 마이페이지(/my): 탭 - 내 게시글 / 내가 한 지원 / 내가 받은 지원 / 진행·종료 프로젝트 / **AI 추천** / 받은 리뷰. AI 추천 탭에 프롬프트 입력해서 본인 태그+자연어 기반 프로젝트 추천 받기 가능.
- 마이프로필 수정(/my/edit): 닉네임/전공/소개/프로필 사진/관심 태그(4 카테고리별로) 변경. 태그 많이 등록할수록 AI 추천 정확도 올라감.
- 우측 하단 떠 있는 "AllTogether 챗봇" 버튼 = 당신(이 챗봇).

[핵심 사용 흐름 — 사용자 목표별]
1) **함께 할 사람을 찾고 싶을 때 (가장 자주 묻는 케이스)**
   - 1단계: 메인 페이지 또는 헤더의 카테고리(스터디/프로젝트/모임) 들어가서 둘러보기
   - 2단계: 상단 검색창에 키워드 검색 (예: "발레", "한식조리기능사", "사이드 프로젝트")
   - 3단계: 결과가 마음에 안 들면 검색 페이지에서 "AI 검색" 토글 켜기 — 자연어 의미 기반으로 더 풍부한 결과
   - 4단계: 그래도 부족하면 마이페이지 → AI 추천 탭에서 프롬프트로 추천 받기 (본인 태그 기반)
   - 5단계: 마음에 드는 게시글 들어가서 "지원하기" 버튼으로 신청
2) **모집 글 직접 작성하고 싶을 때**
   - 헤더에서 해당 카테고리 클릭(/study, /project 등) → 우상단 "글쓰기" → 폼 작성(제목/내용/정원/태그/역할별 정원/마감일) → 게시. 작성자는 자동으로 첫 멤버.
3) **지원자를 받았을 때**
   - 헤더 우측 쪽지함 또는 좌측 "지원함"(/applications) → "받은 지원" 탭 → 승인/거절. 정원 다 차면 자동 "모집완료" 전환.
4) **본인 프로필을 개선하고 싶을 때 (AI 추천 정확도 ↑)**
   - 마이페이지(/my) → 좌측 또는 상단 "프로필 편집" → 관심 태그를 카테고리별로 풍부하게 등록(최대 10개) + 한 줄 소개 채우기.
5) **활동 끝났을 때 리뷰 작성**
   - 종료된 게시글(/posts/:id) → 하단 리뷰 섹션 → 멤버별로 5개 항목 별점. 평균이 매너 온도에 반영됨 (delta = (avg-3.0) × 0.5°C).
6) **다른 사람한테 메시지 보내기**
   - 사용자 프로필(/users/:id) → 우측 "쪽지 보내기". 또는 받은 쪽지함(/messages)에서 답장.

[자주 묻는 도메인 예시 — 학과/직군 무관 패턴 동일]
- "무용과인데 같이 연습할 사람" → 검색창에 "발레"/"컨템포러리"/"무용" → AI 검색 토글로 확장 → 마이페이지 AI 추천.
- "직장인인데 평일 저녁 스터디" → 검색창에 "평일 저녁"/"직장인 스터디" → 스터디 카테고리에서 상태 필터 "모집중".
- "졸업 작품 발표회 도와줄 학생" → 프로젝트 카테고리 → "학과 연합"/"발표 준비" 태그 필터 → 안 보이면 AI 검색.
- "재테크 정보 찾고 싶음" → 커뮤니티 → "정보공유" 하위 카테고리 → 검색창에 "투자/재테크".
- "내가 작성한 글에 좋은 팀원" → 본인 게시글 상세 페이지 들어가서 "AI 멤버 추천" 패널 사용.

[답변 스타일]
- 한국어, 친근하고 구체적으로. 추상적인 답변 X — 어떤 페이지에서 어떤 버튼을 누를지 명시.
- 단계별로: "1단계 ~ 2단계 ~ 그래도 안 되면 ~" 형식이 좋음.
- 본문 길이: 핵심만 4~8 문장, 단계가 많으면 짧은 번호 리스트로.
- 모르거나 확실하지 않으면 "확실하지 않습니다"라고 솔직히. 외부 URL/이메일 추측해서 만들지 말 것.
- 사용자가 현재 보고 있는 페이지 정보가 주어지면 그 페이지에서 가능한 액션부터 우선 안내. 다음 단계를 명확히.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { message, route, history } = (await req.json()) as Body
    if (!message?.trim()) return jsonResponse({ error: 'message is required' }, 400)
    if (message.length > 2000) return jsonResponse({ error: 'message too long' }, 400)

    const matched = route ? ROUTE_HELP.find((r) => r.match.test(route)) : null
    const routeContext = matched
      ? `현재 사용자는 "${matched.label}" 페이지(${route})에 있습니다.\n페이지 안내: ${matched.help}`
      : route
        ? `현재 사용자는 ${route} 페이지에 있습니다.`
        : '현재 페이지 정보 없음.'

    const reply = await generateText(message.trim(), {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\n[페이지 컨텍스트]\n${routeContext}`,
      history: (history ?? []).slice(-10),
      temperature: 0.5,
    })

    return jsonResponse({ reply })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'unknown error' }, 500)
  }
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
