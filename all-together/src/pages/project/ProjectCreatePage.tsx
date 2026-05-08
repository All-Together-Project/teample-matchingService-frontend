import { useNavigate } from 'react-router-dom'
import { postApi } from '@/api'
import ProjectForm from '@/components/project/ProjectForm'
import type { Post } from '@/types'

export default function ProjectCreatePage() {
  const navigate = useNavigate()

  const handleSubmit = async (data: Partial<Post>) => {
    const created = await postApi.create({ ...data, category: 'PROJECT' })
    navigate(`/posts/${created.id}`)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '1.5rem' }}>모집 공고 등록</h1>
      <ProjectForm onSubmit={handleSubmit} />
    </div>
  )
}
