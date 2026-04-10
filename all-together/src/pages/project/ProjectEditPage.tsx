import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi } from '@/api'
import ProjectForm from '@/components/project/ProjectForm'
import type { Project } from '@/types'

export default function ProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const navigate = useNavigate()

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getDetail(projectId).then(r => r.data.data),
  })

  const handleSubmit = async (data: Partial<Project>) => {
    await projectApi.update(projectId, data)
    navigate(`/projects/${projectId}`)
  }

  if (isLoading) return <p style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>불러오는 중...</p>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '1.5rem' }}>공고 수정</h1>
      <ProjectForm initialData={project} onSubmit={handleSubmit} />
    </div>
  )
}
