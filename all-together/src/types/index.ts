// ─── User & Auth ───────────────────────────────────────────────────
export interface User {
  id: string                // UUID (Supabase Auth)
  email: string
  nickname: string
  major?: string
  profileUrl?: string
  introduction?: string
  temperature: number       // 매너 온도 (default 36.5)
  createdAt: string
}

// 카테고리별 유연한 역할 — 자유 입력 (예: 리더, 멤버, 개발자, 디자이너, 튜터, 모임장)
export type UserRole = string

export interface Tag {
  id: number
  name: string
  category: TagCategory
}

export type TagCategory = 'STUDY' | 'PROJECT' | 'MEETUP' | 'GENERAL'

// ─── Category ─────────────────────────────────────────────────────
export type PostCategory = 'STUDY' | 'PROJECT' | 'MEETUP' | 'COMMUNITY'
export type PostStatus = 'RECRUITING' | 'COMPLETE' | 'FINISHED' | 'GENERAL'

export const SUB_CATEGORIES: Record<PostCategory, string[]> = {
  STUDY:     ['어학', '자격증/시험', '독서', '코딩/개발', '기타 학습'],
  PROJECT:   ['개발', '디자인', '공모전', '창업/사이드', '기타 협업'],
  MEETUP:    ['운동/스포츠', '취미/문화', '네트워킹', '밥약/번개', '기타 모임'],
  COMMUNITY: ['자유게시판', '후기', 'Q&A', '정보공유', '공지사항'],
}

// ─── Post (통합 게시글 모델) ──────────────────────────────────────
export interface Post {
  id: number
  category: PostCategory
  subCategory: string
  title: string
  content: string
  capacity?: number
  currentMemberCount: number
  status: PostStatus
  period?: string
  deadline?: string
  authorId: string
  author: Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'>
  tags: Tag[]
  createdAt: string
}

// 프로젝트 카테고리 게시글의 별칭 (기존 코드 호환용)
export type Project = Post

// ─── Post Member ───────────────────────────────────────────────────
export interface PostMember {
  id: number
  postId: number
  userId: string
  role: UserRole          // 자유 문자열
  user: Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'>
}

// ─── Application ───────────────────────────────────────────────────
export interface Application {
  id: number
  postId: number
  post?: Pick<Post, 'id' | 'title' | 'category' | 'status'>
  userId: string
  applicant: Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'>
  introduction: string                  // 지원 동기 + 자기소개
  status: ApplicationStatus
  createdAt: string
}

export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

// ─── Review (카테고리별 항목 기반) ────────────────────────────────
// 카테고리별 평가 항목 템플릿
export interface ReviewItem {
  id: number
  category: Exclude<PostCategory, 'COMMUNITY'>   // 커뮤니티는 리뷰 없음
  itemName: string
  sortOrder: number
}

// 항목별 평가 항목 기본값 (DB Review_Items 테이블 시드 데이터와 동일)
export const REVIEW_ITEM_TEMPLATES: Record<Exclude<PostCategory, 'COMMUNITY'>, string[]> = {
  PROJECT: ['전문성', '소통 능력', '시간 약속', '협동심', '열정'],
  STUDY:   ['성실도', '참여도', '소통 능력', '지식 공유', '시간 약속'],
  MEETUP:  ['매너', '시간 약속', '분위기 기여', '재참여 의사', '소통'],
}

export interface Review {
  id: number
  postId: number
  postCategory: Exclude<PostCategory, 'COMMUNITY'>
  postTitle: string
  evaluator: Pick<User, 'id' | 'nickname'>
  target: Pick<User, 'id' | 'nickname'>
  comment: string
  scores: ReviewScore[]
  createdAt: string
}

export interface ReviewScore {
  itemId: number
  itemName: string
  score: number   // 1~5
}

export interface ReviewSummary {
  userId: string
  totalReviews: number
  averageOverall: number                     // 전체 평균 (0~5)
  itemAverages: { itemName: string; average: number }[]   // 항목별 평균 (동적)
  recentComment: string
}

// ─── Message ───────────────────────────────────────────────────────
export interface Message {
  id: number
  sender: Pick<User, 'id' | 'nickname' | 'profileUrl'>
  receiver: Pick<User, 'id' | 'nickname' | 'profileUrl'>
  content: string
  isRead: boolean
  type: MessageType
  createdAt: string
}

export type MessageType = 'PERSONAL' | 'SYSTEM'

// ─── Comment ───────────────────────────────────────────────────────
export interface Comment {
  id: number
  postId: number
  author: Pick<User, 'id' | 'nickname' | 'profileUrl'>
  content: string
  parentId?: number
  replies?: Comment[]
  createdAt: string
}

// ─── API Response (Supabase 응답을 단일화한 래퍼) ─────────────────
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
}

// ─── Auth ──────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}

export interface SignupRequest {
  email: string
  password: string
  nickname: string
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: User
}
