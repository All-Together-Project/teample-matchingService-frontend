import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { postApi } from '@/api'
import ProjectForm from '@/components/project/ProjectForm'
import type { Post } from '@/types'

export default function ProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const postId = Number(id)
  const navigate = useNavigate()

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postApi.getDetail(postId),
  })

  const handleSubmit = async (data: Partial<Post>) => {
    await postApi.update(postId, data)
    navigate(`/posts/${postId}`)
  }

  if (isLoading) return <p style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>불러오는 중...</p>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '1.5rem' }}>공고 수정</h1>
      <ProjectForm initialData={post} onSubmit={handleSubmit} />
    </div>
  )
}
