import { supabase } from './client'
import type {
  User, Post, PostCategory, Application, Review, ReviewSummary,
  Message, Comment, Tag, AuthSession, LoginRequest, SignupRequest,
} from '@/types'

// ─── Auth (Supabase Auth) ──────────────────────────────────────────
export const authApi = {
  login: async ({ email, password }: LoginRequest) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  signup: async ({ email, password, nickname }: SignupRequest) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname } },
    })
    if (error) throw error
    return data
  },

  me: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    if (error) throw error
    return data as User
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  getSession: async (): Promise<AuthSession | null> => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return null
    const me = await authApi.me()
    if (!me) return null
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: me,
    }
  },
}

// ─── User ──────────────────────────────────────────────────────────
export const userApi = {
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*, user_tags(tag:tags(*))')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data as User
  },

  updateProfile: async (userId: string, body: Partial<User>) => {
    const { data, error } = await supabase
      .from('users')
      .update(body)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data as User
  },

  updateTags: async (userId: string, tagIds: number[]) => {
    await supabase.from('user_tags').delete().eq('user_id', userId)
    const rows = tagIds.map((tag_id) => ({ user_id: userId, tag_id }))
    const { error } = await supabase.from('user_tags').insert(rows)
    if (error) throw error
  },

  // AI 추천 게시글: Phase 1 = 태그 매칭 / Phase 2+ = pgvector 유사도
  getRecommendedPosts: async (limit = 6) => {
    const { data, error } = await supabase.rpc('recommend_posts_for_user', { p_limit: limit })
    if (error) throw error
    return (data ?? []) as Post[]
  },
}

// ─── Tags ──────────────────────────────────────────────────────────
export const tagApi = {
  getAll: async () => {
    const { data, error } = await supabase.from('tags').select('*')
    if (error) throw error
    return (data ?? []) as Tag[]
  },

  getByCategory: async (category: Tag['category']) => {
    const { data, error } = await supabase.from('tags').select('*').eq('category', category)
    if (error) throw error
    return (data ?? []) as Tag[]
  },
}

// ─── Posts (통합 게시글) ──────────────────────────────────────────
export const postApi = {
  getList: async (params?: {
    category?: PostCategory
    subCategory?: string
    status?: string
    keyword?: string
    tagIds?: number[]
    page?: number
    size?: number
  }) => {
    const page = params?.page ?? 0
    const size = params?.size ?? 12
    const from = page * size
    const to = from + size - 1

    let query = supabase
      .from('posts')
      .select('*, author:users!posts_author_id_fkey(id, nickname, profile_url, temperature), post_tags(tag:tags(*))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params?.category) query = query.eq('category', params.category)
    if (params?.subCategory) query = query.eq('sub_category', params.subCategory)
    if (params?.status) query = query.eq('status', params.status)
    if (params?.keyword) query = query.ilike('title', `%${params.keyword}%`)

    const { data, error, count } = await query
    if (error) throw error
    return { content: (data ?? []) as Post[], total: count ?? 0, page, size }
  },

  getDetail: async (postId: number) => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, author:users!posts_author_id_fkey(*), post_tags(tag:tags(*))')
      .eq('id', postId)
      .single()
    if (error) throw error
    return data as Post
  },

  create: async (body: Partial<Post>) => {
    const { data, error } = await supabase.from('posts').insert(body).select().single()
    if (error) throw error
    return data as Post
  },

  update: async (postId: number, body: Partial<Post>) => {
    const { data, error } = await supabase
      .from('posts')
      .update(body)
      .eq('id', postId)
      .select()
      .single()
    if (error) throw error
    return data as Post
  },

  delete: async (postId: number) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) throw error
  },

  updateStatus: async (postId: number, status: Post['status']) => {
    const { data, error } = await supabase
      .from('posts')
      .update({ status })
      .eq('id', postId)
      .select()
      .single()
    if (error) throw error
    return data as Post
  },

  getMembers: async (postId: number) => {
    const { data, error } = await supabase
      .from('post_members')
      .select('*, user:users(id, nickname, profile_url, temperature)')
      .eq('post_id', postId)
    if (error) throw error
    return data ?? []
  },

  // AI 추천 팀원: 작성자(리더)에게만 — 모집 역할에 맞는 사용자 추천
  getRecommendedMembers: async (postId: number, limit = 5) => {
    const { data, error } = await supabase.rpc('recommend_members_for_post', { p_post_id: postId, p_limit: limit })
    if (error) throw error
    return (data ?? []) as User[]
  },

  // AI 자연어 검색 — Gemini 임베딩 + pgvector 코사인 유사도
  semanticSearch: async (query: string, limit = 20) => {
    const { data, error } = await supabase.rpc('search_posts_semantic', { p_query: query, p_limit: limit })
    if (error) throw error
    return (data ?? []) as Post[]
  },
}

// 기존 import 호환용 alias (점진적 마이그레이션 대상)
export const projectApi = postApi

// ─── Application ──────────────────────────────────────────────────
export const applicationApi = {
  apply: async (postId: number, body: { introduction: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('applications')
      .insert({ post_id: postId, user_id: user.id, introduction: body.introduction, status: 'PENDING' })
      .select()
      .single()
    if (error) throw error
    return data as Application
  },

  getMyApplications: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('applications')
      .select('*, post:posts(id, title, category, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Application[]
  },

  getPostApplications: async (postId: number) => {
    const { data, error } = await supabase
      .from('applications')
      .select('*, applicant:users!applications_user_id_fkey(id, nickname, profile_url, temperature)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Application[]
  },

  approve: async (applicationId: number) => {
    const { data, error } = await supabase
      .from('applications')
      .update({ status: 'ACCEPTED' })
      .eq('id', applicationId)
      .select()
      .single()
    if (error) throw error
    return data as Application
  },

  reject: async (applicationId: number) => {
    const { data, error } = await supabase
      .from('applications')
      .update({ status: 'REJECTED' })
      .eq('id', applicationId)
      .select()
      .single()
    if (error) throw error
    return data as Application
  },
}

// ─── Review (카테고리별 항목 기반) ────────────────────────────────
export const reviewApi = {
  getItems: async (category: Exclude<PostCategory, 'COMMUNITY'>) => {
    const { data, error } = await supabase
      .from('review_items')
      .select('*')
      .eq('category', category)
      .order('sort_order')
    if (error) throw error
    return data ?? []
  },

  create: async (body: {
    postId: number
    targetId: string
    comment: string
    scores: { itemId: number; score: number }[]
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        post_id: body.postId,
        evaluator_id: user.id,
        target_id: body.targetId,
        comment: body.comment,
      })
      .select()
      .single()
    if (error) throw error
    const scoreRows = body.scores.map((s) => ({
      review_id: review.id,
      item_id: s.itemId,
      score: s.score,
    }))
    const { error: scoreErr } = await supabase.from('review_scores').insert(scoreRows)
    if (scoreErr) throw scoreErr
    return review as Review
  },

  getUserReviews: async (userId: string) => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, evaluator:users!reviews_evaluator_id_fkey(id, nickname), scores:review_scores(*, item:review_items(*))')
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Review[]
  },

  getUserSummary: async (userId: string) => {
    const { data, error } = await supabase.rpc('review_summary_for_user', { p_user_id: userId })
    if (error) throw error
    return data as ReviewSummary
  },
}

// ─── Message (쪽지) ──────────────────────────────────────────────
export const messageApi = {
  send: async (body: { receiverId: string; content: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, receiver_id: body.receiverId, content: body.content })
      .select()
      .single()
    if (error) throw error
    return data as Message
  },

  getInbox: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(id, nickname, profile_url)')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Message[]
  },

  getSent: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('messages')
      .select('*, receiver:users!messages_receiver_id_fkey(id, nickname, profile_url)')
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Message[]
  },

  markRead: async (messageId: number) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId)
    if (error) throw error
  },
}

// ─── Comment (게시글 댓글) ────────────────────────────────────────
export const commentApi = {
  getList: async (postId: number) => {
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:users!comments_user_id_fkey(id, nickname, profile_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as Comment[]
  },

  create: async (postId: number, body: { content: string; parentId?: number }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: body.content,
        parent_id: body.parentId ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return data as Comment
  },

  delete: async (commentId: number) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) throw error
  },
}
