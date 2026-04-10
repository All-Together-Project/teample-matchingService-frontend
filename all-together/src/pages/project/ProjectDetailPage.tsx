import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi, applicationApi, commentApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import CommentSection from '@/components/project/CommentSection'
import ApplyModal from '@/components/matching/ApplyModal'
import styles from './ProjectDetailPage.module.css'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showApply, setShowApply] = useState(false)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getDetail(projectId).then(r => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: () => projectApi.delete(projectId),
    onSuccess: () => navigate('/projects'),
  })

  const isLeader = user?.id === project?.leader.id

  if (isLoading) return <div className={styles.loading}>불러오는 중...</div>
  if (!project) return <div className={styles.loading}>프로젝트를 찾을 수 없습니다</div>

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* 메인 컨텐츠 */}
        <div className={styles.main}>
          {/* 헤더 */}
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <StatusBadge status={project.status} />
              <span className={styles.category}>{project.category}</span>
            </div>
            <h1 className={styles.title}>{project.title}</h1>
            <div className={styles.meta}>
              <Link to={`/users/${project.leader.id}`} className={styles.leaderLink}>
                <div className={styles.leaderAvatar}>{project.leader.name.charAt(0)}</div>
                <span>{project.leader.nickname}</span>
              </Link>
              <span className={styles.dot}>·</span>
              <span>{new Date(project.createdAt).toLocaleDateString('ko-KR')}</span>
              <span className={styles.dot}>·</span>
              <span>{project.currentMembers} / {project.maxMembers}명</span>
            </div>
            <div className={styles.tags}>
              {project.tags.map(t => <TagChip key={t.id} tag={t} size="sm" />)}
            </div>
          </div>

          {/* 본문 */}
          <div className={styles.section}>
            <h2>프로젝트 소개</h2>
            <p className={styles.desc}>{project.description}</p>
          </div>

          {/* 모집 역할 */}
          <div className={styles.section}>
            <h2>모집 역할</h2>
            <div className={styles.roles}>
              {project.roles.map(role => (
                <div key={role.id} className={styles.roleCard}>
                  <div className={styles.roleTop}>
                    <span className={styles.roleName}>{role.roleName}</span>
                    <span className={styles.roleCount}>{role.filledCount} / {role.count}명</span>
                  </div>
                  <p className={styles.roleDesc}>{role.description}</p>
                  <div className={styles.roleTags}>
                    {role.requiredTags.map(t => <TagChip key={t.id} tag={t} size="sm" />)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 댓글 */}
          <CommentSection projectId={projectId} />
        </div>

        {/* 사이드바 */}
        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            {/* 지원 버튼 */}
            {!isLeader && project.status === 'RECRUITING' && (
              <Button fullWidth size="lg" onClick={() => setShowApply(true)}>
                지원하기
              </Button>
            )}
            {isLeader && (
              <div className={styles.leaderActions}>
                <Link to={`/projects/${project.id}/edit`}>
                  <Button variant="outline" fullWidth>공고 수정</Button>
                </Link>
                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => confirm('정말 삭제하시겠습니까?') && deleteMutation.mutate()}
                  loading={deleteMutation.isPending}
                >
                  공고 삭제
                </Button>
              </div>
            )}

            <div className={styles.sideInfo}>
              <div className={styles.sideRow}>
                <span>상태</span><StatusBadge status={project.status} />
              </div>
              {project.startDate && (
                <div className={styles.sideRow}>
                  <span>시작일</span><span>{project.startDate}</span>
                </div>
              )}
              {project.endDate && (
                <div className={styles.sideRow}>
                  <span>종료일</span><span>{project.endDate}</span>
                </div>
              )}
              <div className={styles.sideRow}>
                <span>모집 인원</span><span>{project.maxMembers}명</span>
              </div>
            </div>
          </div>

          {/* AI 추천 팀원 (리더에게만) */}
          {isLeader && <RecommendedMembers projectId={projectId} />}
        </aside>
      </div>

      {showApply && (
        <ApplyModal
          project={project}
          onClose={() => setShowApply(false)}
          onSuccess={() => { setShowApply(false); qc.invalidateQueries({ queryKey: ['project', projectId] }) }}
        />
      )}
    </div>
  )
}

function RecommendedMembers({ projectId }: { projectId: number }) {
  const { data } = useQuery({
    queryKey: ['recommended-members', projectId],
    queryFn: () => projectApi.getRecommendedMembers(projectId).then(r => r.data.data),
  })
  if (!data?.length) return null
  return (
    <div className={styles.sideCard}>
      <h3 className={styles.sideTitle}>AI 추천 팀원</h3>
      <div className={styles.recommendList}>
        {data.slice(0, 5).map(u => (
          <Link to={`/users/${u.id}`} key={u.id} className={styles.recommendItem}>
            <div className={styles.recAvatar}>{u.name.charAt(0)}</div>
            <div>
              <p className={styles.recName}>{u.nickname}</p>
              <p className={styles.recRole}>{u.roles[0]}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
