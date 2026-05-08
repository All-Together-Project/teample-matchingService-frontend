import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { postApi, attachmentApi } from '@/api'
import ProjectForm, { type PostFormData } from '@/components/project/ProjectForm'

export default function ProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const postId = Number(id)
  const navigate = useNavigate()

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postApi.getDetail(postId),
  })

  const handleSubmit = async (data: PostFormData) => {
    await postApi.update(postId, {
      title: data.title,
      content: data.content,
      subCategory: data.subCategory,
      capacity: data.capacity ?? undefined,
      period: data.period ?? undefined,
      deadline: data.deadline ?? undefined,
      tagIds: data.tagIds,
    })

    // 기존 첨부 삭제
    for (const a of data.removedAttachments) {
      try { await attachmentApi.deletePostFile(a.id, a.filePath) }
      catch (e) { console.error('deletePostFile failed', e) }
    }

    // 신규 첨부 업로드
    if (data.pendingFiles.length > 0) {
      const failed: string[] = []
      for (const f of data.pendingFiles) {
        try { await attachmentApi.uploadPostFile(postId, f) }
        catch (e) { failed.push(f.name); console.error(e) }
      }
      if (failed.length > 0) alert(`다음 파일 업로드에 실패했습니다:\n${failed.join('\n')}`)
    }

    navigate(`/posts/${postId}`)
  }

  if (isLoading || !post) return <p style={{ padding: '2rem', color: 'var(--color-text-secondary)' }}>불러오는 중...</p>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: '1.5rem' }}>공고 수정</h1>
      <ProjectForm category={post.category} initialData={post} onSubmit={handleSubmit} />
    </div>
  )
}
