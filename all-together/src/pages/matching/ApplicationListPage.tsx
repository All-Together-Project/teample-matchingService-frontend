import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { StatusBadge } from '@/components/common/Badge'
import Button from '@/components/common/Button'
import styles from './ApplicationListPage.module.css'

export default function ApplicationListPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'mine' | 'received'>('mine')

  // 내가 지원한 목록
  const { data: myApps } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => applicationApi.getMyApplications().then(r => r.data.data),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => applicationApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-applications'] }),
  })

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>지원 내역</h1>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'mine' ? styles.active : ''}`} onClick={() => setTab('mine')}>
          내가 지원한 프로젝트
        </button>
        <button className={`${styles.tab} ${tab === 'received' ? styles.active : ''}`} onClick={() => setTab('received')}>
          받은 지원서 관리
        </button>
      </div>

      {tab === 'mine' && (
        <div className={styles.list}>
          {myApps?.length === 0 && (
            <div className={styles.empty}>
              <p>아직 지원한 프로젝트가 없습니다</p>
              <Link to="/projects"><Button variant="outline">프로젝트 탐색하기</Button></Link>
            </div>
          )}
          {myApps?.map(app => (
            <div key={app.id} className={styles.card}>
              <div className={styles.cardLeft}>
                <Link to={`/projects/${app.projectId}`} className={styles.projectTitle}>
                  {app.project?.title ?? `프로젝트 #${app.projectId}`}
                </Link>
                <div className={styles.meta}>
                  <span className={styles.role}>{app.roleName}</span>
                  <span className={styles.dot}>·</span>
                  <span className={styles.date}>{new Date(app.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
              <div className={styles.cardRight}>
                <StatusBadge status={app.status} />
                {app.status === 'PENDING' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={cancelMutation.isPending}
                    onClick={() => confirm('지원을 취소하시겠습니까?') && cancelMutation.mutate(app.id)}
                  >
                    지원 취소
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'received' && <ReceivedApplications />}
    </div>
  )
}

// 받은 지원서 — 리더가 관리하는 프로젝트의 지원서들
function ReceivedApplications() {
  const qc = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: (id: number) => applicationApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['received-applications'] }),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: number) => applicationApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['received-applications'] }),
  })

  // NOTE: 실제 구현 시 리더가 소유한 프로젝트별 지원서를 가져오는 API 연결
  return (
    <div className={styles.empty}>
      <p style={{ marginBottom: '0.5rem' }}>
        내가 등록한 프로젝트의 지원서를 여기서 관리할 수 있습니다.
      </p>
      <Link to="/projects/new">
        <Button variant="outline">프로젝트 등록하기</Button>
      </Link>
    </div>
  )
}
