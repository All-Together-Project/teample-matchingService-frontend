# ALL 투게더 — Product Requirements Document (PRD)

> **버전** v2.5 (구현 반영) | **작성일** 2026-05-09 | **상태** Implementation-aligned
> v2.0(2026-05-08) → v2.5: 마이그레이션 0006~0017 추가 기능 반영. AI(Gemini + pgvector)·역할 정원·시스템 쪽지·조회수·인기 검색어·게시글 자체 리뷰·첨부파일을 모두 명세에 통합.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [사용자 정의](#2-사용자-정의)
3. [기능 명세](#3-기능-명세)
   - 3.1 회원 및 인증 관리
   - 3.2 게시글(Post) 관리 — 4개 카테고리
   - 3.3 매칭/지원 시스템 (역할 정원 포함)
   - 3.4 리뷰 시스템 (이중 구조)
   - 3.5 소통 및 알림 (쪽지)
   - 3.6 댓글
   - 3.7 검색 및 AI 추천 (Gemini + pgvector)
   - 3.8 첨부파일
4. [데이터 액세스 설계 (Supabase)](#4-데이터-액세스-설계-supabase)
5. [화면별 기능 정의](#5-화면별-기능-정의)
6. [데이터 모델](#6-데이터-모델)
7. [비기능 요구사항](#7-비기능-요구사항)
8. [구현 로드맵](#8-구현-로드맵)

---

## 1. 프로젝트 개요

### 서비스 소개

**ALL 투게더**는 스터디·프로젝트·모임·커뮤니티를 한 곳에서 매칭·운영할 수 있는 통합 플랫폼입니다. 매너 온도, AI 자연어 검색, 카테고리별 맞춤 리뷰를 통해 신뢰도 높은 매칭 경험을 제공합니다.

### 핵심 가치

| 가치 | 설명 |
| --- | --- |
| 통합 | 4개 대분류(스터디/프로젝트/모임/커뮤니티)를 통합 게시글 모델로 운영 |
| 신뢰 | 매너 온도(36.5°C 기본) + 카테고리별 평가 항목 기반 신뢰도 |
| 효율 | Gemini 자연어 검색 + pgvector 유사 게시글/멤버 추천 |
| 소통 | 댓글·쪽지·시스템 알림으로 끊김 없는 커뮤니케이션 |

### 기술 스택

| 구분 | 기술 |
| --- | --- |
| 프론트엔드 | React 18, TypeScript, Vite, Zustand, TanStack Query, react-hook-form, zod, CSS Modules |
| 백엔드(BaaS) | Supabase (PostgreSQL, Auth, Storage, Edge Functions / Deno) — 서버리스 |
| AI | Gemini API — `gemini-embedding-001` (768 dim) 임베딩, `gemini-2.5-flash-lite` (JSON) 추천 이유 생성 |
| Vector | Supabase pgvector — 게시글 임베딩·코사인 유사도 (IVFFlat 인덱스) |
| 인증 | Supabase Auth (이메일/비밀번호, JWT 자동 갱신, storageKey `all-together-auth`) |

> **서버리스 원칙**: 별도 백엔드 API를 두지 않고 `@supabase/supabase-js` SDK를 프론트에서 직접 호출. AI 호출만 Edge Functions(service-role)에서 수행. 권한은 Supabase RLS로 통제.

---

## 2. 사용자 정의

### 사용자 유형

| 유형 | 설명 |
| --- | --- |
| 비로그인 사용자 | 랜딩, 게시글 목록/상세 열람 가능 |
| 일반 회원 | 게시글 작성, 지원, 댓글, 쪽지, 리뷰 작성 |
| 게시글 작성자(리더/모임장) | 자신의 게시글 수정/삭제, 지원 승인·거절, AI 멤버 추천 사용 |

### 역할(Role)

* 카테고리별 자유 입력. 고정된 enum을 두지 않음.
* `post_members.role`은 자유 텍스트 저장.
* 게시글 작성 시 `post_roles` 테이블에 역할 정의(`name`, `capacity`, `sort_order`) 가능. 트리거가 정원 초과 지원을 차단.
* 게시글 INSERT 시 작성자는 `post_members`에 자동 등록 (카테고리별 기본 역할명: 스터디=스터디장, 프로젝트=리더, 모임=모임장, 커뮤니티 제외).

| 카테고리 | 역할 예시 |
| --- | --- |
| STUDY | 스터디장, 멤버, 튜터, 청강 |
| PROJECT | 리더, 개발자, 디자이너, 기획자, 데이터, 마케팅 |
| MEETUP | 모임장, 멤버 |
| COMMUNITY | (역할 없음) |

### 신뢰도 — 매너 온도

- 가입 시 `temperature = 36.5`
- 사용자 리뷰 등록 후 RPC `apply_review_temperature(p_review_id)` 자동 호출 → `delta = (avg_score - 3.0) × 0.5`, [0, 99.9] 클램프
- 티어 체계 미사용. 지원자 검토 시 매너 온도를 참고 지표로 노출.

---

## 3. 기능 명세

### 3.1 회원 및 인증 관리

#### 3.1.1 회원가입
| 항목 | 내용 |
| --- | --- |
| 인증 방식 | Supabase Auth (이메일/비밀번호) |
| 입력 필드 | 이메일, 비밀번호, 닉네임 |
| 비밀번호 정책 | 최소 8자, 영문 + 숫자 + 특수문자 강제 (zod regex) |
| 후속 동작 | `auth.users` INSERT → 트리거 `handle_new_user` 가 `public.users` row 자동 생성 → `/signup/profile`로 이동 |

#### 3.1.2 로그인
- 세션은 localStorage (`storageKey: all-together-auth`)
- `autoRefreshToken: true`
- `onAuthStateChange`로 Zustand store 동기화

#### 3.1.3 프로필 설정 (`/signup/profile`, 3-step)
| Step | 입력 |
| --- | --- |
| 1 | 한 줄 소개(최대 80자), 전공, 소속 |
| 2 | 활동 카테고리 (STUDY/PROJECT/MEETUP 복수 선택) |
| 3 | 관심 태그 — 4개 카테고리(STUDY/PROJECT/MEETUP/GENERAL) 그룹에서 최대 10개. 태그 미존재 시 인증된 사용자가 자체 생성 가능 (마이그레이션 0007 RLS) |

선택한 태그는 추천 가중치(태그 매칭 + AI 임베딩)에 활용.

#### 3.1.4 마이페이지 (`/my`)
탭 구조:
| 탭 | 내용 |
| --- | --- |
| 내 게시글 | 작성한 모든 카테고리 게시글 (페이지네이션) |
| 지원 (한/받은) | `MyApplications`, `ReceivedApplications` 컴포넌트 — 받은 지원서는 승인/거절 |
| 프로젝트 | 진행 중 / 종료된 참여 게시글 (`getMemberPosts`) |
| AI 추천 | 프롬프트 입력 → `recommendApi.recommendProjects` → 게시글 + 추천 이유 |
| 받은 리뷰 | 사용자 리뷰 요약 + 게시글(리더) 리뷰 요약 |

#### 3.1.5 프로필 편집 (`/my/edit`)
- 한 줄 소개, 전공, 닉네임, 프로필 이미지 URL 수정
- 4개 카테고리 태그 picker (delete-all + insert)
- 사용자 정의 태그 생성 (`tagApi.upsert`)

#### 3.1.6 타 사용자 프로필 (`/users/:id`)
- 닉네임, 매너 온도, 한 줄 소개, 관심 태그, 사용자 리뷰 요약, 게시글(리더) 리뷰 요약
- 쪽지 발송 (로그인 사용자만, 인라인)

---

### 3.2 게시글(Post) 관리 — 4개 카테고리

`posts` 단일 테이블 + `category` 컬럼 분기.

#### 3.2.1 CRUD

| 기능 | 접근 권한 | 설명 |
| --- | --- | --- |
| 목록 조회 | 전체 | 페이지네이션 (12개 기본), 카테고리/하위 카테고리/상태/태그/키워드 필터 |
| 상세 조회 | 전체 | 본문, 작성자, 댓글, 지원/리뷰 액션, AI 멤버 추천(작성자) |
| 등록 | 로그인 | 카테고리 + 하위 카테고리, 모집 정원, 기간, 마감일, 태그, 역할 배열, 첨부파일 |
| 수정/삭제 | 작성자 | RLS로 강제 |

게시글 등록/수정 후 프론트는 `postApi.embedPost`를 fire-and-forget으로 호출하여 임베딩을 비동기 갱신. 사용자는 대기 X.

#### 3.2.2 카테고리 구조

| 대분류 | 라우트 | 하위 카테고리 (`SUB_CATEGORIES` 상수) |
| --- | --- | --- |
| 스터디 | `/study` | 어학, 자격증/시험, 독서, 코딩/개발, 기타 학습 |
| 프로젝트 | `/project` | 개발, 디자인, 공모전, 창업/사이드, 기타 협업 |
| 모임 | `/meetup` | 운동/스포츠, 취미/문화, 네트워킹, 밥약/번개, 기타 모임 |
| 커뮤니티 | `/community` | 자유게시판, 후기, Q&A, 정보공유, 공지사항 |

#### 3.2.3 게시글 상태

```
RECRUITING → COMPLETE → FINISHED   (스터디/프로젝트/모임)
GENERAL                             (커뮤니티 전용)
```

| 상태 | 설명 | 가능 액션 |
| --- | --- | --- |
| RECRUITING | 모집 중 | 지원, 댓글 |
| COMPLETE | 모집 완료(진행 중) | 지원 불가, 댓글 |
| FINISHED | 종료 | 사용자 리뷰 + 게시글(프로젝트) 리뷰 작성 |
| GENERAL | 커뮤니티 일반 글 | 댓글 |

* 정원 도달 시 트리거 `post_members_count_sync`가 RECRUITING → COMPLETE 자동 전환 (마이그레이션 0011)
* 작성자가 FINISHED 전환 시 트리거 `notify_members_on_finish`가 모든 멤버에게 시스템 쪽지 발송

#### 3.2.4 조회수 / 인기 게시글
* `posts.view_count` (마이그레이션 0010), 상세 진입 시 RPC `increment_post_view`
* 메인 인기 섹션은 RPC `popular_posts`로 조회수+최신성 정렬

---

### 3.3 매칭/지원 시스템 (역할 정원)

#### 3.3.1 게시글 작성 시 역할 정원 정의 (`post_roles`)
* 작성자가 1개 이상 역할(`name`, `capacity`)을 정의
* 작성자(리더/스터디장/모임장)는 별도 역할로 자동 등록 (모집 정원과 분리)
* 뷰 `post_roles_with_count`로 역할별 채용 현황 노출

#### 3.3.2 지원
| 항목 | 내용 |
| --- | --- |
| 조건 | 로그인 + 게시글 status = RECRUITING + 본인이 작성자가 아님 + 역할 정원 미충족 + 중복 지원 불가 |
| 입력 | 지원 동기/자기소개 (최대 500자) + 역할 선택 + 첨부파일(최대 5개, 각 10MB, private 버킷) |
| DB | `applications` row + `application_attachments` rows |
| 차단 | 트리거 `applications_check_role_capacity`가 정원 초과 지원을 raise |

#### 3.3.3 승인/거절

| 액션 | 처리 결과 |
| --- | --- |
| 승인(ACCEPTED) | 트리거 `applications_on_accepted` → `post_members` row 자동 생성, `current_member_count` 증가, 시스템 쪽지 자동 발송 |
| 거절(REJECTED) | 트리거 `notify_applicant_on_decision` → 시스템 쪽지 자동 발송 |

지원자가 동시에 다른 게시글을 지원/취소해도 트리거가 카운트를 정확히 동기화.

#### 3.3.4 지원 내역 (`/applications`, `/my` 탭)

| 상태 | 색상 | 가능 액션 |
| --- | --- | --- |
| PENDING | 주황 | 지원 취소 |
| ACCEPTED | 초록 | — |
| REJECTED | 빨강 | — |

* `MyApplications` (지원자 시점) / `ReceivedApplications` (작성자 시점) 컴포넌트로 분리
* 지원서 첨부파일은 1시간 signed URL로 작성자만 다운로드

---

### 3.4 리뷰 시스템 (이중 구조)

#### 3.4.1 사용자 리뷰 (`reviews`, `review_scores`) — 매너 온도 기반
**작성 조건**
- 게시글 status = FINISHED
- 본인이 해당 게시글의 멤버
- 본인 제외 멤버에게만 작성, 게시글당 1인 1회

**카테고리별 평가 항목 (각 1~5점)**

| 프로젝트 | 스터디 | 모임 |
| --- | --- | --- |
| 전문성 | 성실도 | 매너 |
| 소통 능력 | 참여도 | 시간 약속 |
| 시간 약속 | 소통 능력 | 분위기 기여 |
| 협동심 | 지식 공유 | 재참여 의사 |
| 열정 | 시간 약속 | 소통 |

**매너 온도 자동 갱신** (마이그레이션 0009)
- 리뷰 등록 시 `apply_review_temperature(p_review_id)` 호출
- `delta = (avg_score - 3.0) × 0.5`, `temperature` = clamp([0, 99.9])

**요약 (ReviewSummaryCard)**
- 동적 항목별 평균 막대 그래프
- 전체 평균 + 총 리뷰 수 + 최근 코멘트
- RPC `review_summary_for_user`

#### 3.4.2 게시글 자체 리뷰 (마이그레이션 0016)
프로젝트/스터디/모임 자체에 대한 평가 (작성자 제외, 1인 1회)

* `project_review_items` — 카테고리별 5개 항목 시드 (예: 진행도/완성도, 학습 효과 등 — 사용자 리뷰와 별개)
* `project_reviews`, `project_review_scores`
* RLS: 게시글 멤버이고 status = FINISHED 일 때만 INSERT, 작성자는 작성 불가
* 노출:
  * 게시글 상세 하단 `ProjectReviewSection` — 요약 + 작성 버튼
  * 마이페이지 "받은 리뷰" 탭 — 본인이 리더인 게시글 통합 요약 (`leader_project_summary`)

---

### 3.5 소통 및 알림 (쪽지)

#### 3.5.1 시스템 쪽지 (마이그레이션 0008)
`messages.type = 'SYSTEM'`, `sender_id = NULL`. 자동 발송 트리거:

| 트리거 | 발송 대상 | 내용 |
| --- | --- | --- |
| `notify_post_author_on_application` | 게시글 작성자 | "[제목] 새 지원이 도착했습니다" |
| `notify_applicant_on_decision` | 지원자 | "[제목] 지원이 승인/거절되었습니다" |
| `notify_members_on_finish` | 모든 멤버 | "[제목]이 종료되었습니다. 리뷰를 작성해주세요." |

#### 3.5.2 1:1 개인 쪽지 (`/messages`)

| 기능 | 설명 |
| --- | --- |
| 발송 | 유저 프로필 / `ComposeMessageModal` (이메일로 검색하여 발송 가능, `sendByEmail`) |
| 받은/보낸 | 탭 분리, 안 읽음 카운트 헤더 뱃지 |
| 읽음 처리 | 항목 클릭 시 `markRead` |

---

### 3.6 댓글

| 기능 | 권한 | 설명 |
| --- | --- | --- |
| 작성 | 로그인 | 게시글 상세 하단 |
| 조회 | 전체 | 시간순 |
| 삭제 | 작성자 | RLS |
| 답글 | 로그인 | 1단계 (`parent_id`) |

---

### 3.7 검색 및 AI 추천 (Gemini + pgvector)

#### 3.7.1 필터 검색 (`AdvancedSearchPanel`)
Landing/Search 페이지 공용 popover.

| 항목 | 설명 |
| --- | --- |
| 키워드 | 제목/본문 ilike |
| 카테고리 | STUDY / PROJECT / MEETUP / COMMUNITY |
| 하위 카테고리 | 카테고리별 동적 옵션 |
| 상태 | RECRUITING / COMPLETE / FINISHED / GENERAL |
| 태그 | 인기 태그 + 검색 (`popular_tags`), 다중 선택 |

검색어는 RPC `record_search`로 기록. 인기 검색어는 `trending_searches` (최근 7일).

#### 3.7.2 AI 자연어 검색 (`/search?ai=1`)
* Edge Function `semantic-search`
* 흐름: 쿼리 → `gemini-embedding-001` (RETRIEVAL_QUERY) → RPC `match_posts(embedding, count, threshold, category?, status?, sub_category?)` → 유사도순 + 작성자/태그 조인
* URL 동기화 (쿼리/카테고리/AI 모드)

#### 3.7.3 게시글 임베딩 파이프라인
* 게시글 INSERT/UPDATE 후 프론트가 Edge Function `embed-post` 호출 (fire-and-forget)
* 작성자 인증 후 service role로 `posts.embedding` 갱신
* 누락분 일괄 처리: 백필 스크립트 `scripts/backfill-embeddings.mjs` — `posts_missing_embedding` 뷰 사용, 1100ms throttle (Gemini 무료 티어 대응)

#### 3.7.4 AI 추천 (`AIRecommendPanel`)
* Edge Function `ai-recommend`, 두 모드:
  * **`project`** (모든 사용자) — 프롬프트 임베딩 → `match_posts` → 결과별 추천 이유 일괄 생성 (`gemini-2.5-flash-lite`, JSON 응답)
  * **`member`** (게시글 작성자만) — `user_tags` 기반 후보 수집 → 후보 부족 시 매너 온도 높은 사용자로 보충 → 추천 이유 일괄 생성

#### 3.7.5 태그 기반 추천 (Phase 1 폴백)
* RPC `recommend_posts_for_user` — 사용자 관심 태그 ∩ 게시글 태그 카운트 정렬
* 마이페이지 "AI 추천" 탭의 1차 데이터 또는 AI 호출 실패 시 폴백

---

### 3.8 첨부파일 (마이그레이션 0015)

| 버킷 | 공개 | 용도 |
| --- | --- | --- |
| `post-files` | public | 게시글 첨부 (이미지·문서) |
| `application-files` | private | 지원서 포트폴리오/이력서 — 1시간 signed URL |

* 테이블 `post_attachments` (게시글 작성자만 INSERT/DELETE), `application_attachments` (업로더 + 게시글 작성자만 SELECT)
* 첨부 5개 한도, 각 10MB
* `attachmentApi`로 통합 호출

---

## 4. 데이터 액세스 설계 (Supabase)

### 4.1 클라이언트

```ts
// src/api/client.ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'all-together-auth' } },
)
```

### 4.2 API 도메인 (`src/api/index.ts`)

| 도메인 | 주요 함수 | Supabase / Edge |
| --- | --- | --- |
| `authApi` | `login`, `signup`, `me`, `logout`, `getSession` | Supabase Auth |
| `userApi` | `getProfile`, `updateProfile`, `updateTags`, `getRecommendedPosts` | RPC `recommend_posts_for_user` |
| `searchApi` | `recordSearch`, `getTrending` | RPC `record_search`, `trending_searches` |
| `attachmentApi` | `uploadPostFile`, `deletePostFile`, `uploadApplicationFile`, `deleteApplicationFile`, `getApplicationFileUrl` | Storage 버킷 |
| `tagApi` | `getAll`, `getByCategory`, `getPopular`, `upsert` | RPC `popular_tags` |
| `postApi` | `getList`, `getDetail`, `incrementView`, `getPopular`, `create`, `update`, `delete`, `updateStatus`, `getMyPosts`, `getMemberPosts`, `getMembers`, `getRecommendedMembers`, `semanticSearch`, `embedPost` | RPC `increment_post_view`, `popular_posts`, `recommend_members_for_post`; Edge `semantic-search`, `embed-post` |
| `recommendApi` | `recommendProjects`, `recommendMembers` | Edge `ai-recommend` |
| `applicationApi` | `apply`, `getMyApplications`, `getPostApplications`, `getReceivedApplications`, `approve`, `reject` | direct table (트리거가 후속 처리) |
| `reviewApi` | `getItems`, `getMyReviewsForPost`, `create`, `getUserReviews`, `getUserSummary` | RPC `apply_review_temperature`, `review_summary_for_user` |
| `projectReviewApi` | `getItems`, `getMyForPost`, `getForPost`, `getSummaryForPost`, `getLeaderSummary`, `getLeaderReviews`, `create` | RPC `project_review_summary_for_post`, `leader_project_summary` |
| `messageApi` | `send`, `sendByEmail`, `getInbox`, `getSent`, `getUnreadCount`, `markRead` | direct table |
| `commentApi` | `getList`, `create`, `delete` | direct table |
| `projectApi` | (postApi 별칭, 레거시) | — |

### 4.3 RLS 정책 (요약)

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| posts | 누구나 | 로그인 (author = auth.uid) | 작성자 | 작성자 |
| post_roles | 누구나 | 게시글 작성자 | 게시글 작성자 | 게시글 작성자 |
| post_members | 누구나 | 트리거 only (수동 INSERT 비허용) | — | 작성자 |
| applications | 본인 + 게시글 작성자 | 로그인 | 게시글 작성자 (승인/거절) | 본인 (취소) |
| comments | 누구나 | 로그인 | 작성자 | 작성자 |
| reviews / review_scores | 누구나 | 멤버 + FINISHED + 본인 제외 | — | — |
| project_reviews / scores | 누구나 | 멤버 + FINISHED + 작성자 본인 제외 | — | — |
| messages | sender 또는 receiver | 로그인 (PERSONAL) / 트리거 (SYSTEM) | receiver (읽음 처리) | — |
| post_attachments | 누구나 | 게시글 작성자 | — | 게시글 작성자 |
| application_attachments | 업로더 + 게시글 작성자 | 지원자 | — | 지원자 / 게시글 작성자 |
| tags | 누구나 | 로그인 (사용자 정의 태그) | — | — |
| users | 누구나 | (auth 트리거) | 본인 | — |

---

## 5. 화면별 기능 정의

### 화면 목록 (실제 라우트, `src/App.tsx`)

| 화면 | 경로 | 인증 | 주요 기능 |
| --- | --- | --- | --- |
| 랜딩 / 메인 | `/` | X | 히어로, 빠른 카테고리, 인기/최신 게시글, 인기 태그, AdvancedSearchPanel |
| 로그인 | `/login` | X | 이메일 로그인 |
| 회원가입 | `/signup` | X | 강력한 비밀번호 정책 |
| 프로필 설정 | `/signup/profile` | ✅ | 3-step 설정 (프로필·카테고리·태그) |
| 카테고리 | `/study` `/project` `/meetup` `/community` | ✅ | 하위 카테고리 + 상태 탭 + 페이지네이션 |
| 게시글 작성 | `/:category/new` | ✅ | ProjectForm (4 카테고리 공통) |
| 게시글 상세 | `/posts/:id` | ✅ | view_count 자동 증가, 지원, 사용자/게시글 리뷰, 댓글, AI 멤버 추천 (작성자) |
| 게시글 수정 | `/posts/:id/edit` | ✅ | |
| 레거시 alias | `/projects`, `/projects/:id`, `/projects/:id/edit` | ✅ | v1 URL 호환 |
| 마이페이지 | `/my` | ✅ | 5 탭 (게시글/지원/프로젝트/추천/리뷰) |
| 프로필 편집 | `/my/edit` | ✅ | 프로필 + 태그 picker + 사용자 태그 생성 |
| 유저 프로필 | `/users/:id` | ✅ | 매너 온도, 리뷰 요약, 쪽지 발송 |
| 지원 내역 | `/applications` | ✅ | 내가 지원/받은 지원서 탭 |
| 쪽지함 | `/messages` | ✅ | 받은/보낸 + 작성 모달 |
| 검색 | `/search` | ✅ | 키워드 + 필터 + AI 모드 (`?ai=1`), URL 동기화 |
| 404 | `*` | X | — |

### 5.1 메인 페이지 (`/`)
| 영역 | 내용 |
| --- | --- |
| 히어로 | 보라색 그라데이션, "함께할 사람을 찾아보세요!", 검색바 |
| 빠른 카테고리 | 4개 카드 |
| 인기 게시글 | RPC `popular_posts`, 가로 스크롤 + 페이지네이션 |
| 최신 게시글 | 통합 리스트 (좌측 2/3) |
| 인기 태그 | RPC `popular_tags`, 우측 1/3 |
| 고급 필터 | `AdvancedSearchPanel` 토글 |

### 5.2 메가 메뉴 헤더 (공통)
| 영역 | 내용 |
| --- | --- |
| 좌측 | 🤝 AllTogether |
| 중앙 | 4개 메뉴 호버 → 메가 메뉴 (좌 하위 카테고리, 우 추천 게시글) |
| 우측 | 로그인 / 사용자 드롭다운 + 안 읽은 쪽지 뱃지 |

### 5.3 카테고리 페이지 (`/study` 등)
- 카테고리 제목 + 설명
- 하위 카테고리 가로 스크롤 필터 버튼
- 상태 탭 (RECRUITING / COMPLETE / FINISHED / 전체)
- 글쓰기 버튼
- 게시글 카드 + 페이지네이션

### 5.4 게시글 상세
**메인**
1. 헤더: 카테고리 뱃지, 상태, 제목, 작성자(닉네임 + 매너 온도), 등록일, 태그
2. 본문 (마크다운 렌더)
3. 부가 정보 (정원/현재 인원/기간/마감일 — 커뮤니티 제외) + `post_roles` 정원 현황
4. 첨부파일 (`post-files` public)
5. 게시글 리뷰 섹션 (FINISHED 한정) — `ProjectReviewSection`
6. 댓글 섹션

**사이드/액션**
- 지원 모달 (RECRUITING + 비작성자, 정원 가득 찬 역할 비활성화)
- 작성자: 수정/삭제, FINISHED 전환, AI 멤버 추천 패널 (`AIRecommendPanel` member 모드)
- 멤버: 사용자 리뷰 작성 모달, 게시글 리뷰 작성 모달

### 5.5 검색 페이지 (`/search`)
- 자연어 입력
- AI 모드 토글 (off=ilike + 필터, on=`semantic-search`)
- 결과 카드 + 유사도 점수(개발 모드)
- AdvancedSearchPanel 공용

---

## 6. 데이터 모델

> 컬럼명은 PostgreSQL 컨벤션(snake_case). TypeScript 타입은 camelCase 매핑.

### 6.1 users
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid (PK) | Supabase Auth 연동 |
| email | text (unique) | |
| nickname | text | |
| major | text? | |
| profile_url | text? | |
| introduction | text? | |
| temperature | float (default 36.5) | |
| created_at | timestamp | |

### 6.2 tags / user_tags / post_tags
| 테이블 | 컬럼 | 비고 |
| --- | --- | --- |
| tags | id, name, category (STUDY/PROJECT/MEETUP/GENERAL) | 사용자 정의 태그 INSERT 가능 (0007) |
| user_tags | user_id, tag_id | |
| post_tags | post_id, tag_id | |

### 6.3 posts
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint (PK) | |
| category | enum | STUDY/PROJECT/MEETUP/COMMUNITY |
| sub_category | text | |
| title | text | |
| content | text | |
| capacity | int? | 커뮤니티 null |
| current_member_count | int (default 0) | 트리거가 자동 동기화 (0011) |
| status | enum | RECRUITING/COMPLETE/FINISHED/GENERAL |
| period | text? | |
| deadline | timestamp? | |
| author_id | uuid (FK → users) | |
| view_count | int (default 0) | 0010 |
| embedding | vector(768)? | 0017, IVFFlat 인덱스 |
| created_at | timestamp | |

### 6.4 post_roles (0006)
| 필드 | 타입 |
| --- | --- |
| id | bigint (PK) |
| post_id | bigint (FK → posts) |
| name | text |
| capacity | int |
| sort_order | int |

뷰 `post_roles_with_count` (역할별 현재 인원).

### 6.5 post_members
| 필드 | 타입 | 비고 |
| --- | --- | --- |
| id | bigint (PK) | |
| post_id | bigint (FK → posts) | |
| user_id | uuid (FK → users) | |
| role | text (자유 입력) | |
| role_id | bigint? (FK → post_roles) | 0006 |

게시글 INSERT 시 작성자 자동 추가 (0013).

### 6.6 applications
| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint (PK) | |
| post_id | bigint (FK → posts) | |
| user_id | uuid (FK → users) | |
| role_id | bigint? (FK → post_roles) | 0006 |
| introduction | text | 지원 동기 + 자기소개 |
| status | enum | PENDING/ACCEPTED/REJECTED |
| created_at | timestamp | |

### 6.7 review_items / reviews / review_scores (사용자 대상)
```
review_items   id, category (STUDY/PROJECT/MEETUP), item_name, sort_order
reviews        id, post_id, evaluator_id, target_id, comment, created_at
review_scores  id, review_id, item_id, score (1~5)
```
RPC `apply_review_temperature(p_review_id)` — 온도 자동 갱신 (0009).

### 6.8 project_review_items / project_reviews / project_review_scores (게시글 대상, 0016)
```
project_review_items   id, category, item_name, sort_order
project_reviews        id, post_id, evaluator_id, comment, created_at  (작성자 1인 1회)
project_review_scores  id, review_id, item_id, score (1~5)
```
RPC `project_review_summary_for_post`, `leader_project_summary`.

### 6.9 messages (0008)
| 필드 | 타입 |
| --- | --- |
| id | bigint (PK) |
| sender_id | uuid? (FK → users, SYSTEM은 NULL) |
| receiver_id | uuid (FK → users) |
| content | text |
| is_read | bool (default false) |
| type | enum (PERSONAL / SYSTEM) |
| created_at | timestamp |

### 6.10 comments
| 필드 | 타입 |
| --- | --- |
| id | bigint (PK) |
| post_id | bigint (FK → posts) |
| user_id | uuid (FK → users) |
| content | text |
| parent_id | bigint? (1단계만) |
| created_at | timestamp |

### 6.11 첨부파일 (0015)
```
post_attachments         id, post_id, uploader_id, file_path, file_name, size, content_type, created_at
application_attachments  id, application_id, uploader_id, file_path, file_name, size, content_type, created_at
```

### 6.12 search_terms (0012)
```
search_terms  term (PK normalized), count, last_searched_at
```

---

## 7. 비기능 요구사항

### 성능

| 항목 | 목표 |
| --- | --- |
| 페이지 초기 로딩 | 3초 이내 |
| Supabase 쿼리 응답 | 평균 500ms 이내 |
| 게시글 목록 페이지 크기 | 12개 |
| Gemini 임베딩 호출 | 게시글 등록/수정 시 fire-and-forget (사용자 대기 X) |
| 백필 throttle | 1100ms (embedding), 4500ms (재태깅) — 무료 티어 대응 |

### 보안

- 모든 통신 HTTPS (Supabase 기본)
- 모든 테이블 RLS 활성화
- anon 키만 클라이언트에 노출, service role 키는 Edge Function 환경변수에만 보관
- Auth는 Supabase 관리(JWT 자동 갱신)
- 비밀번호는 Supabase가 해시 저장
- Edge Function은 호출자 JWT 검증 후 service role로 작업 (예: `embed-post`는 작성자 확인 후 임베딩 갱신)

### 외부 서비스 한도 / 대응

| 서비스 | 한도 | 대응 |
| --- | --- | --- |
| Supabase 무료 | 500MB DB, 1GB Storage | 첨부는 Storage CDN, 임베딩 컬럼 IVFFlat 인덱스 |
| Gemini 무료 (`embedding-001`) | 분당 5 RPM, 일일 100~ requests | 게시글 작성 시 1회 호출, 백필 1100ms throttle, 검색 결과 캐싱 (TanStack Query) |
| Gemini 무료 (`flash-lite`) | 분당 RPM 제한 | 추천 결과 일괄 JSON 응답으로 1회 호출 |
| pgvector | n/a | IVFFlat lists=50, 게시글 1만 건 이상 시 lists 재조정 |

---

## 8. 구현 로드맵 (실제 진행)

### Phase 1 — 기본 구조 ✅ 완료
- [x] React + TypeScript + Vite + CSS Modules
- [x] `@supabase/supabase-js` 클라이언트 설정
- [x] 통합 Posts 타입 모델
- [x] API facade를 Supabase SDK 호출로 전환
- [x] Zustand auth store + 세션 동기화
- [x] 메가 메뉴 헤더, 메인/카테고리/로그인 UI

### Phase 2 — Supabase 연동 & 핵심 기능 ✅ 완료
- [x] DB 마이그레이션 0001~0004 (스키마 / RLS / 리뷰 시드 / RPC)
- [x] 회원가입/로그인 (Supabase Auth) + 프로필 3-step
- [x] 4개 카테고리 게시글 CRUD
- [x] 지원/모집 시스템 + 역할 정원 (`post_roles`, 0006) + capacity 트리거
- [x] 사용자 정의 태그 (0007)
- [x] 시스템 쪽지 자동 발송 (0008)
- [x] `current_member_count` 자동 동기화 + 정원 도달 시 자동 COMPLETE (0011)
- [x] 작성자 자동 멤버 등록 (0013)
- [x] 태그 기반 추천 (`recommend_posts_for_user`, `recommend_members_for_post`)

### Phase 3 — 리뷰 & 매너 온도 ✅ 완료
- [x] 카테고리별 사용자 리뷰 항목 UI 분기 (`ReviewModal`)
- [x] 리뷰 작성/조회 (`reviews`, `review_scores`)
- [x] 매너 온도 자동 갱신 RPC (`apply_review_temperature`, 0009)
- [x] `ReviewSummaryCard` 동적 항목 렌더링
- [x] 게시글 자체 리뷰 시스템 (`project_reviews`, 0016) + 리더 요약

### Phase 4 — AI 기능 ✅ 적용
- [x] pgvector 활성화, 게시글 768차원 임베딩 (0017)
- [x] Edge Function `embed-post` (자동 임베딩)
- [x] Edge Function `semantic-search` (자연어 검색)
- [x] Edge Function `ai-recommend` (프로젝트/멤버 추천 + 추천 이유)
- [x] 백필 스크립트 (`backfill-embeddings.mjs`, `retag-posts.mjs`)
- [x] `/search?ai=1` AI 모드, 마이페이지 AI 추천 탭

### 부가 기능 ✅ 적용
- [x] 조회수 (`view_count`, 0010) + 인기 게시글 RPC
- [x] 인기/트렌딩 검색어 (0012)
- [x] 인기 태그 RPC (0014)
- [x] 첨부파일 시스템 (Storage 2 버킷 + 0015)
- [x] 페이지네이션 컴포넌트 + 모든 리스트 페이지 적용
- [x] AdvancedSearchPanel (Landing/Search 공용)

### 향후 후보
- [ ] 게시글 캐시·CDN 정책
- [ ] Gemini 호출 결과 서버측 캐싱 (현재는 클라이언트 TanStack Query만)
- [ ] 알림 푸시(웹/모바일) 연동
- [ ] 모바일 반응형 최적화

---

_문서 끝 — 추가 기능이나 변경 사항은 버전 업데이트 후 반영_
