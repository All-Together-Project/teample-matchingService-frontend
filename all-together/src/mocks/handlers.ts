import { http, HttpResponse } from 'msw'
import {
  mockUsers, mockProjects, mockTags,
  mockApplications, mockReviews, mockMessages, mockComments,
} from './data'
import type { Project, Application, Comment } from '@/types'

// 로컬 복사본 (런타임 중 변경 가능)
let users = [...mockUsers]
let projects = [...mockProjects]
let applications = [...mockApplications]
let messages = [...mockMessages]
let comments = [...mockComments]

// 현재 로그인 유저 (기본값 id=1)
let currentUserId = 1

const ok = (data: unknown) => HttpResponse.json({ success: true, data })
const page = (data: unknown[], total: number) =>
  HttpResponse.json({
    success: true,
    data: { content: data, totalElements: total, totalPages: Math.ceil(total / 12), size: 12, number: 0, first: true, last: true },
  })

export const handlers = [

  // ── Auth ────────────────────────────────────────────────────────
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    const user = users.find(u => u.email === body.email)
    if (!user) return HttpResponse.json({ success: false, message: '이메일 또는 비밀번호를 확인해주세요' }, { status: 401 })
    currentUserId = user.id
    return ok({ accessToken: `mock-token-${user.id}`, refreshToken: `mock-refresh-${user.id}` })
  }),

  http.post('/api/auth/signup', async ({ request }) => {
    const body = await request.json() as { email: string; name: string; nickname: string }
    const newUser = {
      id: users.length + 1,
      email: body.email,
      name: body.name,
      nickname: body.nickname,
      roles: [] as any,
      techTags: [],
      interestTags: [],
      temperature: 36.5,
      tier: 'ROOKIE' as const,
      createdAt: new Date().toISOString(),
    }
    users.push(newUser)
    currentUserId = newUser.id
    return ok(newUser)
  }),

  http.get('/api/auth/me', () => {
    const user = users.find(u => u.id === currentUserId)
    return user ? ok(user) : HttpResponse.json({ success: false }, { status: 401 })
  }),

  http.post('/api/auth/logout', () => {
    return ok({})
  }),

  http.post('/api/auth/refresh', () => {
    return ok({ accessToken: `mock-token-${currentUserId}` })
  }),

  // ── Tags ────────────────────────────────────────────────────────
  http.get('/api/tags', ({ request }) => {
    const type = new URL(request.url).searchParams.get('type')
    const filtered = type ? mockTags.filter(t => t.type === type) : mockTags
    return ok(filtered)
  }),

  // ── Users ───────────────────────────────────────────────────────
  http.get('/api/users/:id', ({ params }) => {
    const user = users.find(u => u.id === Number(params.id))
    return user ? ok(user) : HttpResponse.json({ success: false }, { status: 404 })
  }),

  http.put('/api/users/:id', async ({ params, request }) => {
    const body = await request.json() as Partial<typeof users[0]>
    const idx = users.findIndex(u => u.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ success: false }, { status: 404 })
    users[idx] = { ...users[idx], ...body }
    return ok(users[idx])
  }),

  http.put('/api/users/:id/tags', async ({ params, request }) => {
    const body = await request.json() as { tagIds: number[] }
    const idx = users.findIndex(u => u.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ success: false }, { status: 404 })
    const techTags = mockTags.filter(t => body.tagIds.includes(t.id) && t.type === 'TECH')
    const interestTags = mockTags.filter(t => body.tagIds.includes(t.id) && t.type === 'INTEREST')
    users[idx] = { ...users[idx], techTags, interestTags }
    return ok(users[idx])
  }),

  http.get('/api/users/me/recommended-projects', () => {
    return ok(projects.filter(p => p.status === 'RECRUITING').slice(0, 4))
  }),

  // ── Projects ────────────────────────────────────────────────────
  http.get('/api/projects', ({ request }) => {
    const params = new URL(request.url).searchParams
    const status   = params.get('status')
    const keyword  = params.get('keyword')?.toLowerCase()
    const category = params.get('category')
    const tagIds   = params.getAll('tagIds').map(Number)

    let result = [...projects]
    if (status)   result = result.filter(p => p.status === status)
    if (keyword)  result = result.filter(p => p.title.toLowerCase().includes(keyword) || p.description.toLowerCase().includes(keyword))
    if (category) result = result.filter(p => p.category === category)
    if (tagIds.length) result = result.filter(p => tagIds.some(id => p.tags.some(t => t.id === id)))

    return page(result, result.length)
  }),

  http.get('/api/projects/:id', ({ params }) => {
    const project = projects.find(p => p.id === Number(params.id))
    return project ? ok(project) : HttpResponse.json({ success: false }, { status: 404 })
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json() as Partial<Project>
    const leader = users.find(u => u.id === currentUserId)!
    const newProject: Project = {
      id: projects.length + 1,
      title: body.title ?? '새 프로젝트',
      description: body.description ?? '',
      status: 'RECRUITING',
      category: body.category ?? '기타',
      startDate: body.startDate,
      endDate: body.endDate,
      maxMembers: body.maxMembers ?? 4,
      currentMembers: 1,
      leader: { id: leader.id, name: leader.name, nickname: leader.nickname, profileImage: leader.profileImage },
      tags: body.tags ?? [],
      roles: body.roles ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    projects.push(newProject)
    return ok(newProject)
  }),

  http.put('/api/projects/:id', async ({ params, request }) => {
    const body = await request.json() as Partial<Project>
    const idx = projects.findIndex(p => p.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ success: false }, { status: 404 })
    projects[idx] = { ...projects[idx], ...body, updatedAt: new Date().toISOString() }
    return ok(projects[idx])
  }),

  http.delete('/api/projects/:id', ({ params }) => {
    projects = projects.filter(p => p.id !== Number(params.id))
    return ok({})
  }),

  http.patch('/api/projects/:id/status', async ({ params, request }) => {
    const body = await request.json() as { status: Project['status'] }
    const idx = projects.findIndex(p => p.id === Number(params.id))
    if (idx === -1) return HttpResponse.json({ success: false }, { status: 404 })
    projects[idx].status = body.status
    return ok(projects[idx])
  }),

  http.get('/api/projects/:id/members', ({ params }) => {
    const project = projects.find(p => p.id === Number(params.id))
    if (!project) return HttpResponse.json({ success: false }, { status: 404 })
    const members = applications
      .filter(a => a.projectId === Number(params.id) && a.status === 'APPROVED')
      .map(a => users.find(u => u.id === a.applicant.id))
      .filter(Boolean)
    return ok(members)
  }),

  http.get('/api/projects/:id/recommended-members', () => {
    return ok(users.filter(u => u.id !== currentUserId).slice(0, 3))
  }),

  // ── Applications ────────────────────────────────────────────────
  http.post('/api/projects/:id/applications', async ({ params, request }) => {
    const body = await request.json() as { roleId: number; motivation: string; introduction: string }
    const project = projects.find(p => p.id === Number(params.id))
    const applicant = users.find(u => u.id === currentUserId)!
    const role = project?.roles.find(r => r.id === body.roleId)

    const newApp: Application = {
      id: applications.length + 1,
      projectId: Number(params.id),
      project: project ? { id: project.id, title: project.title, status: project.status } : undefined,
      applicant: { id: applicant.id, name: applicant.name, nickname: applicant.nickname, profileImage: applicant.profileImage },
      roleId: body.roleId,
      roleName: role?.roleName ?? '역할',
      motivation: body.motivation,
      introduction: body.introduction,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    applications.push(newApp)
    return ok(newApp)
  }),

  http.get('/api/applications/me', () => {
    const mine = applications.filter(a => a.applicant.id === currentUserId)
    return ok(mine)
  }),

  http.get('/api/projects/:id/applications', ({ params }) => {
    const list = applications.filter(a => a.projectId === Number(params.id))
    return ok(list)
  }),

  http.patch('/api/applications/:id/approve', ({ params }) => {
    const idx = applications.findIndex(a => a.id === Number(params.id))
    if (idx !== -1) applications[idx].status = 'APPROVED'
    return ok(applications[idx])
  }),

  http.patch('/api/applications/:id/reject', ({ params }) => {
    const idx = applications.findIndex(a => a.id === Number(params.id))
    if (idx !== -1) applications[idx].status = 'REJECTED'
    return ok(applications[idx])
  }),

  http.patch('/api/applications/:id/cancel', ({ params }) => {
    const idx = applications.findIndex(a => a.id === Number(params.id))
    if (idx !== -1) applications[idx].status = 'CANCELLED'
    return ok(applications[idx])
  }),

  // ── Reviews ─────────────────────────────────────────────────────
  http.post('/api/reviews', async ({ request }) => {
    const body = await request.json() as Partial<typeof mockReviews[0]>
    const reviewer = users.find(u => u.id === currentUserId)!
    const newReview = {
      id: mockReviews.length + 1,
      projectId: body.projectId ?? 0,
      projectTitle: body.projectTitle ?? '',
      reviewer: { id: reviewer.id, name: reviewer.name, nickname: reviewer.nickname },
      reviewee: body.reviewee!,
      expertise: body.expertise ?? 3,
      communication: body.communication ?? 3,
      punctuality: body.punctuality ?? 3,
      participation: body.participation ?? 3,
      passion: body.passion ?? 3,
      comment: body.comment ?? '',
      createdAt: new Date().toISOString(),
    }
    mockReviews.push(newReview)
    return ok(newReview)
  }),

  http.get('/api/reviews/users/:id', ({ params }) => {
    const userReviews = mockReviews.filter(r => r.reviewee.id === Number(params.id))
    return ok(userReviews)
  }),

  http.get('/api/reviews/users/:id/summary', ({ params }) => {
    const userReviews = mockReviews.filter(r => r.reviewee.id === Number(params.id))
    if (!userReviews.length) return ok({ userId: Number(params.id), averageExpertise: 0, averageCommunication: 0, averagePunctuality: 0, averageParticipation: 0, averagePassion: 0, totalReviews: 0, recentComment: '' })
    const avg = (key: keyof typeof userReviews[0]) =>
      userReviews.reduce((s, r) => s + (r[key] as number), 0) / userReviews.length
    return ok({
      userId: Number(params.id),
      averageExpertise: avg('expertise'),
      averageCommunication: avg('communication'),
      averagePunctuality: avg('punctuality'),
      averageParticipation: avg('participation'),
      averagePassion: avg('passion'),
      totalReviews: userReviews.length,
      recentComment: userReviews[userReviews.length - 1]?.comment ?? '',
    })
  }),

  // ── Messages ────────────────────────────────────────────────────
  http.post('/api/messages', async ({ request }) => {
    const body = await request.json() as { receiverId: number; content: string }
    const sender = users.find(u => u.id === currentUserId)!
    const receiver = users.find(u => u.id === body.receiverId)!
    const newMsg = {
      id: messages.length + 1,
      sender: { id: sender.id, name: sender.name, nickname: sender.nickname, profileImage: sender.profileImage },
      receiver: { id: receiver.id, name: receiver.name, nickname: receiver.nickname, profileImage: receiver.profileImage },
      content: body.content,
      isRead: false,
      type: 'PERSONAL' as const,
      createdAt: new Date().toISOString(),
    }
    messages.push(newMsg)
    return ok(newMsg)
  }),

  http.get('/api/messages/inbox', () => {
    const inbox = messages.filter(m => m.receiver.id === currentUserId)
    return ok(inbox.reverse())
  }),

  http.get('/api/messages/sent', () => {
    const sent = messages.filter(m => m.sender.id === currentUserId)
    return ok(sent.reverse())
  }),

  http.patch('/api/messages/:id/read', ({ params }) => {
    const msg = messages.find(m => m.id === Number(params.id))
    if (msg) msg.isRead = true
    return ok({})
  }),

  // ── Comments ────────────────────────────────────────────────────
  http.get('/api/projects/:id/comments', ({ params }) => {
    const projectComments = comments.filter(c => c.projectId === Number(params.id) && !c.parentId)
    return ok(projectComments)
  }),

  http.post('/api/projects/:id/comments', async ({ params, request }) => {
    const body = await request.json() as { content: string; parentId?: number }
    const author = users.find(u => u.id === currentUserId)!
    const newComment: Comment = {
      id: comments.length + 1,
      projectId: Number(params.id),
      author: { id: author.id, name: author.name, nickname: author.nickname, profileImage: author.profileImage },
      content: body.content,
      parentId: body.parentId,
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    comments.push(newComment)
    // 부모 댓글에 replies 추가
    if (body.parentId) {
      const parent = comments.find(c => c.id === body.parentId)
      if (parent) parent.replies = [...(parent.replies ?? []), newComment]
    }
    return ok(newComment)
  }),

  http.delete('/api/projects/:projectId/comments/:commentId', ({ params }) => {
    comments = comments.filter(c => c.id !== Number(params.commentId))
    return ok({})
  }),
]
