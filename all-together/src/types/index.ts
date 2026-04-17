// ─── User & Auth ───────────────────────────────────────────────────
export interface User {
  id: number
  email: string
  name: string
  nickname: string
  profileImage?: string
  bio?: string
  major?: string
  organization?: string
  roles: UserRole[]
  techTags: Tag[]
  interestTags: Tag[]
  temperature: number      // 신뢰도 온도 (0~100)
  tier: UserTier
  createdAt: string
}

export type UserRole = 'DEVELOPER' | 'DESIGNER' | 'PLANNER' | 'DATA' | 'MARKETING' | 'OTHER'
export type UserTier = 'ROOKIE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'

export interface Tag {
  id: number
  name: string
  type: TagType
}
export type TagType = 'TECH' | 'INTEREST' | 'ROLE'

// ─── Category ─────────────────────────────────────────────────────
export type PostCategory = 'STUDY' | 'PROJECT' | 'MEETUP' | 'COMMUNITY'
export type PostStatus = 'RECRUITING' | 'COMPLETE' | 'FINISHED' | 'GENERAL'

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
  author: Pick<User, 'id' | 'name' | 'nickname' | 'profileImage'>
  tags: Tag[]
  createdAt: string
}

// ─── Project ───────────────────────────────────────────────────────
export interface Project {
  id: number
  title: string
  description: string
  status: ProjectStatus
  category: string
  startDate?: string
  endDate?: string
  maxMembers: number
  currentMembers: number
  leader: Pick<User, 'id' | 'name' | 'nickname' | 'profileImage'>
  tags: Tag[]
  roles: ProjectRole[]
  createdAt: string
  updatedAt: string
}

export type ProjectStatus = 'RECRUITING' | 'COMPLETED' | 'CLOSED'

export interface ProjectRole {
  id: number
  roleName: string
  roleType: UserRole
  description: string
  count: number
  filledCount: number
  requiredTags: Tag[]
}

// ─── Application ───────────────────────────────────────────────────
export interface Application {
  id: number
  projectId: number
  project?: Pick<Project, 'id' | 'title' | 'status'>
  applicant: Pick<User, 'id' | 'name' | 'nickname' | 'profileImage'>
  roleId: number
  roleName: string
  motivation: string
  introduction: string
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
}

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

// ─── Review ────────────────────────────────────────────────────────
export interface Review {
  id: number
  projectId: number
  projectTitle: string
  reviewer: Pick<User, 'id' | 'name' | 'nickname'>
  reviewee: Pick<User, 'id' | 'name' | 'nickname'>
  expertise: number       // 전문성 1~5
  communication: number   // 소통성 1~5
  punctuality: number     // 시간 준수성 1~5
  participation: number   // 참여 태도 1~5
  passion: number         // 열정 1~5
  comment: string
  createdAt: string
}

export interface ReviewSummary {
  userId: number
  averageExpertise: number
  averageCommunication: number
  averagePunctuality: number
  averageParticipation: number
  averagePassion: number
  totalReviews: number
  recentComment: string
}

// ─── Message ───────────────────────────────────────────────────────
export interface Message {
  id: number
  sender: Pick<User, 'id' | 'name' | 'nickname' | 'profileImage'>
  receiver: Pick<User, 'id' | 'name' | 'nickname' | 'profileImage'>
  content: string
  isRead: boolean
  type: MessageType
  createdAt: string
}

export type MessageType = 'PERSONAL' | 'SYSTEM'

// ─── Comment ───────────────────────────────────────────────────────
export interface Comment {
  id: number
  projectId: number
  author: Pick<User, 'id' | 'name' | 'nickname' | 'profileImage'>
  content: string
  parentId?: number
  replies?: Comment[]
  createdAt: string
  updatedAt: string
}

// ─── API Response ──────────────────────────────────────────────────
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
  name: string
  nickname: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
