import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'
import { applicationApi } from '@/api'
import { StatusBadge } from '@/components/common/Badge'
import Button from '@/components/common/Button'
import ApplicationAttachmentList from './ApplicationAttachmentList'
import styles from './ApplicationsShared.module.css'

dayjs.extend(relativeTime)
dayjs.locale('ko')

export default function MyApplications() {
  const { data: myApps, isLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => applicationApi.getMyApplications(),
  })

  if (isLoading) return <div className={styles.empty}>불러오는 중...</div>

  return (
    <div className={styles.list}>
      {myApps?.length === 0 && (
        <div className={styles.empty}>
          <p>아직 지원한 공고가 없습니다</p>
          <Link to="/project"><Button variant="outline">공고 탐색하기</Button></Link>
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
              {app.role?.name && (
                <>
                  <span className={styles.dot}>·</span>
                  <span>지원 역할: {app.role.name}</span>
                </>
              )}
              <span className={styles.dot}>·</span>
              <span className={styles.date}>{dayjs(app.createdAt).fromNow()}</span>
            </div>
            <ApplicationAttachmentList attachments={app.attachments ?? []} />
          </div>
          <div className={styles.cardRight}>
            <StatusBadge status={app.status} />
          </div>
        </div>
      ))}
    </div>
  )
}
