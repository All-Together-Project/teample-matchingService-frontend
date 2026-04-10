// ProjectCreatePage.tsx
import { useNavigate } from 'react-router-dom'
import { projectApi } from '@/api'
import ProjectForm from '@/components/project/ProjectForm'
import type { Project } from '@/types'

export default function ProjectCreatePage() {
  const navigate = useNavigate()

  const handleSubmit = async (data: Partial<Project>) => {
    const res = await projectApi.create(data)
    navigate(`/projects/${res.data.data.id}`)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '1.5rem' }}>모집 공고 등록</h1>
      <ProjectForm onSubmit={handleSubmit} />
    </div>
  )
}
