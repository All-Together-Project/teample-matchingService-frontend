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
  roles?: PostRole[]              // 작성자가 정의한 모집 역할 + 정원
  attachments?: Attachment[]      // 게시글 첨부파일 (방향성 문서, 이미지 등)
  createdAt: string
}

// ─── Attachment (첨부파일) ────────────────────────────────────────
// post_attachments / application_attachments 공용 타입
export interface Attachment {
  id: number
  fileName: string
  filePath: string                // storage bucket 내 경로
  fileSize?: number
  mimeType?: string
  uploaderId: string
  createdAt: string
  publicUrl?: string              // post-files (public bucket) 만 즉시 사용 가능
}

// 모집 역할 (post_roles 테이블) — 게시글당 N개. 지원자가 선택해 지원
export interface PostRole {
  id: number
  postId: number
  name: string
  capacity: number
  filledCount: number       // 현재 합류한 인원
  sortOrder: number
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
  roleId?: number                       // 지원한 역할 (post_roles.id)
  role?: Pick<PostRole, 'id' | 'name' | 'capacity'>
  attachments?: Attachment[]            // 지원서 첨부 (자기소개서, 스펙, 이미지 등)
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

// ─── Project Review (프로젝트 자체 리뷰) ──────────────────────────
// 종료된 프로젝트에 대해 멤버가 작성하는 리뷰 (작성자 본인 제외)
export interface ProjectReviewItem {
  id: number
  category: Exclude<PostCategory, 'COMMUNITY'>
  itemName: string
  sortOrder: number
}

export interface ProjectReviewScore {
  itemId: number
  itemName: string
  score: number
}

export interface ProjectReview {
  id: number
  postId: number
  evaluator: Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'>
  comment: string
  scores: ProjectReviewScore[]
  createdAt: string
  // 리더 리뷰 합계 화면 등에서 게시글 정보까지 같이 보낼 때
  postTitle?: string
  postCategory?: Exclude<PostCategory, 'COMMUNITY'>
}

export interface ProjectReviewSummary {
  totalReviews: number
  averageOverall: number
  itemAverages: { itemName: string; average: number }[]
}

export interface LeaderProjectSummary {
  hostedCount: number          // 작성한 프로젝트 수 (전체)
  finishedCount: number        // 종료된 프로젝트 수
  reviewCount: number          // 받은 프로젝트 리뷰 수
  averageOverall: number
  itemAverages: { itemName: string; average: number }[]
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
