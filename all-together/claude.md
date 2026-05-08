# 프로젝트 개요: 서버리스 기반 스터디 및 모임 매칭 플랫폼 ("AllTogether")

본 프로젝트는 React와 Supabase를 활용한 서버리스(Serverless) 아키텍처로 구성된 **스터디, 프로젝트, 모임 매칭 플랫폼**입니다. 개발자뿐 아니라 어학, 자격증, 취미, 운동 등 다양한 분야의 사람들이 함께할 팀원을 찾고 모임을 만들 수 있는 광범위한 매칭 서비스입니다. 기존 백엔드 서버 없이 Supabase의 Auth, Database(PostgreSQL), Storage를 직접 호출하여 사용합니다.

## 1. 기술 스택 및 프론트엔드 개발 원칙 **[필독]**
* **Frontend:** React 18, TypeScript, Vite, **CSS Modules** (`*.module.css`)
* **Backend/BaaS:** Supabase (PostgreSQL, Auth, Storage)
* **State Management:** Zustand (auth/UI), TanStack Query (server state)
* **Forms/Validation:** react-hook-form + zod
* **AI:** Gemini API (무료 티어) — 자연어 검색, 맞춤 추천
* **Vector Search:** Supabase pgvector — 게시글 임베딩 기반 유사 검색
* **서버리스 아키텍처 준수:** 백엔드 API를 별도로 만들지 않고, Supabase SDK(`@supabase/supabase-js`)를 활용하여 프론트엔드에서 데이터를 직접 CRUD 합니다.
* **보안 및 인증:** 모든 데이터 통신은 Supabase Auth(JWT 자동 갱신) 기반으로 이루어지며, 모든 테이블에 RLS(Row Level Security)를 활성화합니다.
* **엄격한 코드 수정 통제:** 요구된 UI 컴포넌트와 기능 외에 불필요한 주석 추가나 기존 코드를 임의로 변경하는 것을 절대 금지합니다. 정확히 지시된 로직만 작성하세요.
* **신뢰도 시스템:** 매너 온도(default `36.5°C`)만 사용. 별도 티어(ROOKIE/BRONZE/...) 체계 도입 금지.
* **역할 시스템:** `post_members.role`은 자유 텍스트(string). 카테고리별로 유연하게 부여(예: 스터디=스터디장/멤버/튜터, 프로젝트=리더/개발자/디자이너, 모임=모임장/멤버).

## 2. 서비스 카테고리 구조

플랫폼은 4개의 대분류와 각각의 하위 카테고리로 구성됩니다.

| 대분류 | 라우트 | 하위 카테고리 |
|---|---|---|
| **스터디** | `/study` | 어학, 자격증/시험, 독서, 코딩/개발, 기타 학습 |
| **프로젝트** | `/project` | 개발, 디자인, 공모전, 창업/사이드, 기타 협업 |
| **모임** | `/meetup` | 운동/스포츠, 취미/문화, 네트워킹, 밥약/번개, 기타 모임 |
| **커뮤니티** | `/community` | 자유게시판, 후기, Q&A, 정보공유, 공지사항 |

## 3. 데이터베이스 스키마 설계 (Supabase / Relational DB)

### 3-1. 사용자 관련

* **Users (사용자)**
  * `id` (UUID, PK) - Supabase Auth와 연동
  * `email` (String, Unique)
  * `nickname` (String)
  * `major` (String)
  * `profile_url` (String)
  * `introduction` (Text)
  * `temperature` (Float, default 36.5) - 매너 온도, 리뷰 점수 기반으로 변동
  * `created_at` (Timestamp)

* **Tags & Mapping (관심사 태그)**
  * `tags`: `id`, `name`, `category` (STUDY, PROJECT, MEETUP, GENERAL)
  * `user_tags`: `user_id`, `tag_id`
  * `post_tags`: `post_id`, `tag_id`

### 3-2. 게시글 관련

* **Posts (통합 게시글)** — 기존 Projects를 확장하여 모든 카테고리의 게시글을 통합 관리
  * `id` (BigInt, PK)
  * `category` (Enum: STUDY, PROJECT, MEETUP, COMMUNITY)
  * `sub_category` (String) - 하위 카테고리 (어학, 개발, 운동 등)
  * `title` (String)
  * `content` (Text)
  * `capacity` (Int, Nullable) - 모집 정원 (커뮤니티 글은 null)
  * `current_member_count` (Int, default 0)
  * `status` (Enum: RECRUITING, COMPLETE, FINISHED, GENERAL)
  * `period` (String, Nullable) - 예상 진행 기간
  * `deadline` (Timestamp, Nullable) - 모집 마감일
  * `author_id` (UUID, FK -> Users)
  * `created_at` (Timestamp)
  * `embedding` (vector, Nullable) - AI 검색용 벡터 임베딩

* **Post_Members (참여 확정 멤버)**
  * `id` (BigInt, PK)
  * `post_id` (BigInt, FK -> Posts)
  * `user_id` (UUID, FK -> Users)
  * `role` (String) - 모임 유형에 따라 유연하게 (리더, 멤버, 개발자, 디자이너 등)

* **Applications (지원서)**
  * `id` (BigInt, PK)
  * `post_id` (BigInt, FK -> Posts)
  * `user_id` (UUID, FK -> Users)
  * `introduction` (Text) - 지원 동기
  * `status` (Enum: PENDING, ACCEPTED, REJECTED)
  * `created_at` (Timestamp)

* **Comments (댓글)**
  * `id` (BigInt, PK)
  * `post_id` (BigInt, FK -> Posts)
  * `user_id` (UUID, FK -> Users)
  * `content` (Text)
  * `parent_id` (BigInt, FK -> Comments, Nullable) - 대댓글
  * `created_at` (Timestamp)

### 3-3. 리뷰 시스템 (모임 유형별 맞춤 평가)

카테고리별로 평가 항목이 다르게 적용됩니다.

* **Review_Items (평가 항목 템플릿)**
  * `id` (BigInt, PK)
  * `category` (Enum: STUDY, PROJECT, MEETUP) - 커뮤니티는 리뷰 없음
  * `item_name` (String) - 평가 항목명
  * `sort_order` (Int) - 표시 순서

**카테고리별 기본 평가 항목:**

| 프로젝트 | 스터디 | 모임 |
|---|---|---|
| 전문성 | 성실도 | 매너 |
| 소통 능력 | 참여도 | 시간 약속 |
| 시간 약속 | 소통 능력 | 분위기 기여 |
| 협동심 | 지식 공유 | 재참여 의사 |
| 열정 | 시간 약속 | 소통 |

* **Reviews (평가)**
  * `id` (BigInt, PK)
  * `post_id` (BigInt, FK -> Posts)
  * `evaluator_id` (UUID, FK -> Users) - 평가하는 사람
  * `target_id` (UUID, FK -> Users) - 평가받는 사람
  * `comment` (Text) - 한줄 평
  * `created_at` (Timestamp)

* **Review_Scores (개별 항목 점수)**
  * `id` (BigInt, PK)
  * `review_id` (BigInt, FK -> Reviews)
  * `item_id` (BigInt, FK -> Review_Items)
  * `score` (Int, 1~5)

**온도 시스템:** 리뷰 점수의 가중 평균을 기반으로 Users.temperature가 변동됩니다. 팀장이 지원자를 검토할 때 매너 온도를 참고 지표로 활용할 수 있습니다.

### 3-4. 메시지

* **Messages (쪽지)**
  * `id` (BigInt, PK)
  * `sender_id` (UUID, FK -> Users)
  * `receiver_id` (UUID, FK -> Users)
  * `content` (Text)
  * `is_read` (Boolean, default false)
  * `created_at` (Timestamp)

## 4. AI 기능 명세

### 4-1. AI 검색 (서비스 내 게시글/정보 검색)
사용자의 자연어 질문을 이해하여 서비스 내 관련 게시글과 정보를 찾아주는 기능.
* **구현 방식:** Supabase pgvector + Gemini Embedding API
* **동작:** 게시글 작성 시 임베딩 벡터 생성 → 사용자 질문을 벡터로 변환 → 코사인 유사도 검색
* **예시:** "정처기 스터디 있어?" → 관련 스터디 게시글 목록 반환

### 4-2. AI 맞춤 추천 (나에게 맞는 스터디/프로젝트/모임 추천)
사용자의 프로필, 관심 태그, 활동 이력, 매너 온도를 기반으로 적합한 모임을 추천.
* **Phase 1 (태그 기반):** 사용자 관심 태그와 겹치는 모집중 게시글 우선 노출 — AI 불필요, 무료
* **Phase 2 (AI 도입):** Gemini 무료 API로 자연어 검색 + pgvector 유사 게시글 추천
* **Phase 3 (고도화):** 활동 이력 + 온도 기반 정밀 매칭, "이 스터디를 추천하는 이유" AI 설명

## 5. 화면 구현 명세

### 5-1. 공통 컴포넌트: Header (메가 메뉴)
* **로고(좌측):** "🤝 AllTogether"
* **메뉴(중앙):** "스터디", "프로젝트", "모임", "커뮤니티" — 각 메뉴 호버 시 메가 메뉴 드롭다운
* **메가 메뉴 구성:** 좌측에 하위 카테고리 목록 (아이콘+이름+설명), 우측에 추천 게시글 미리보기
* **유저 메뉴(우측 끝):** "로그인" 버튼 (로그인 후 프로필)

### 5-2. 메인 페이지 (/) — 대시보드
* **히어로 배너:** 보라색 그라데이션, "함께할 사람을 찾아보세요!" 슬로건, 검색바 포함
* **빠른 카테고리:** 스터디/프로젝트/모임/커뮤니티 4개 바로가기 카드
* **인기 게시글:** 카테고리 무관, 가로 스크롤 카드 형태
* **최신 게시글:** 전체 카테고리 통합 리스트 (좌측 2/3)
* **인기 태그:** 태그 클라우드 (우측 1/3)

### 5-3. 카테고리 페이지 (/study, /project, /meetup, /community)
* **카테고리 제목 + 설명**
* **태그 필터 바:** 하위 카테고리를 가로 스크롤 버튼으로 필터링
* **글쓰기 버튼**
* **게시글 리스트:** 모집 상태 뱃지, 제목, 작성자, 시간, 태그

### 5-4. 로그인 페이지 (/login)
* **전체 구조:** 중앙 2단 분할 (좌측: 폼, 우측: 이미지 플레이스홀더)
* **좌측 폼:** 큰 제목 "AllTogether!", "아이디", "비밀번호" 입력창, 보라색 "로그인" 버튼, 하단 "아직 계정이 없다면? 회원가입" 링크
* **우측 영역:** "캐릭터 or 로고" 텍스트가 중앙에 있는 큰 사각형 플레이스홀더

## 6. 구현 로드맵

### Phase 1 — 기본 구조 (현재 완료)
- [x] React + TypeScript + Vite + CSS Modules 프로젝트 초기화
- [x] `@supabase/supabase-js` 클라이언트 설정 (`src/api/client.ts`)
- [x] 통합 Posts 타입 모델 정리 (`src/types/index.ts`)
- [x] API facade를 Supabase SDK 호출로 전환 (`src/api/index.ts`)
- [x] Zustand auth store + Supabase 세션 동기화
- [x] 메가 메뉴 헤더, 메인 페이지, 카테고리 페이지, 로그인 페이지 UI

### Phase 2 — Supabase 연동 & 핵심 기능
- [ ] Supabase 프로젝트 생성 및 `.env`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정
- [ ] DB 테이블 생성 (SQL 마이그레이션)
- [ ] RLS 정책 설정
- [ ] 회원가입/로그인 화면을 Supabase Auth와 연결
- [ ] 게시글 CRUD 화면 — 4개 카테고리 라우팅
- [ ] 지원/모집 시스템
- [ ] 태그 기반 추천 (Phase 1 AI — AI 없이)

### Phase 3 — 리뷰 & 온도 시스템
- [ ] 모임 유형별 맞춤 평가 항목 UI
- [ ] 리뷰 작성/조회
- [ ] 온도 자동 계산 로직
- [ ] 지원자 프로필에 온도 표시

### Phase 4 — AI 기능 도입
- [ ] Gemini API 연동
- [ ] pgvector 설정 및 게시글 임베딩
- [ ] AI 자연어 검색 기능
- [ ] AI 맞춤 추천 기능
- [ ] AI 추천 이유 설명
