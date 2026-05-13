import { supabase } from './client'
import type {
  User, Post, PostRole, PostCategory, Application, Review, ReviewSummary,
  ProjectReview, ProjectReviewItem, ProjectReviewSummary, LeaderProjectSummary,
  Message, Comment, Tag, Attachment, AuthSession, LoginRequest, SignupRequest,
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
const USER_SELECT = `
  id, email, nickname, major, introduction, temperature,
  profileUrl:profile_url,
  createdAt:created_at,
  userTags:user_tags(tag:tags(id, name, category))
`

function flattenUser(raw: any): User & { tags: Tag[] } {
  const { userTags, ...rest } = raw ?? {}
  return {
    ...rest,
    tags: (userTags ?? []).map((ut: any) => ut.tag).filter(Boolean),
  } as User & { tags: Tag[] }
}

export const userApi = {
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select(USER_SELECT)
      .eq('id', userId)
      .single()
    if (error) throw error
    return flattenUser(data)
  },

  updateProfile: async (userId: string, body: { introduction?: string; major?: string; nickname?: string; profileUrl?: string }) => {
    const update: Record<string, any> = {}
    if (body.introduction !== undefined) update.introduction = body.introduction
    if (body.major !== undefined)        update.major = body.major
    if (body.nickname !== undefined)     update.nickname = body.nickname
    if (body.profileUrl !== undefined)   update.profile_url = body.profileUrl

    const { data, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', userId)
      .select(USER_SELECT)
      .single()
    if (error) throw error
    return flattenUser(data) as User
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

// ─── Search Trending ───────────────────────────────────────────────
export const searchApi = {
  // 검색 실행 시 호출 — 검색어 카운트 증가 (실패해도 무시)
  recordSearch: async (term: string) => {
    if (!term?.trim()) return
    await supabase.rpc('record_search', { p_term: term })
  },

  // 트렌딩 검색어 — 최근 7일
  getTrending: async (limit = 10) => {
    const { data, error } = await supabase.rpc('trending_searches', { p_limit: limit })
    if (error) throw error
    return (data ?? []) as { term: string; count: number }[]
  },
}

// ─── Attachments (Storage + DB) ───────────────────────────────────
// 두 종류 첨부:
//   * post-files (public bucket)        — 게시글 첨부
//   * application-files (private bucket) — 지원서 첨부 (signed URL 사용)
//
// 흐름: 게시글/지원서 row 생성 → 파일 업로드 (storage) → 첨부 row insert
// 파일 경로 규칙: '{owner_table_id}/{timestamp}_{filename}'

const POST_BUCKET = 'post-files'
const APP_BUCKET  = 'application-files'

const sanitize = (name: string) =>
  name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(0, 100)

function withPublicUrl(bucket: string, attachment: any): Attachment {
  const { data } = supabase.storage.from(bucket).getPublicUrl(attachment.filePath)
  return { ...attachment, publicUrl: data.publicUrl }
}

export const attachmentApi = {
  // ── 게시글 ────────────────────────────────────────────────────
  uploadPostFile: async (postId: number, file: File): Promise<Attachment> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')

    const path = `${postId}/${Date.now()}_${sanitize(file.name)}`
    const { error: upErr } = await supabase.storage.from(POST_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) throw upErr

    const { data, error } = await supabase
      .from('post_attachments')
      .insert({
        post_id: postId,
        uploader_id: user.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
      })
      .select(`
        id,
        fileName:file_name,
        filePath:file_path,
        fileSize:file_size,
        mimeType:mime_type,
        uploaderId:uploader_id,
        createdAt:created_at
      `)
      .single()
    if (error) {
      // 롤백: 업로드된 파일 제거
      await supabase.storage.from(POST_BUCKET).remove([path]).catch(() => {})
      throw error
    }
    return withPublicUrl(POST_BUCKET, data)
  },

  deletePostFile: async (attachmentId: number, filePath: string) => {
    const { error } = await supabase.from('post_attachments').delete().eq('id', attachmentId)
    if (error) throw error
    await supabase.storage.from(POST_BUCKET).remove([filePath]).catch(() => {})
  },

  // ── 지원서 ────────────────────────────────────────────────────
  uploadApplicationFile: async (applicationId: number, file: File): Promise<Attachment> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')

    const path = `${applicationId}/${Date.now()}_${sanitize(file.name)}`
    const { error: upErr } = await supabase.storage.from(APP_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) throw upErr

    const { data, error } = await supabase
      .from('application_attachments')
      .insert({
        application_id: applicationId,
        uploader_id: user.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
      })
      .select(`
        id,
        fileName:file_name,
        filePath:file_path,
        fileSize:file_size,
        mimeType:mime_type,
        uploaderId:uploader_id,
        createdAt:created_at
      `)
      .single()
    if (error) {
      await supabase.storage.from(APP_BUCKET).remove([path]).catch(() => {})
      throw error
    }
    return data as Attachment
  },

  deleteApplicationFile: async (attachmentId: number, filePath: string) => {
    const { error } = await supabase.from('application_attachments').delete().eq('id', attachmentId)
    if (error) throw error
    await supabase.storage.from(APP_BUCKET).remove([filePath]).catch(() => {})
  },

  // private bucket — signed URL (1시간) 발급
  getApplicationFileUrl: async (filePath: string, expiresIn = 60 * 60) => {
    const { data, error } = await supabase.storage
      .from(APP_BUCKET)
      .createSignedUrl(filePath, expiresIn)
    if (error) throw error
    return data.signedUrl
  },
}

// ─── Tags ──────────────────────────────────────────────────────────
export const tagApi = {
  getAll: async () => {
    const { data, error } = await supabase.from('tags').select('*').order('id')
    if (error) throw error
    return (data ?? []) as Tag[]
  },

  getByCategory: async (category: Tag['category']) => {
    const { data, error } = await supabase.from('tags').select('*').eq('category', category).order('id')
    if (error) throw error
    return (data ?? []) as Tag[]
  },

  // 인기 태그 — 게시글에 가장 많이 쓰인 태그 N개
  getPopular: async (limit = 12) => {
    const { data, error } = await supabase.rpc('popular_tags', { p_limit: limit })
    if (error) throw error
    return (data ?? []) as (Tag & { usage: number })[]
  },

  // 사용자 정의 태그 — 이미 있으면 그대로 반환, 없으면 새로 생성
  upsert: async (name: string, category: Tag['category'] = 'GENERAL') => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('태그 이름을 입력해주세요')

    // 1) 동일 (name, category) 조회
    const { data: existing } = await supabase
      .from('tags')
      .select('*')
      .eq('name', trimmed)
      .eq('category', category)
      .maybeSingle()
    if (existing) return existing as Tag

    // 2) 없으면 생성
    const { data, error } = await supabase
      .from('tags')
      .insert({ name: trimmed, category })
      .select()
      .single()
    if (error) throw error
    return data as Tag
  },
}

// ─── Posts (통합 게시글) ──────────────────────────────────────────
// Supabase는 snake_case 반환 → select alias 로 camelCase 변환.
// post_tags / post_roles 형태는 flatten 해서 tags / roles 로 정리.
const POST_SELECT = `
  id, category, title, content, capacity, status, period, deadline,
  subCategory:sub_category,
  currentMemberCount:current_member_count,
  authorId:author_id,
  createdAt:created_at,
  author:users!posts_author_id_fkey(
    id, nickname, temperature,
    profileUrl:profile_url
  ),
  postTags:post_tags(
    tag:tags(id, name, category)
  ),
  roles:post_roles_with_count(
    id,
    postId:post_id,
    name, capacity,
    filledCount:filled_count,
    sortOrder:sort_order
  ),
  attachments:post_attachments(
    id,
    fileName:file_name,
    filePath:file_path,
    fileSize:file_size,
    mimeType:mime_type,
    uploaderId:uploader_id,
    createdAt:created_at
  )
`

function flattenPost(raw: any): Post {
  const { postTags, roles, attachments, ...rest } = raw ?? {}
  return {
    ...rest,
    tags: (postTags ?? []).map((pt: any) => pt.tag).filter(Boolean),
    roles: (roles ?? []).slice().sort((a: PostRole, b: PostRole) => a.sortOrder - b.sortOrder),
    attachments: (attachments ?? []).map((a: any) => withPublicUrl('post-files', a)),
  } as Post
}

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

    // 태그 필터: 선택된 태그 중 하나라도 포함하는 게시글
    let tagFilteredPostIds: number[] | null = null
    if (params?.tagIds?.length) {
      const { data: tagPosts } = await supabase
        .from('post_tags')
        .select('post_id')
        .in('tag_id', params.tagIds)
      tagFilteredPostIds = Array.from(new Set((tagPosts ?? []).map((r: any) => r.post_id)))
      if (tagFilteredPostIds.length === 0) {
        return { content: [], total: 0, page, size }
      }
    }

    let query = supabase
      .from('posts')
      .select(POST_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (params?.category)    query = query.eq('category', params.category)
    if (params?.subCategory) query = query.eq('sub_category', params.subCategory)
    if (params?.status)      query = query.eq('status', params.status)
    if (params?.keyword)     query = query.or(`title.ilike.%${params.keyword}%,content.ilike.%${params.keyword}%`)
    if (tagFilteredPostIds)  query = query.in('id', tagFilteredPostIds)

    const { data, error, count } = await query
    if (error) throw error
    return {
      content: (data ?? []).map(flattenPost),
      total: count ?? 0,
      page,
      size,
    }
  },

  getDetail: async (postId: number) => {
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', postId)
      .single()
    if (error) throw error
    return flattenPost(data)
  },

  // 상세 진입 시 조회수 1 증가 (실패해도 무시)
  incrementView: async (postId: number) => {
    await supabase.rpc('increment_post_view', { p_post_id: postId })
  },

  // 인기 게시글 (조회수 desc)
  getPopular: async (limit = 8) => {
    const { data, error } = await supabase.rpc('popular_posts', { p_limit: limit })
    if (error) throw error
    return ((data ?? []) as any[]).map(p => ({
      ...p,
      subCategory: p.sub_category,
      currentMemberCount: p.current_member_count,
      authorId: p.author_id,
      createdAt: p.created_at,
      viewCount: p.view_count,
    })) as (Post & { viewCount: number })[]
  },

  create: async (body: {
    category: PostCategory
    subCategory: string
    title: string
    content: string
    capacity?: number | null
    status?: Post['status']
    period?: string | null
    deadline?: string | null
    tagIds?: number[]
    roles?: { name: string; capacity: number }[]    // 모집 역할
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')

    // 1) post insert
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        category: body.category,
        sub_category: body.subCategory,
        title: body.title,
        content: body.content,
        capacity: body.capacity ?? null,
        status: body.status ?? (body.category === 'COMMUNITY' ? 'GENERAL' : 'RECRUITING'),
        period: body.period ?? null,
        deadline: body.deadline ?? null,
        author_id: user.id,
      })
      .select()
      .single()
    if (error) throw error

    // 2) tag 연결
    if (body.tagIds?.length) {
      const tagRows = body.tagIds.map((tag_id) => ({ post_id: post.id, tag_id }))
      const { error: tagErr } = await supabase.from('post_tags').insert(tagRows)
      if (tagErr) throw tagErr
    }

    // 3) 모집 역할 insert
    if (body.roles?.length) {
      const roleRows = body.roles.map((r, i) => ({
        post_id: post.id,
        name: r.name.trim(),
        capacity: r.capacity,
        sort_order: i,
      }))
      const { error: roleErr } = await supabase.from('post_roles').insert(roleRows)
      if (roleErr) throw roleErr
    }

    // 4) AI 임베딩 — 백그라운드로 fire-and-forget (실패해도 게시글 자체는 정상)
    postApi.embedPost(post.id, `${body.title}\n\n${body.content}`).catch(() => {})

    return post as Post
  },

  update: async (postId: number, body: {
    title?: string
    content?: string
    subCategory?: string
    capacity?: number
    period?: string
    deadline?: string
    status?: Post['status']
    tagIds?: number[]
  }) => {
    const update: Record<string, any> = {}
    if (body.title !== undefined)       update.title = body.title
    if (body.content !== undefined)     update.content = body.content
    if (body.subCategory !== undefined) update.sub_category = body.subCategory
    if (body.capacity !== undefined)    update.capacity = body.capacity
    if (body.period !== undefined)      update.period = body.period
    if (body.deadline !== undefined)    update.deadline = body.deadline
    if (body.status !== undefined)      update.status = body.status

    const { data, error } = await supabase
      .from('posts')
      .update(update)
      .eq('id', postId)
      .select()
      .single()
    if (error) throw error

    // 태그 갱신
    if (body.tagIds) {
      await supabase.from('post_tags').delete().eq('post_id', postId)
      if (body.tagIds.length) {
        const rows = body.tagIds.map((tag_id) => ({ post_id: postId, tag_id }))
        const { error: tagErr } = await supabase.from('post_tags').insert(rows)
        if (tagErr) throw tagErr
      }
    }

    // title/content가 변경됐으면 임베딩 재생성 (background)
    if (body.title !== undefined || body.content !== undefined) {
      postApi.embedPost(postId).catch(() => {})
    }
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

  // 내가 작성한 게시글 — 마이페이지 "모집 공고" 탭용
  getMyPosts: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(flattenPost)
  },

  // 내가 참여중인/참여했던 프로젝트 — post_members 기준
  // (커뮤니티는 멤버 개념 없음 → 자동 제외)
  getMemberPosts: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')

    const { data: memberships, error: mErr } = await supabase
      .from('post_members')
      .select('post_id')
      .eq('user_id', user.id)
    if (mErr) throw mErr

    const ids = (memberships ?? []).map((m: any) => m.post_id)
    if (ids.length === 0) return [] as Post[]

    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .in('id', ids)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(flattenPost)
  },

  getMembers: async (postId: number) => {
    const { data, error } = await supabase
      .from('post_members')
      .select(`
        id,
        postId:post_id,
        userId:user_id,
        role,
        roleId:role_id,
        user:users(id, nickname, temperature, profileUrl:profile_url)
      `)
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

  // AI 자연어 검색 — semantic-search 엣지 함수 호출
  semanticSearch: async (params: {
    query: string
    limit?: number
    threshold?: number
    category?: string
    status?: string
    subCategory?: string
  }) => {
    const { data, error } = await supabase.functions.invoke('semantic-search', {
      body: params,
    })
    if (error) throw error
    const matches = (data?.matches ?? []) as any[]
    // RPC 결과(snake_case) → 프론트 모델(camelCase)
    return matches.map((m) => ({
      id: m.id,
      category: m.category,
      subCategory: m.sub_category,
      title: m.title,
      content: m.content,
      capacity: m.capacity,
      currentMemberCount: m.current_member_count,
      status: m.status,
      period: m.period,
      deadline: m.deadline,
      authorId: m.author_id,
      createdAt: m.created_at,
      similarity: m.similarity,
      author: m.author
        ? {
            id: m.author.id,
            nickname: m.author.nickname,
            profileUrl: m.author.profile_url,
            temperature: m.author.temperature,
          }
        : undefined,
      tags: m.tags ?? [],
    })) as (Post & { similarity: number })[]
  },

  // 게시글 작성/수정 후 임베딩 재생성 — 실패해도 무시 (의미 검색만 빠짐)
  embedPost: async (postId: number, text?: string) => {
    try {
      await supabase.functions.invoke('embed-post', {
        body: { postId, text },
      })
    } catch (e) {
      console.warn('embed-post failed (post saved but not embedded)', e)
    }
  },
}

// ─── AI Recommend (프롬프트 기반 추천) ────────────────────────────
export interface RecommendedProject {
  id: number
  category: PostCategory
  subCategory: string
  title: string
  content: string
  capacity: number | null
  currentMemberCount: number
  status: string
  similarity: number
  reason: string
  author: { id: string; nickname: string; profileUrl?: string; temperature: number } | null
  tags: Tag[]
}

export interface RecommendedMember {
  id: string
  nickname: string
  profileUrl?: string
  temperature: number
  introduction?: string
  tagOverlap: number
  tags: Tag[]
  reason: string
}

export interface RecommendProjectsResult {
  primary: RecommendedProject[]
  related: RecommendedProject[]
  primaryIntro: string
  relatedIntro: string
}

export interface RecommendMembersResult {
  intro: string
  results: RecommendedMember[]
}

export const recommendApi = {
  recommendProjects: async (prompt: string): Promise<RecommendProjectsResult> => {
    const { data, error } = await supabase.functions.invoke('ai-recommend', {
      body: { mode: 'project', prompt },
    })
    if (error) throw error
    return {
      primary: (data?.primary ?? []) as RecommendedProject[],
      related: (data?.related ?? []) as RecommendedProject[],
      primaryIntro: data?.primaryIntro ?? '',
      relatedIntro: data?.relatedIntro ?? '',
    }
  },

  recommendMembers: async (postId: number, prompt: string): Promise<RecommendMembersResult> => {
    const { data, error } = await supabase.functions.invoke('ai-recommend', {
      body: { mode: 'member', prompt, postId },
    })
    if (error) throw error
    return {
      intro: data?.intro ?? '',
      results: (data?.results ?? []) as RecommendedMember[],
    }
  },
}

// 기존 import 호환용 alias (점진적 마이그레이션 대상)
export const projectApi = postApi

// ─── Application ──────────────────────────────────────────────────
const APPLICATION_SELECT_BASE = `
  id,
  postId:post_id,
  userId:user_id,
  introduction, status,
  roleId:role_id,
  createdAt:created_at,
  role:post_roles(id, name, capacity),
  attachments:application_attachments(
    id,
    fileName:file_name,
    filePath:file_path,
    fileSize:file_size,
    mimeType:mime_type,
    uploaderId:uploader_id,
    createdAt:created_at
  )
`

export const applicationApi = {
  apply: async (postId: number, body: { introduction: string; roleId?: number }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('applications')
      .insert({
        post_id: postId,
        user_id: user.id,
        introduction: body.introduction,
        status: 'PENDING',
        role_id: body.roleId ?? null,
      })
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
      .select(`${APPLICATION_SELECT_BASE}, post:posts(id, title, category, status)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as Application[]
  },

  getPostApplications: async (postId: number) => {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        ${APPLICATION_SELECT_BASE},
        applicant:users!applications_user_id_fkey(
          id, nickname, temperature,
          profileUrl:profile_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as Application[]
  },

  // 내가 작성한 모든 게시글의 지원서 — "받은 지원서 관리" 탭용
  getReceivedApplications: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, title, category, status,
        roles:post_roles_with_count(
          id, name, capacity,
          filledCount:filled_count
        ),
        applications(
          id,
          postId:post_id,
          userId:user_id,
          introduction, status,
          roleId:role_id,
          createdAt:created_at,
          applicant:users!applications_user_id_fkey(
            id, nickname, temperature,
            profileUrl:profile_url
          ),
          attachments:application_attachments(
            id,
            fileName:file_name,
            filePath:file_path,
            fileSize:file_size,
            mimeType:mime_type,
            uploaderId:uploader_id,
            createdAt:created_at
          )
        )
      `)
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
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
      .select('id, category, itemName:item_name, sortOrder:sort_order')
      .eq('category', category)
      .order('sort_order')
    if (error) throw error
    return data ?? []
  },

  // 내가 이 게시글에서 작성한 리뷰 (target_id 목록)
  getMyReviewsForPost: async (postId: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return [] as { id: number; targetId: string }[]
    const { data, error } = await supabase
      .from('reviews')
      .select('id, targetId:target_id')
      .eq('post_id', postId)
      .eq('evaluator_id', user.id)
    if (error) throw error
    return (data ?? []) as { id: number; targetId: string }[]
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

    // 매너 온도 갱신 (실패해도 리뷰는 이미 저장됨 — 부수효과 무시)
    await supabase.rpc('apply_review_temperature', { p_review_id: review.id })

    return review as Review
  },

  getUserReviews: async (userId: string) => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        postId:post_id,
        comment,
        createdAt:created_at,
        post:posts(title, category),
        evaluator:users!reviews_evaluator_id_fkey(id, nickname),
        scoreRaw:review_scores(
          itemId:item_id,
          score,
          item:review_items(itemName:item_name)
        )
      `)
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((raw: any) => ({
      id: raw.id,
      postId: raw.postId,
      postCategory: raw.post?.category,
      postTitle: raw.post?.title ?? '',
      evaluator: raw.evaluator ?? { id: '', nickname: '익명' },
      target: { id: userId, nickname: '' },
      comment: raw.comment ?? '',
      createdAt: raw.createdAt,
      scores: (raw.scoreRaw ?? []).map((s: any) => ({
        itemId: s.itemId,
        itemName: s.item?.itemName ?? '',
        score: s.score,
      })),
    })) as Review[]
  },

  // 특정 게시글에서 한 멤버가 받은 리뷰 (멤버 카드 클릭 시 익명 리뷰 모달용)
  getForPostAndTarget: async (postId: number, targetId: string) => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        postId:post_id,
        comment,
        createdAt:created_at,
        post:posts(title, category),
        evaluator:users!reviews_evaluator_id_fkey(id, nickname),
        scoreRaw:review_scores(
          itemId:item_id,
          score,
          item:review_items(itemName:item_name)
        )
      `)
      .eq('post_id', postId)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((raw: any) => ({
      id: raw.id,
      postId: raw.postId,
      postCategory: raw.post?.category,
      postTitle: raw.post?.title ?? '',
      evaluator: raw.evaluator ?? { id: '', nickname: '익명' },
      target: { id: targetId, nickname: '' },
      comment: raw.comment ?? '',
      createdAt: raw.createdAt,
      scores: (raw.scoreRaw ?? []).map((s: any) => ({
        itemId: s.itemId,
        itemName: s.item?.itemName ?? '',
        score: s.score,
      })),
    })) as Review[]
  },

  getUserSummary: async (userId: string) => {
    const { data, error } = await supabase.rpc('review_summary_for_user', { p_user_id: userId })
    if (error) throw error
    return data as ReviewSummary
  },
}

// ─── Project Review (프로젝트 자체 리뷰) ──────────────────────────
export const projectReviewApi = {
  // 카테고리별 평가 항목 템플릿
  getItems: async (category: 'STUDY' | 'PROJECT' | 'MEETUP') => {
    const { data, error } = await supabase
      .from('project_review_items')
      .select('id, category, itemName:item_name, sortOrder:sort_order')
      .eq('category', category)
      .order('sort_order')
    if (error) throw error
    return (data ?? []) as ProjectReviewItem[]
  },

  // 내가 이 게시글에 작성한 프로젝트 리뷰 (있으면 1개)
  getMyForPost: async (postId: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('project_reviews')
      .select('id')
      .eq('post_id', postId)
      .eq('evaluator_id', user.id)
      .maybeSingle()
    if (error) throw error
    return data as { id: number } | null
  },

  // 게시글의 모든 프로젝트 리뷰
  getForPost: async (postId: number): Promise<ProjectReview[]> => {
    const { data, error } = await supabase
      .from('project_reviews')
      .select(`
        id,
        postId:post_id,
        comment,
        createdAt:created_at,
        evaluator:users!project_reviews_evaluator_id_fkey(
          id, nickname, temperature,
          profileUrl:profile_url
        ),
        scoreRaw:project_review_scores(
          itemId:item_id,
          score,
          item:project_review_items(itemName:item_name, sortOrder:sort_order)
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((raw: any) => ({
      id: raw.id,
      postId: raw.postId,
      evaluator: Array.isArray(raw.evaluator) ? raw.evaluator[0] : raw.evaluator,
      comment: raw.comment ?? '',
      createdAt: raw.createdAt,
      scores: ((raw.scoreRaw ?? []) as any[])
        .map((s) => ({
          itemId: s.itemId,
          itemName: s.item?.itemName ?? '',
          sortOrder: s.item?.sortOrder ?? 0,
          score: s.score,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ itemId, itemName, score }) => ({ itemId, itemName, score })),
    })) as ProjectReview[]
  },

  // 게시글 단위 요약 (하단 노출용)
  getSummaryForPost: async (postId: number) => {
    const { data, error } = await supabase.rpc('project_review_summary_for_post', { p_post_id: postId })
    if (error) throw error
    return data as ProjectReviewSummary
  },

  // 리더 단위 요약 (마이페이지 / 프로필 신뢰도 지표)
  getLeaderSummary: async (userId: string) => {
    const { data, error } = await supabase.rpc('leader_project_summary', { p_user_id: userId })
    if (error) throw error
    return data as LeaderProjectSummary
  },

  // 리더가 운영한 프로젝트들에 달린 리뷰 모두 가져오기 (마이페이지 "리뷰" 탭용)
  getLeaderReviews: async (userId: string): Promise<ProjectReview[]> => {
    const { data: posts, error: pErr } = await supabase
      .from('posts')
      .select('id, title, category')
      .eq('author_id', userId)
      .in('category', ['STUDY', 'PROJECT', 'MEETUP'])
      .eq('status', 'FINISHED')
    if (pErr) throw pErr
    const postMap = new Map(
      (posts ?? []).map((p: any) => [p.id, { title: p.title, category: p.category }]),
    )
    const ids = Array.from(postMap.keys())
    if (ids.length === 0) return []

    const { data, error } = await supabase
      .from('project_reviews')
      .select(`
        id,
        postId:post_id,
        comment,
        createdAt:created_at,
        evaluator:users!project_reviews_evaluator_id_fkey(
          id, nickname, temperature,
          profileUrl:profile_url
        ),
        scoreRaw:project_review_scores(
          itemId:item_id,
          score,
          item:project_review_items(itemName:item_name, sortOrder:sort_order)
        )
      `)
      .in('post_id', ids)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((raw: any) => {
      const meta = postMap.get(raw.postId) ?? { title: '', category: undefined }
      return {
        id: raw.id,
        postId: raw.postId,
        evaluator: Array.isArray(raw.evaluator) ? raw.evaluator[0] : raw.evaluator,
        comment: raw.comment ?? '',
        createdAt: raw.createdAt,
        postTitle: meta.title,
        postCategory: meta.category,
        scores: ((raw.scoreRaw ?? []) as any[])
          .map((s) => ({
            itemId: s.itemId,
            itemName: s.item?.itemName ?? '',
            sortOrder: s.item?.sortOrder ?? 0,
            score: s.score,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(({ itemId, itemName, score }) => ({ itemId, itemName, score })),
      }
    }) as ProjectReview[]
  },

  // 리뷰 작성
  create: async (body: {
    postId: number
    comment: string
    scores: { itemId: number; score: number }[]
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data: review, error } = await supabase
      .from('project_reviews')
      .insert({
        post_id: body.postId,
        evaluator_id: user.id,
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
    const { error: scoreErr } = await supabase.from('project_review_scores').insert(scoreRows)
    if (scoreErr) throw scoreErr
    return review as { id: number }
  },
}

// ─── Message (쪽지) ──────────────────────────────────────────────
const MESSAGE_BASE = `
  id, content, type,
  isRead:is_read,
  createdAt:created_at
`

function normalizeMessage(raw: any): Message {
  return {
    ...raw,
    sender: raw.sender ?? { id: 'system', nickname: '시스템', profileUrl: undefined },
    receiver: raw.receiver ?? { id: 'system', nickname: '시스템', profileUrl: undefined },
  } as Message
}

export const messageApi = {
  send: async (body: { receiverId: string; content: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, receiver_id: body.receiverId, content: body.content, type: 'PERSONAL' })
      .select()
      .single()
    if (error) throw error
    return data as Message
  },

  // 이메일로 수신자를 찾아 쪽지 발송
  sendByEmail: async (body: { email: string; content: string }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')

    const target = body.email.trim().toLowerCase()
    if (!target) throw new Error('이메일을 입력해주세요')

    const { data: receiver, error: findErr } = await supabase
      .from('users')
      .select('id, email, nickname')
      .eq('email', target)
      .maybeSingle()
    if (findErr) throw findErr
    if (!receiver) throw new Error('해당 이메일의 사용자를 찾을 수 없습니다')
    if (receiver.id === user.id) throw new Error('본인에게 쪽지를 보낼 수 없습니다')

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, receiver_id: receiver.id, content: body.content, type: 'PERSONAL' })
      .select()
      .single()
    if (error) throw error
    return { message: data as Message, receiver }
  },

  getInbox: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('messages')
      .select(`
        ${MESSAGE_BASE},
        sender:users!messages_sender_id_fkey(id, nickname, profileUrl:profile_url)
      `)
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(normalizeMessage)
  },

  getSent: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('NOT_AUTHENTICATED')
    const { data, error } = await supabase
      .from('messages')
      .select(`
        ${MESSAGE_BASE},
        receiver:users!messages_receiver_id_fkey(id, nickname, profileUrl:profile_url)
      `)
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(normalizeMessage)
  },

  getUnreadCount: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false)
    if (error) return 0
    return count ?? 0
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
