import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { applicationApi } from '@/api'
import { StatusBadge } from '@/components/common/Badge'
import Button from '@/components/common/Button'
import styles from './ApplicationListPage.module.css'

export default function ApplicationListPage() {
  const [tab, setTab] = useState<'mine' | 'received'>('mine')

  const { data: myApps } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => applicationApi.getMyApplications(),
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
                <Link to={`/posts/${app.postId}`} className={styles.projectTitle}>
                  {app.post?.title ?? `게시글 #${app.postId}`}
                </Link>
                <div className={styles.meta}>
                  <span className={styles.role}>{app.post?.category ?? ''}</span>
                  <span className={styles.dot}>·</span>
                  <span className={styles.date}>{new Date(app.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
              <div className={styles.cardRight}>
                <StatusBadge status={app.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'received' && <ReceivedApplications />}
    </div>
  )
}

function ReceivedApplications() {
  return (
    <div className={styles.empty}>
      <p style={{ marginBottom: '0.5rem' }}>
        내가 등록한 게시글의 지원서를 여기서 관리할 수 있습니다.
      </p>
      <Link to="/project/new">
        <Button variant="outline">게시글 등록하기</Button>
      </Link>
    </div>
  )
}
