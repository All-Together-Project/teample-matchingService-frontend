# ALL 투게더 — 통합 팀 매칭 플랫폼

React + TypeScript + Vite 기반 프론트엔드 프로젝트입니다.

---

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| UI 프레임워크 | React 18 + TypeScript |
| 빌드 도구 | Vite 5 |
| 라우팅 | React Router DOM v6 |
| 서버 상태 | TanStack Query v5 |
| 클라이언트 상태 | Zustand |
| 폼 검증 | React Hook Form + Zod |
| HTTP 클라이언트 | Axios |
| 스타일 | CSS Modules |

---

## 폴더 구조

```
src/
├── api/              # Axios 클라이언트 + API 모듈 (auth, project, application, review, message, comment)
├── components/
│   ├── common/       # Button, TagChip, Badge (TempBadge, TierBadge, StatusBadge)
│   ├── layout/       # Header, MainLayout
│   ├── project/      # ProjectForm, CommentSection
│   ├── matching/     # ApplyModal
│   └── review/       # ReviewSummaryCard
├── pages/
│   ├── auth/         # LoginPage, SignupPage, ProfileSetupPage
│   ├── project/      # ProjectListPage, ProjectDetailPage, ProjectCreatePage, ProjectEditPage
│   ├── user/         # MyPage, UserProfilePage
│   ├── matching/     # ApplicationListPage
│   ├── message/      # MessagePage
│   ├── search/       # SearchPage
│   ├── LandingPage
│   └── NotFoundPage
├── store/            # Zustand — authStore
├── types/            # 전체 TypeScript 타입 정의
├── styles/           # global.css (CSS 변수)
└── App.tsx           # 라우터 설정
```

---

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일에서 VITE_API_BASE_URL을 백엔드 주소로 수정
```

### 3. 개발 서버 실행

```bash
npm run dev
# http://localhost:3000 에서 확인
```

### 4. 빌드

```bash
npm run build
```

---

## VSCode + Claude Code 설정

### Claude Code 익스텐션 설치

1. VSCode에서 `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`) → Extensions 열기
2. `Claude Code` 검색 → Anthropic 공식 익스텐션 설치
3. 좌측 사이드바 Spark(⚡) 아이콘 클릭 → Anthropic 계정으로 로그인

### 추천 Claude Code 활용 방법

```
# 새 컴포넌트 생성 요청 예시
"src/components/review/ReviewWriteModal.tsx 컴포넌트를 만들어줘.
프로젝트 종료 후 팀원을 평가하는 모달이고,
expertise/communication/punctuality/participation/passion 5가지 항목을 1~5점으로 평가해"

# API 연동 요청 예시
"ApplicationListPage에서 받은 지원서 탭을 완성해줘.
내가 만든 프로젝트 목록을 불러오고, 각 프로젝트의 지원서를 승인/거절할 수 있어야 해"

# 버그 수정 요청 예시
"ProjectDetailPage에서 비로그인 상태에서 지원하기 버튼을 눌렀을 때 로그인 페이지로 리다이렉트되게 해줘"
```

---

## 페이지별 구현 현황

| 페이지 | 경로 | 상태 |
|--------|------|------|
| 랜딩 | `/` | ✅ 완성 |
| 로그인 | `/login` | ✅ 완성 |
| 회원가입 | `/signup` | ✅ 완성 |
| 프로필 설정 | `/signup/profile` | ✅ 완성 |
| 프로젝트 목록 | `/projects` | ✅ 완성 |
| 프로젝트 상세 | `/projects/:id` | ✅ 완성 |
| 프로젝트 등록 | `/projects/new` | ✅ 완성 |
| 프로젝트 수정 | `/projects/:id/edit` | ✅ 완성 |
| 마이페이지 | `/my` | ✅ 완성 |
| 유저 프로필 | `/users/:id` | ✅ 완성 |
| 지원 내역 | `/applications` | ✅ 완성 |
| 쪽지함 | `/messages` | ✅ 완성 |
| 검색 | `/search` | ✅ 완성 |

---

## API 연동 안내

`src/api/index.ts`에 모든 API 함수가 정의되어 있습니다.
백엔드 엔드포인트에 맞게 URL을 수정하세요.

JWT 토큰은 `localStorage`에 저장되고 Axios 인터셉터가 자동으로 헤더에 첨부합니다.
토큰 만료 시 refresh 토큰으로 자동 갱신 처리가 되어 있습니다.
