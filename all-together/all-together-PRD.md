# ALL 투게더 — Product Requirements Document (PRD)

> **버전** v2.0 | **작성일** 2026-05-08 | **상태** Draft
> v1.0(2025-04-10) 대비: 백엔드 Supabase 서버리스로 전환 / 4개 카테고리(스터디·프로젝트·모임·커뮤니티) 통합 / 신뢰도는 매너 온도(36.5°C 기본)만 / 카테고리별 리뷰 항목 / 카테고리별 유연 역할 / Gemini + pgvector AI 로드맵 / 스타일은 CSS Modules 유지.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [사용자 정의](#2-사용자-정의)
3. [기능 명세](#3-기능-명세)
   - 3.1 회원 및 인증 관리
   - 3.2 게시글(Post) 관리 — 4개 카테고리
   - 3.3 매칭/지원 시스템
   - 3.4 리뷰 시스템 (카테고리별 항목)
   - 3.5 소통 및 알림 (쪽지)
   - 3.6 댓글
   - 3.7 검색 및 AI 추천 (Gemini + pgvector)
4. [데이터 액세스 설계 (Supabase)](#4-데이터-액세스-설계-supabase)
5. [화면별 기능 정의](#5-화면별-기능-정의)
6. [데이터 모델](#6-데이터-모델)
7. [비기능 요구사항](#7-비기능-요구사항)
8. [구현 로드맵](#8-구현-로드맵)

---

## 1. 프로젝트 개요

### 서비스 소개

**ALL 투게더**는 스터디·프로젝트·모임·커뮤니티를 한 곳에서 매칭·운영할 수 있는 통합 플랫폼입니다. 개발자뿐 아니라 어학·자격증·취미·운동 등 다양한 분야의 사람들이 함께할 팀원을 찾고 모임을 만들 수 있습니다. 매너 온도, AI 자연어 검색, 카테고리별 맞춤 리뷰를 통해 신뢰도 높은 매칭 경험을 제공합니다.

### 핵심 가치

| 가치 | 설명 |
| --- | --- |
| 통합 | 4개 대분류(스터디/프로젝트/모임/커뮤니티)를 통합 게시글 모델로 운영 |
| 신뢰 | 매너 온도(36.5°C 기본) + 카테고리별 평가 항목 기반 신뢰도 |
| 효율 | Gemini 자연어 검색 + pgvector 유사 게시글 추천 |
| 소통 | 댓글·쪽지·시스템 알림으로 끊김 없는 커뮤니케이션 |

### 기술 스택

| 구분 | 기술 |
| --- | --- |
| 프론트엔드 | React 18, TypeScript, Vite, Zustand, TanStack Query, react-hook-form, zod |
| 백엔드(BaaS) | Supabase (PostgreSQL, Auth, Storage) — 서버리스 |
| AI | Gemini API (무료 티어) — 자연어 검색·추천 설명 |
| Vector | Supabase pgvector — 게시글 임베딩·코사인 유사도 |
| 인증 | Supabase Auth (이메일/비밀번호, JWT 자동 갱신) |
| 스타일 | CSS Modules |

> **서버리스 원칙**: 별도 백엔드 API를 두지 않고 `@supabase/supabase-js` SDK를 프론트에서 직접 호출. 권한은 Supabase RLS(Row Level Security)로 통제.

---

## 2. 사용자 정의

### 사용자 유형

| 유형 | 설명 |
| --- | --- |
| 비로그인 사용자 | 랜딩, 게시글 목록/상세 열람 가능 |
| 일반 회원 | 게시글 작성, 지원, 댓글, 쪽지, 리뷰 작성 |
| 게시글 작성자(리더/모임장) | 자신의 게시글 수정/삭제, 지원 승인·거절 |

### 역할(Role)

카테고리별로 자유 입력. 고정된 enum을 두지 않습니다.

| 카테고리 | 역할 예시 |
| --- | --- |
| STUDY | 스터디장, 멤버, 튜터, 청강 |
| PROJECT | 리더, 개발자, 디자이너, 기획자, 데이터, 마케팅 |
| MEETUP | 모임장, 멤버 |
| COMMUNITY | (역할 없음) |

`post_members.role`은 자유 텍스트로 저장합니다.

### 신뢰도 — 매너 온도

- 모든 사용자 가입 시 `temperature = 36.5`
- 리뷰 점수의 가중 평균에 따라 자동 변동
- 티어(ROOKIE/BRONZE/...) 체계는 사용하지 않습니다.
- 지원자 검토 시 매너 온도를 참고 지표로 노출

---

## 3. 기능 명세

### 3.1 회원 및 인증 관리

#### 3.1.1 회원가입

| 항목 | 내용 |
| --- | --- |
| 인증 방식 | Supabase Auth (이메일/비밀번호) |
| 입력 필드 | 이메일, 비밀번호, 닉네임 |
| 후속 동작 | `users` 테이블에 프로필 row 생성 → `/signup/profile`로 이동 |

비밀번호 정책: 최소 8자, 영문 + 숫자 + 특수문자 권장(클라이언트 강도 표시).

#### 3.1.2 로그인

- Supabase 세션 토큰은 localStorage에 자동 저장 (storageKey: `all-together-auth`)
- Access Token 만료 시 자동 갱신 (`autoRefreshToken: true`)
- `onAuthStateChange`로 Zustand store 동기화

#### 3.1.3 프로필 설정 (3-Step)

| Step | 입력 |
| --- | --- |
| 1 | 한 줄 소개(최대 80자), 전공, 소속 |
| 2 | 활동 카테고리 선택 (스터디/프로젝트/모임 복수 선택 가능) |
| 3 | 관심 태그 선택 — 4개 카테고리(STUDY/PROJECT/MEETUP/GENERAL) 태그에서 최대 10개 |

선택한 태그는 AI 추천(Phase 1: 태그 매칭, Phase 2+: pgvector 유사도) 가중치로 활용.

#### 3.1.4 마이페이지

| 기능 | 설명 |
| --- | --- |
| 프로필 조회 | 닉네임, 매너 온도, 한 줄 소개, 전공, 관심 태그 |
| AI 추천 게시글 | 관심 태그 기반 맞춤 게시글 최대 6개 |
| 받은 리뷰 | 카테고리별 항목 평균 + 최근 코멘트 |
| 프로필 편집 | 한 줄 소개, 전공, 태그 수정 |

#### 3.1.5 타 사용자 프로필

- 표시 항목: 닉네임, 매너 온도, 한 줄 소개, 관심 태그, 리뷰 요약
- 쪽지 보내기 버튼 (로그인 사용자만)

---

### 3.2 게시글(Post) 관리 — 4개 카테고리

`posts` 단일 테이블로 모든 카테고리를 관리. `category` 컬럼으로 분기.

#### 3.2.1 CRUD

| 기능 | 접근 권한 | 설명 |
| --- | --- | --- |
| 목록 조회 | 전체 | 페이지네이션, 카테고리/하위 카테고리/상태/태그/키워드 필터 |
| 상세 조회 | 전체 | 본문, 작성자, 댓글, 지원/참가 버튼 |
| 등록 | 로그인 사용자 | 카테고리 + 하위 카테고리 선택 후 작성 |
| 수정/삭제 | 작성자 | RLS 정책으로 강제 |

#### 3.2.2 카테고리 구조

| 대분류 | 라우트 | 하위 카테고리 |
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
| FINISHED | 종료 | 리뷰 작성 |
| GENERAL | 커뮤니티 일반 글 | 댓글 |

상태 전환은 작성자만 가능. FINISHED 전환 시 모든 멤버에게 시스템 쪽지 발송.

---

### 3.3 매칭/지원 시스템

#### 3.3.1 지원

| 항목 | 내용 |
| --- | --- |
| 조건 | 로그인 + 게시글 status = RECRUITING + 본인이 작성자가 아님 + 중복 지원 불가 |
| 입력 | 지원 동기/자기소개 (최대 500자) |

> v1.0의 "지원 역할 선택" 필드는 카테고리별 유연 역할 정책에 따라 작성자가 승인 시 부여하는 방식으로 변경.

#### 3.3.2 승인/거절

| 액션 | 처리 결과 |
| --- | --- |
| 승인(ACCEPTED) | `post_members`에 row 생성 (작성자가 부여하는 `role` 자유 입력), 시스템 쪽지 발송 |
| 거절(REJECTED) | 시스템 쪽지 발송 |

#### 3.3.3 지원 내역

| 상태 | 색상 | 가능 액션 |
| --- | --- | --- |
| PENDING | 주황 | 지원 취소 |
| ACCEPTED | 초록 | — |
| REJECTED | 빨강 | — |

---

### 3.4 리뷰 시스템 — 카테고리별 항목

#### 3.4.1 작성 조건

- 게시글 status = FINISHED
- 본인이 해당 게시글의 멤버 또는 작성자
- 본인 제외 멤버에게만 작성, 게시글당 1인 1회

#### 3.4.2 카테고리별 평가 항목 (각 1~5점)

| 프로젝트 | 스터디 | 모임 |
| --- | --- | --- |
| 전문성 | 성실도 | 매너 |
| 소통 능력 | 참여도 | 시간 약속 |
| 시간 약속 | 소통 능력 | 분위기 기여 |
| 협동심 | 지식 공유 | 재참여 의사 |
| 열정 | 시간 약속 | 소통 |

> 커뮤니티 카테고리는 리뷰 없음. 항목은 `review_items` 테이블에 시드되며, 운영자가 동적으로 추가/수정 가능.

#### 3.4.3 매너 온도 자동 갱신

- 리뷰 등록 시 평균 점수의 가중치(`(평균 - 3.0) × 0.5`) 만큼 `users.temperature`에 가감
- 트리거 함수 `update_user_temperature` (PL/pgSQL)로 처리

#### 3.4.4 요약 (ReviewSummary)

- 항목별 평균 막대 그래프 (동적 항목)
- 전체 평균 + 총 리뷰 수
- 가장 최근 코멘트 1건
- Supabase RPC `review_summary_for_user`로 조회

---

### 3.5 소통 및 알림 (쪽지)

#### 3.5.1 시스템 쪽지

| 트리거 | 내용 |
| --- | --- |
| 지원 승인 | "[게시글 제목] 모집에 합류하셨습니다!" |
| 지원 거절 | "[게시글 제목] 지원이 아쉽게도 거절되었습니다." |
| 게시글 종료 | "[게시글 제목]이 종료되었습니다. 리뷰를 작성해주세요." |

발신자: 시스템 사용자 (`type = SYSTEM`).

#### 3.5.2 1:1 개인 쪽지

| 기능 | 설명 |
| --- | --- |
| 발송 | 유저 프로필에서 발송, 최대 500자 |
| 수신/발신함 | 목록 + 안 읽음 카운트 |
| 읽음 처리 | 클릭 시 `is_read = true` |

---

### 3.6 댓글

| 기능 | 권한 | 설명 |
| --- | --- | --- |
| 작성 | 로그인 | 게시글 상세 하단 |
| 조회 | 전체 | 시간순 오름차순 |
| 삭제 | 작성자 | RLS로 강제 |
| 답글 | 로그인 | 1단계 계층 (`parent_id`) |

---

### 3.7 검색 및 AI 추천 (Gemini + pgvector)

#### 3.7.1 필터 검색

| 항목 | 설명 |
| --- | --- |
| 키워드 | 제목/본문 ilike 검색 |
| 카테고리 | STUDY / PROJECT / MEETUP / COMMUNITY |
| 하위 카테고리 | 카테고리별 동적 옵션 |
| 상태 | RECRUITING / COMPLETE / FINISHED / GENERAL |
| 태그 | AND 조건 복수 선택 |

#### 3.7.2 AI 자연어 검색 (Phase 2)

- 사용자 질문 → Gemini Embedding API로 벡터화
- `posts.embedding` (pgvector) 코사인 유사도 검색
- RPC: `search_posts_semantic(p_query text, p_limit int)`
- 예: "정처기 스터디 있어?" → 정보처리기사 관련 스터디 게시글 반환

#### 3.7.3 맞춤 추천

| Phase | 동작 | 비용 |
| --- | --- | --- |
| 1 | 사용자 관심 태그 ∩ 게시글 태그 카운트 정렬 | 무료 |
| 2 | + Gemini 임베딩 + pgvector 유사 게시글 | Gemini 무료 티어 |
| 3 | + 활동 이력 + 매너 온도 가중치 + "추천 이유" Gemini 생성 | Gemini 무료 티어 |

RPC: `recommend_posts_for_user(p_limit int)`, `recommend_members_for_post(p_post_id, p_limit)`

---

## 4. 데이터 액세스 설계 (Supabase)

REST 엔드포인트 대신 Supabase SDK 직접 호출. 모든 호출은 `@supabase/supabase-js` 클라이언트를 통하며, 권한은 RLS로 보호됩니다.

### 4.1 클라이언트

```ts
// src/api/client.ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } },
)
```

### 4.2 주요 호출 패턴

| 도메인 | 함수 | Supabase 호출 |
| --- | --- | --- |
| Auth | `authApi.login` | `supabase.auth.signInWithPassword` |
| Auth | `authApi.signup` | `supabase.auth.signUp` |
| Posts | `postApi.getList` | `from('posts').select(...).range(...)` |
| Posts | `postApi.semanticSearch` | `rpc('search_posts_semantic')` |
| Apply | `applicationApi.apply` | `from('applications').insert(...)` |
| Review | `reviewApi.create` | `from('reviews').insert` + `from('review_scores').insert` |
| Review | `reviewApi.getUserSummary` | `rpc('review_summary_for_user')` |
| Tag 추천 | `userApi.getRecommendedPosts` | `rpc('recommend_posts_for_user')` |

### 4.3 RLS 정책 (요약)

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| posts | 누구나 | 로그인 사용자 (author_id = auth.uid()) | 작성자 | 작성자 |
| applications | 본인 + 게시글 작성자 | 로그인 사용자 | 게시글 작성자(승인/거절) | 본인(취소) |
| reviews | 누구나 | 멤버이고 게시글 FINISHED | — | — |
| messages | 본인이 sender 또는 receiver | 로그인 사용자 | receiver(읽음 처리) | — |
| comments | 누구나 | 로그인 사용자 | 작성자 | 작성자 |
| users | 누구나 | (Auth 트리거로 자동 생성) | 본인 | — |

---

## 5. 화면별 기능 정의

### 화면 목록

| 화면 | 경로 | 인증 | 주요 기능 |
| --- | --- | --- | --- |
| 랜딩 / 메인 | `/` | X | 히어로, 빠른 카테고리, 인기/최신 게시글, 인기 태그 |
| 로그인 | `/login` | X | 이메일 로그인 |
| 회원가입 | `/signup` | X | 계정 생성 |
| 프로필 설정 | `/signup/profile` | ✅ | 3-step 설정 |
| 카테고리 | `/:category` (`/study` 등) | X | 하위 카테고리 필터 + 게시글 리스트 |
| 게시글 상세 | `/posts/:id` (또는 카테고리별) | X/✅ | 본문, 지원, 댓글 |
| 게시글 작성 | `/:category/new` | ✅ | 작성 폼 |
| 게시글 수정 | `/posts/:id/edit` | ✅ | 작성자 전용 |
| 마이페이지 | `/my` | ✅ | 프로필, 추천 게시글, 리뷰 |
| 유저 프로필 | `/users/:id` | ✅ | 타 사용자, 쪽지 |
| 지원 내역 | `/applications` | ✅ | 지원 현황 |
| 쪽지함 | `/messages` | ✅ | 수신/발신 |
| 검색 | `/search` | X | 키워드 + 태그 + AI 자연어 |
| 404 | `*` | X | — |

### 5.1 메인 페이지 (`/`)

| 영역 | 내용 |
| --- | --- |
| 히어로 | 보라색 그라데이션, "함께할 사람을 찾아보세요!" 슬로건, 자연어 검색바 |
| 빠른 카테고리 | 스터디/프로젝트/모임/커뮤니티 4개 카드 |
| 인기 게시글 | 카테고리 무관, 가로 스크롤 |
| 최신 게시글 | 좌측 2/3 통합 리스트 |
| 인기 태그 | 우측 1/3 태그 클라우드 |

### 5.2 메가 메뉴 헤더 (공통)

| 영역 | 내용 |
| --- | --- |
| 좌측 | 🤝 AllTogether 로고 |
| 중앙 | 스터디·프로젝트·모임·커뮤니티 메뉴 (호버 시 메가 메뉴 드롭다운) |
| 메가 메뉴 | 좌측: 하위 카테고리 목록(아이콘+이름+설명), 우측: 추천 게시글 미리보기 |
| 우측 | 로그인 (또는 프로필 + 쪽지 알림) |

### 5.3 카테고리 페이지 (`/study`, `/project`, ...)

- 카테고리 제목 + 설명
- 하위 카테고리 가로 스크롤 필터 버튼
- 글쓰기 버튼
- 게시글 카드 리스트 (모집 상태 뱃지, 제목, 작성자+매너 온도, 시간, 태그)

### 5.4 게시글 상세

**메인 영역**
1. 헤더: 카테고리 뱃지, 상태, 제목, 작성자(닉네임+온도), 등록일, 태그
2. 본문
3. 카테고리별 추가 정보 (모집 정원/현재 인원/기간/마감일 — 커뮤니티 제외)
4. 댓글 섹션

**사이드바**
- 지원하기 버튼 (RECRUITING + 비작성자만)
- 작성자에게: 수정/삭제, AI 추천 멤버 5명

### 5.5 검색 페이지 (`/search`)

- 자연어 입력 → Gemini 임베딩 → pgvector 유사도 결과
- 키워드/태그/카테고리 필터 병행
- 결과 카드 + 유사도 점수(개발 모드)

---

## 6. 데이터 모델

> 컬럼명은 PostgreSQL 컨벤션(snake_case). TypeScript 타입은 camelCase 매핑.

### 6.1 users

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | uuid (PK) | Supabase Auth 연동 |
| email | text (unique) | |
| nickname | text | |
| major | text? | 전공 |
| profile_url | text? | 프로필 이미지 URL |
| introduction | text? | 한 줄 소개 |
| temperature | float (default 36.5) | 매너 온도 |
| created_at | timestamp | |

### 6.2 tags / user_tags / post_tags

| 테이블 | 컬럼 |
| --- | --- |
| tags | id, name, category (STUDY/PROJECT/MEETUP/GENERAL) |
| user_tags | user_id, tag_id |
| post_tags | post_id, tag_id |

### 6.3 posts

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint (PK) | |
| category | enum | STUDY/PROJECT/MEETUP/COMMUNITY |
| sub_category | text | "어학", "개발" 등 |
| title | text | |
| content | text | |
| capacity | int? | 모집 정원 (커뮤니티는 null) |
| current_member_count | int (default 0) | |
| status | enum | RECRUITING/COMPLETE/FINISHED/GENERAL |
| period | text? | 진행 기간 |
| deadline | timestamp? | 모집 마감일 |
| author_id | uuid (FK → users) | |
| embedding | vector(768)? | Gemini 임베딩 |
| created_at | timestamp | |

### 6.4 post_members

| 필드 | 타입 |
| --- | --- |
| id | bigint (PK) |
| post_id | bigint (FK → posts) |
| user_id | uuid (FK → users) |
| role | text (자유 입력) |

### 6.5 applications

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint (PK) | |
| post_id | bigint (FK → posts) | |
| user_id | uuid (FK → users) | 지원자 |
| introduction | text | 지원 동기 + 자기소개 |
| status | enum | PENDING/ACCEPTED/REJECTED |
| created_at | timestamp | |

### 6.6 review_items / reviews / review_scores

```
review_items
  id, category (STUDY/PROJECT/MEETUP), item_name, sort_order

reviews
  id, post_id, evaluator_id, target_id, comment, created_at

review_scores
  id, review_id, item_id, score (1~5)
```

### 6.7 messages

| 필드 | 타입 |
| --- | --- |
| id | bigint (PK) |
| sender_id | uuid (FK → users, nullable for SYSTEM) |
| receiver_id | uuid (FK → users) |
| content | text |
| is_read | bool (default false) |
| type | enum (PERSONAL / SYSTEM) |
| created_at | timestamp |

### 6.8 comments

| 필드 | 타입 |
| --- | --- |
| id | bigint (PK) |
| post_id | bigint (FK → posts) |
| user_id | uuid (FK → users) |
| content | text |
| parent_id | bigint? (FK → comments) — 1단계만 |
| created_at | timestamp |

---

## 7. 비기능 요구사항

### 성능

| 항목 | 목표 |
| --- | --- |
| 페이지 초기 로딩 | 3초 이내 |
| Supabase 쿼리 응답 | 평균 500ms 이내 |
| 게시글 목록 페이지 크기 | 기본 12개 |
| Gemini 임베딩 호출 | 게시글 등록/수정 시 비동기 큐 처리 (사용자 대기 제외) |

### 보안

- 모든 통신 HTTPS (Supabase 기본)
- 모든 테이블 RLS 활성화. 익명 anon 키는 클라이언트 노출 가능 범위로 제한
- Auth는 Supabase 관리(JWT 자동 갱신, refresh storageKey: `all-together-auth`)
- 비밀번호는 Supabase가 해시 저장(bcrypt 호환)
- 민감 작업은 RLS + DB 함수에서 권한 검증

### 외부 서비스 한도

| 서비스 | 한도 | 대응 |
| --- | --- | --- |
| Supabase 무료 | 500MB DB, 1GB Storage | 이미지는 Storage CDN 사용, 임베딩 컬럼은 인덱싱 |
| Gemini 무료 | 분당 호출 제한 | 게시글 생성 시 일괄 임베딩, 검색 결과 캐싱 |
| pgvector | n/a | `ivfflat` 인덱스 (게시글 1만 건 이상 시 활성화) |

---

## 8. 구현 로드맵

### Phase 1 — 기본 구조 (완료)
- React + TypeScript + Vite 초기화
- 메가 메뉴 헤더, 메인/카테고리/로그인 UI
- Zustand auth store, TanStack Query 골격

### Phase 2 — Supabase 연동 & 핵심 기능
- [x] `@supabase/supabase-js` 클라이언트 설정
- [x] 타입 모델 통합 (Posts 단일 모델)
- [x] API facade를 Supabase SDK 호출로 전환
- [ ] DB 마이그레이션(SQL)
- [ ] RLS 정책 작성
- [ ] 회원가입/로그인 (Supabase Auth)
- [ ] 게시글 CRUD
- [ ] 지원/모집 시스템
- [ ] 태그 기반 추천 (Phase 1 추천)

### Phase 3 — 리뷰 & 매너 온도
- [x] `ReviewSummaryCard` 동적 항목 렌더링
- [ ] `review_items` 시드 + 작성 UI 카테고리별 분기
- [ ] `update_user_temperature` 트리거 함수
- [ ] 지원자 프로필에 온도 표시

### Phase 4 — AI 기능
- [ ] Gemini API 연동 (Edge Function 또는 클라이언트)
- [ ] pgvector 활성화 + 게시글 임베딩 파이프라인
- [ ] `search_posts_semantic` RPC
- [ ] `recommend_posts_for_user` / `recommend_members_for_post` RPC
- [ ] "이 게시글을 추천하는 이유" Gemini 생성

---

_문서 끝 — 추가 기능이나 변경 사항은 버전 업데이트 후 반영_
