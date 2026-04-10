import api from './client'
import type {
  AuthTokens, LoginRequest, SignupRequest, User,
  Project, Application, Review, ReviewSummary,
  Message, Comment, PageResponse, ApiResponse, Tag,
} from '@/types'

// ─── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  login: (body: LoginRequest) =>
    api.post<ApiResponse<AuthTokens>>('/auth/login', body),

  signup: (body: SignupRequest) =>
    api.post<ApiResponse<User>>('/auth/signup', body),

  me: () =>
    api.get<ApiResponse<User>>('/auth/me'),

  logout: () =>
    api.post('/auth/logout'),
}

// ─── User ──────────────────────────────────────────────────────────
export const userApi = {
  getProfile: (userId: number) =>
    api.get<ApiResponse<User>>(`/users/${userId}`),

  updateProfile: (userId: number, body: Partial<User>) =>
    api.put<ApiResponse<User>>(`/users/${userId}`, body),

  updateTags: (userId: number, tagIds: number[]) =>
    api.put<ApiResponse<User>>(`/users/${userId}/tags`, { tagIds }),

  getRecommendedProjects: () =>
    api.get<ApiResponse<Project[]>>('/users/me/recommended-projects'),
}

// ─── Tags ──────────────────────────────────────────────────────────
export const tagApi = {
  getAll: () =>
    api.get<ApiResponse<Tag[]>>('/tags'),

  getByType: (type: Tag['type']) =>
    api.get<ApiResponse<Tag[]>>(`/tags?type=${type}`),
}

// ─── Project ──────────────────────────────────────────────────────
export const projectApi = {
  getList: (params?: {
    status?: string; category?: string; tagIds?: number[]
    keyword?: string; page?: number; size?: number
  }) => api.get<ApiResponse<PageResponse<Project>>>('/projects', { params }),

  getDetail: (projectId: number) =>
    api.get<ApiResponse<Project>>(`/projects/${projectId}`),

  create: (body: Partial<Project>) =>
    api.post<ApiResponse<Project>>('/projects', body),

  update: (projectId: number, body: Partial<Project>) =>
    api.put<ApiResponse<Project>>(`/projects/${projectId}`, body),

  delete: (projectId: number) =>
    api.delete(`/projects/${projectId}`),

  updateStatus: (projectId: number, status: Project['status']) =>
    api.patch<ApiResponse<Project>>(`/projects/${projectId}/status`, { status }),

  getMembers: (projectId: number) =>
    api.get<ApiResponse<User[]>>(`/projects/${projectId}/members`),

  getRecommendedMembers: (projectId: number) =>
    api.get<ApiResponse<User[]>>(`/projects/${projectId}/recommended-members`),
}

// ─── Application ──────────────────────────────────────────────────
export const applicationApi = {
  apply: (projectId: number, body: { roleId: number; motivation: string; introduction: string }) =>
    api.post<ApiResponse<Application>>(`/projects/${projectId}/applications`, body),

  getMyApplications: () =>
    api.get<ApiResponse<Application[]>>('/applications/me'),

  getProjectApplications: (projectId: number) =>
    api.get<ApiResponse<Application[]>>(`/projects/${projectId}/applications`),

  approve: (applicationId: number) =>
    api.patch<ApiResponse<Application>>(`/applications/${applicationId}/approve`),

  reject: (applicationId: number) =>
    api.patch<ApiResponse<Application>>(`/applications/${applicationId}/reject`),

  cancel: (applicationId: number) =>
    api.patch<ApiResponse<Application>>(`/applications/${applicationId}/cancel`),
}

// ─── Review ───────────────────────────────────────────────────────
export const reviewApi = {
  create: (body: Partial<Review>) =>
    api.post<ApiResponse<Review>>('/reviews', body),

  getUserReviews: (userId: number) =>
    api.get<ApiResponse<Review[]>>(`/reviews/users/${userId}`),

  getUserSummary: (userId: number) =>
    api.get<ApiResponse<ReviewSummary>>(`/reviews/users/${userId}/summary`),
}

// ─── Message ──────────────────────────────────────────────────────
export const messageApi = {
  send: (body: { receiverId: number; content: string }) =>
    api.post<ApiResponse<Message>>('/messages', body),

  getInbox: () =>
    api.get<ApiResponse<Message[]>>('/messages/inbox'),

  getSent: () =>
    api.get<ApiResponse<Message[]>>('/messages/sent'),

  markRead: (messageId: number) =>
    api.patch(`/messages/${messageId}/read`),
}

// ─── Comment ──────────────────────────────────────────────────────
export const commentApi = {
  getList: (projectId: number) =>
    api.get<ApiResponse<Comment[]>>(`/projects/${projectId}/comments`),

  create: (projectId: number, body: { content: string; parentId?: number }) =>
    api.post<ApiResponse<Comment>>(`/projects/${projectId}/comments`, body),

  delete: (projectId: number, commentId: number) =>
    api.delete(`/projects/${projectId}/comments/${commentId}`),
}
