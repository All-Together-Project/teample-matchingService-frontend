# 프로젝트 개요: 서버리스 기반 통합 매칭 플랫폼 ("AllTogether")

본 프로젝트는 React + Supabase 서버리스 아키텍처로 구성된 **스터디·프로젝트·모임·커뮤니티 통합 매칭 플랫폼**입니다. 별도 백엔드 서버 없이 Supabase의 Auth, PostgreSQL, Storage, Edge Functions를 직접 호출합니다. AI 기능(자연어 검색, 맞춤 추천)은 Gemini API + pgvector로 구현되어 있습니다.

> **버전 v2.x — 마이그레이션 0017까지 적용됨 (pgvector + AI 검색/추천 활성)**

## 1. 기술 스택 및 프론트엔드 개발 원칙 **[필독]**
* **Frontend:** React 18, TypeScript, Vite, **CSS Modules** (`*.module.css`)
* **Backend/BaaS:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
* **State Management:** Zustand (auth/UI), TanStack Query (server state)
* **Forms/Validation:** react-hook-form + zod
* **AI:** Gemini API
  - `gemini-embedding-001` (768 dim) — 게시글/쿼리 임베딩
  - `gemini-2.5-flash-lite` (JSON mode) — 추천 이유 생성, 재태깅 스크립트
* **Vector Search:** Supabase pgvector (IVFFlat 코사인 인덱스)
* **서버리스 아키텍처 준수:** 백엔드 API를 별도로 만들지 않고, Supabase SDK(`@supabase/supabase-js`)를 활용하여 프론트엔드에서 데이터를 직접 CRUD 합니다. AI 호출은 Edge Functions(Deno)에서 service-role 권한으로 수행.
* **보안 및 인증:** 모든 데이터 통신은 Supabase Auth(JWT 자동 갱신, storageKey: `all-together-auth`) 기반으로 이루어지며, 모든 테이블에 RLS(Row Level Security)가 활성화되어 있습니다.
* **엄격한 코드 수정 통제:** 요구된 UI 컴포넌트와 기능 외에 불필요한 주석 추가나 기존 코드를 임의로 변경하는 것을 절대 금지합니다. 정확히 지시된 로직만 작성하세요.
* **신뢰도 시스템:** 매너 온도(default `36.5°C`)만 사용. 별도 티어(ROOKIE/BRONZE/...) 체계 도입 금지. 리뷰 가중치는 `delta = (avg_score - 3.0) × 0.5`, [0, 99.9] 클램프.
* **역할 시스템:** `post_members.role`은 자유 텍스트(string). 카테고리별로 유연하게 부여(예: 스터디=스터디장/멤버/튜터, 프로젝트=리더/개발자/디자이너, 모임=모임장/멤버). 게시글 작성 시 `post_roles` 테이블에 역할별 정원(capacity)을 설정 가능, DB 트리거로 capacity 강제.

## 2. 서비스 카테고리 구조

| 대분류 | 라우트 | 하위 카테고리 |
|---|---|---|
| **스터디** | `/study` | 어학, 자격증/시험, 독서, 코딩/개발, 기타 학습 |
| **프로젝트** | `/project` | 개발, 디자인, 공모전, 창업/사이드, 기타 협업 |
| **모임** | `/meetup` | 운동/스포츠, 취미/문화, 네트워킹, 밥약/번개, 기타 모임 |
| **커뮤니티** | `/community` | 자유게시판, 후기, Q&A, 정보공유, 공지사항 |

`SUB_CATEGORIES` 상수 (`src/types/index.ts`)에 정의되어 있으며 폼/필터에서 동일하게 참조.

## 3. 데이터베이스 스키마 (마이그레이션 0001 → 0017 누적)

### 3-1. 사용자 관련

* **users** (auth.users 와 1:1 — `handle_new_user` 트리거로 자동 생성)
  * `id` (UUID, PK), `email`, `nickname`, `major`, `profile_url`, `introduction`
  * `temperature` (Float, default 36.5)
  * `created_at`

* **tags / user_tags / post_tags**
  * `tags`: `id`, `name`, `category` (STUDY/PROJECT/MEETUP/GENERAL)
  * 인증된 사용자가 사용자 정의 태그 생성 가능 (마이그레이션 0007, RLS `tags_insert_authenticated`)

### 3-2. 게시글 관련

* **posts** — 4개 카테고리 통합 게시글
  * `id`, `category`, `sub_category`, `title`, `content`
  * `capacity`, `current_member_count`, `status` (RECRUITING/COMPLETE/FINISHED/GENERAL)
  * `period`, `deadline`, `author_id`, `created_at`
  * `view_count` (마이그레이션 0010)
  * `embedding vector(768)` (마이그레이션 0017, IVFFlat 코사인 인덱스)

* **post_roles** (마이그레이션 0006) — 게시글별 역할 정원
  * `id`, `post_id`, `name`, `capacity`, `sort_order`
  * `applications.role_id`, `post_members.role_id` 컬럼 추가
  * 트리거 `applications_check_role_capacity` — 정원 초과 지원 차단
  * 뷰 `post_roles_with_count` — 역할별 현재 인원 집계

* **post_members** — 작성자는 게시글 INSERT 시 자동 추가 (마이그레이션 0013, 카테고리별 기본 역할명 부여, COMMUNITY 제외)
  * 트리거 `applications_on_accepted` — 승인 시 자동 멤버 등록
  * 트리거 `post_members_count_sync` — `posts.current_member_count` 자동 동기화 (마이그레이션 0011), 정원 도달 시 RECRUITING → COMPLETE 자동 전환

* **applications** — `id`, `post_id`, `user_id`, `role_id?`, `introduction`, `status`, `created_at`

* **comments** — `parent_id` 1단계 답글 지원

### 3-3. 리뷰 시스템 (이중 구조)

**(A) 사용자 대상 리뷰** (마이그레이션 0001/0003) — 매너 온도에 반영
* `review_items` — 카테고리별(STUDY/PROJECT/MEETUP) 5개 항목 시드
* `reviews` — 평가자 → 대상 사용자
* `review_scores` — 항목별 1~5점
* RPC `apply_review_temperature(p_review_id)` (마이그레이션 0009) — 평균 점수 기반 온도 자동 변동

**(B) 게시글 자체 리뷰** (마이그레이션 0016) — 프로젝트/스터디/모임 자체에 대한 평가
* `project_review_items` — 카테고리별 5개 항목 시드 (예: 진행도/완성도, 학습 효과 등)
* `project_reviews` — 평가자당 게시글 1회 (작성자 본인 작성 불가)
* `project_review_scores`
* RPC `project_review_summary_for_post`, `leader_project_summary`

**카테고리별 사용자 리뷰 항목 (참고):**

| 프로젝트 | 스터디 | 모임 |
|---|---|---|
| 전문성 | 성실도 | 매너 |
| 소통 능력 | 참여도 | 시간 약속 |
| 시간 약속 | 소통 능력 | 분위기 기여 |
| 협동심 | 지식 공유 | 재참여 의사 |
| 열정 | 시간 약속 | 소통 |

### 3-4. 메시지 (마이그레이션 0008)

* **messages** — `sender_id` (NULL 가능, SYSTEM 메시지용), `receiver_id`, `content`, `is_read`, `type` (PERSONAL/SYSTEM), `created_at`
* 자동 발송 트리거:
  * `notify_post_author_on_application` — 지원 도착 알림
  * `notify_applicant_on_decision` — 승인/거절 알림
  * `notify_members_on_finish` — 게시글 종료 알림 + 리뷰 작성 안내

### 3-5. 첨부파일 (마이그레이션 0015)

* Storage 버킷:
  * `post-files` (public) — 게시글 첨부
  * `application-files` (private, 1시간 signed URL) — 지원서 포트폴리오/이력서 등
* 테이블 `post_attachments`, `application_attachments`
* RLS: 게시글 첨부는 작성자만 추가/삭제, 지원 첨부는 업로더 + 게시글 작성자만 열람

### 3-6. 검색·트렌딩 (마이그레이션 0012, 0014)

* `search_terms (term, count, last_searched_at)` + RPC `record_search`, `trending_searches` (최근 7일)
* RPC `popular_tags(limit)` — `post_tags` 사용량 기반

## 4. AI 기능 명세 (Edge Functions)

`all-together/supabase/functions/` 에 Deno 런타임 Edge Function 3개 + 공용 모듈.

### 4-1. embed-post
* 트리거: 게시글 생성/수정 시 프론트에서 fire-and-forget 호출 (`postApi.embedPost`)
* 동작: 작성자 인증 → `title + content`를 `gemini-embedding-001` (RETRIEVAL_DOCUMENT, 768 dim, 8000자 슬라이스)로 임베딩 → `posts.embedding` 저장 (service role)

### 4-2. semantic-search
* 호출: `postApi.semanticSearch(query)` (`/search?ai=1` 모드)
* 동작: 쿼리를 `gemini-embedding-001` (RETRIEVAL_QUERY)로 임베딩 → RPC `match_posts(embedding, count, threshold, category?, status?, sub_category?)` 코사인 유사도 검색 → 작성자 + 태그 조인하여 반환

### 4-3. ai-recommend
* 호출: `recommendApi.recommendProjects(prompt)` / `recommendApi.recommendMembers(postId, prompt)`
* 두 모드:
  * `project` — 프롬프트 임베딩 → `match_posts` → 결과별 "추천 이유" 일괄 생성 (`gemini-2.5-flash-lite`, JSON 응답)
  * `member` — 게시글 작성자만 호출 가능. `user_tags` 기반 후보 수집, 부족 시 매너 온도 높은 사용자로 보충 → 일괄 추천 이유 생성

### 4-4. 공용 모듈 (`_shared/`)
* `gemini.ts`: `embedText(text, taskType)`, `generateJSON<T>(prompt, opts)` (responseMimeType=application/json 강제)
* `cors.ts`: 모든 Edge Function 공통 CORS 헤더

### 4-5. 백필 스크립트 (`all-together/scripts/`)
* `backfill-embeddings.mjs` — `posts_missing_embedding` 뷰 기반 누락분 일괄 임베딩 (1100ms throttle)
* `retag-posts.mjs` — Gemini로 모든 게시글의 sub_category + 태그(3~5개)를 재분류 (4500ms throttle, 기존 tags만 사용)

## 5. 화면 구성 (실제 라우트)

`src/App.tsx` 기준 실제 매핑:

| 경로 | 페이지 | 인증 | 비고 |
|---|---|---|---|
| `/` | LandingPage | - | 히어로 + 카테고리 카드 + 인기/최신 게시글 + 인기 태그 + AdvancedSearchPanel |
| `/login` | LoginPage | - | zod 검증 |
| `/signup` | SignupPage | - | 비밀번호 강도 정책 |
| `/signup/profile` | ProfileSetupPage | ✅ | 한 줄 소개·전공·관심 카테고리·태그 (10개 한도) |
| `/study`, `/project`, `/meetup`, `/community` | CategoryPage | ✅ | 하위 카테고리 탭 + 상태 탭 + 페이지네이션 |
| `/:category/new` | ProjectCreatePage | ✅ | ProjectForm (4 카테고리 공통) |
| `/posts/:id` | ProjectDetailPage | ✅ | view_count 자동 증가, 지원 모달, 리뷰 섹션, 댓글, AI 멤버 추천 (작성자) |
| `/posts/:id/edit` | ProjectEditPage | ✅ | |
| `/projects`, `/projects/:id`, `/projects/:id/edit` | (legacy aliases) | ✅ | v1 URL 호환 |
| `/my` | MyPage | ✅ | 탭: 내 게시글 / 지원 (했/받) / 진행·종료 프로젝트 / AI 추천 / 받은 리뷰 (개인·게시글) |
| `/my/edit` | MyEditPage | ✅ | 프로필 편집 + 4개 카테고리 태그 picker + 사용자 태그 생성 |
| `/users/:id` | UserProfilePage | ✅ | 매너 온도, 리뷰 요약, 쪽지 발송 |
| `/applications` | ApplicationListPage | ✅ | 내가 지원한 / 받은 지원서 탭 |
| `/messages` | MessagePage | ✅ | 받은/보낸 + ComposeMessageModal |
| `/search` | SearchPage | ✅ | 키워드 + 필터 + AI 모드 토글 (`?ai=1`), URL 동기화 |
| `*` | NotFoundPage | - | |

### 5-1. Header (메가 메뉴)
* 좌: 🤝 AllTogether
* 중: 4개 메뉴 호버 시 메가 메뉴 (좌 하위 카테고리, 우 추천 게시글)
* 우: 로그인 / 사용자 드롭다운 + 안 읽은 쪽지 뱃지

### 5-2. 공용 컴포넌트
* `common/Pagination.tsx` — 0-indexed, 단일 페이지면 null 반환
* `common/Badge.tsx` — `TempBadge` (온도 색상), `StatusBadge`
* `common/TagChip.tsx`
* `search/AdvancedSearchPanel.tsx` — popover (카테고리·상태·태그 다중) — Landing/Search 공용
* `recommend/AIRecommendPanel.tsx` — 프롬프트 기반 프로젝트/멤버 추천
* `matching/ApplyModal.tsx` — 정원 가득 찬 역할 자동 비활성화, 첨부 5개·각 10MB 한도
* `matching/{MyApplications,ReceivedApplications,ApplicationAttachmentList}.tsx`
* `review/{ReviewModal,ReviewSummaryCard,ProjectReviewModal,ProjectReviewSection}.tsx`

## 6. API Facade (`src/api/index.ts`) — 도메인별

| 그룹 | 주요 함수 |
|---|---|
| `authApi` | `login`, `signup`, `me`, `logout`, `getSession` |
| `userApi` | `getProfile`, `updateProfile`, `updateTags`, `getRecommendedPosts` (RPC `recommend_posts_for_user`) |
| `searchApi` | `recordSearch`, `getTrending` (RPC `record_search`, `trending_searches`) |
| `attachmentApi` | `uploadPostFile/deletePostFile`, `uploadApplicationFile/deleteApplicationFile`, `getApplicationFileUrl` (signed URL 1h) |
| `tagApi` | `getAll`, `getByCategory`, `getPopular` (RPC `popular_tags`), `upsert` |
| `postApi` | `getList`, `getDetail`, `incrementView`, `getPopular` (RPC `popular_posts`), `create/update/delete`, `updateStatus`, `getMyPosts`, `getMemberPosts`, `getMembers`, `getRecommendedMembers`, `semanticSearch` (Edge), `embedPost` (Edge, fire-and-forget) |
| `recommendApi` | `recommendProjects`, `recommendMembers` (Edge `ai-recommend`) |
| `applicationApi` | `apply` (`role_id?`), `getMyApplications`, `getPostApplications`, `getReceivedApplications`, `approve`, `reject` |
| `reviewApi` | `getItems`, `getMyReviewsForPost`, `create` (+ RPC `apply_review_temperature`), `getUserReviews`, `getUserSummary` (RPC) |
| `projectReviewApi` | `getItems`, `getMyForPost`, `getForPost`, `getSummaryForPost`, `getLeaderSummary`, `getLeaderReviews`, `create` |
| `messageApi` | `send`, `sendByEmail`, `getInbox`, `getSent`, `getUnreadCount`, `markRead` |
| `commentApi` | `getList`, `create`, `delete` |
| `projectApi` | `postApi` 별칭 (back-compat) |

## 7. 구현 로드맵 (실제 진행)

### Phase 1 — 기본 구조 ✅ 완료
- [x] React + TypeScript + Vite + CSS Modules
- [x] `@supabase/supabase-js` 클라이언트
- [x] 통합 Posts 타입 모델
- [x] API facade를 Supabase SDK 호출로 전환
- [x] Zustand auth store + 세션 동기화
- [x] 메가 메뉴 헤더, 메인/카테고리/로그인 UI

### Phase 2 — Supabase 연동 & 핵심 기능 ✅ 완료
- [x] DB 마이그레이션 0001~0004 (스키마, RLS, RPC, 리뷰 시드)
- [x] 회원가입/로그인 (Supabase Auth) + 프로필 3-step
- [x] 4개 카테고리 게시글 CRUD
- [x] 지원/모집 시스템 (post_roles capacity 트리거 포함, 0006)
- [x] 사용자 정의 태그 (0007)
- [x] 시스템 쪽지 자동 발송 (0008)
- [x] 작성자 자동 멤버 등록 (0013)

### Phase 3 — 리뷰 & 매너 온도 ✅ 완료
- [x] 카테고리별 리뷰 항목 UI 분기
- [x] 사용자 리뷰 작성/조회 (`reviews`, `review_scores`)
- [x] 매너 온도 자동 갱신 RPC (`apply_review_temperature`, 0009)
- [x] 게시글 자체 리뷰 (`project_reviews`, 0016) + 리더 요약
- [x] `ReviewSummaryCard` 동적 항목 렌더링

### Phase 4 — AI 기능 ✅ 적용
- [x] pgvector 활성화, 게시글 768차원 임베딩 컬럼 (0017)
- [x] Edge Function `embed-post` — 게시글 임베딩 자동 생성
- [x] Edge Function `semantic-search` — 자연어 검색
- [x] Edge Function `ai-recommend` — 프로젝트/멤버 추천 + 추천 이유 생성
- [x] 백필 스크립트 (`backfill-embeddings.mjs`, `retag-posts.mjs`)
- [x] `/search?ai=1` AI 모드, MyPage AI 추천 탭

### 부가 기능 (PRD v1 외 추가)
- [x] 조회수 (`view_count`, 0010) + 인기 게시글 RPC
- [x] 인기/트렌딩 검색어 (0012, 0014)
- [x] 첨부파일 시스템 (Storage 2 버킷 + 0015)
- [x] 페이지네이션 컴포넌트 + 모든 리스트 페이지 적용
- [x] AdvancedSearchPanel (Landing/Search 공용)
