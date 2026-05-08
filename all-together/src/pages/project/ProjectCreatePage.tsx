import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { postApi, attachmentApi } from '@/api'
import ProjectForm, { type PostFormData } from '@/components/project/ProjectForm'
import type { PostCategory } from '@/types'

const URL_TO_CATEGORY: Record<string, PostCategory> = {
  study:     'STUDY',
  project:   'PROJECT',
  meetup:    'MEETUP',
  community: 'COMMUNITY',
}

const TITLE_BY_CATEGORY: Record<PostCategory, string> = {
  STUDY:     '스터디 모집 공고 등록',
  PROJECT:   '프로젝트 모집 공고 등록',
  MEETUP:    '모임 공고 등록',
  COMMUNITY: '커뮤니티 글 작성',
}

export default function ProjectCreatePage() {
  const { category: urlCategory } = useParams<{ category: string }>()
  const navigate = useNavigate()
  const category = URL_TO_CATEGORY[urlCategory ?? '']
  if (!category) return <Navigate to="/" replace />

  const handleSubmit = async (data: PostFormData) => {
    const created = await postApi.create({
      category,
      subCategory: data.subCategory,
      title: data.title,
      content: data.content,
      capacity: data.capacity,
      period: data.period,
      deadline: data.deadline,
      tagIds: data.tagIds,
      roles: data.roles,
    })

    // 첨부파일 업로드 — 일부 실패해도 게시글은 이미 생성됨
    if (data.pendingFiles.length > 0) {
      const failed: string[] = []
      for (const f of data.pendingFiles) {
        try {
          await attachmentApi.uploadPostFile(created.id, f)
        } catch (e) {
          failed.push(f.name)
          console.error('uploadPostFile failed', f.name, e)
        }
      }
      if (failed.length > 0) {
        alert(`다음 파일 업로드에 실패했습니다:\n${failed.join('\n')}`)
      }
    }

    navigate(`/posts/${created.id}`)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '1.5rem' }}>
        {TITLE_BY_CATEGORY[category]}
      </h1>
      <ProjectForm category={category} onSubmit={handleSubmit} />
    </div>
  )
}
