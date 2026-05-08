import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'
import { applicationApi } from '@/api'
import { StatusBadge, TempBadge } from '@/components/common/Badge'
import Button from '@/components/common/Button'
import ApplicationAttachmentList from './ApplicationAttachmentList'
import styles from './ApplicationsShared.module.css'

dayjs.extend(relativeTime)
dayjs.locale('ko')

export default function ReceivedApplications() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['received-applications'],
    queryFn: () => applicationApi.getReceivedApplications(),
  })

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['received-applications'] })
    qc.invalidateQueries({ queryKey: ['post'] })
    qc.invalidateQueries({ queryKey: ['posts'] })
    qc.invalidateQueries({ queryKey: ['my-posts'] })
    qc.invalidateQueries({ queryKey: ['my-applications'] })
    qc.invalidateQueries({ queryKey: ['members'] })
  }

  const approve = useMutation({
    mutationFn: (id: number) => applicationApi.approve(id),
    onSuccess: invalidateAll,
  })
  const reject = useMutation({
    mutationFn: (id: number) => applicationApi.reject(id),
    onSuccess: invalidateAll,
  })

  if (isLoading) return <div className={styles.empty}>불러오는 중...</div>

  const postsWithApps = (data ?? []).filter((p: any) => (p.applications ?? []).length > 0)

  if (postsWithApps.length === 0) {
    return (
      <div className={styles.empty}>
        <p style={{ marginBottom: '0.5rem' }}>
          아직 받은 지원서가 없습니다.
        </p>
        <Link to="/project/new">
          <Button variant="outline">새 공고 등록하기</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.received}>
      {postsWithApps.map((post: any) => {
        const apps = post.applications ?? []
        const roles = post.roles ?? []
        const groups: Array<{ key: string; name: string; items: any[]; capacity?: number; filled?: number }> = []
        for (const role of roles) {
          groups.push({
            key: `r-${role.id}`,
            name: role.name,
            items: apps.filter((a: any) => a.roleId === role.id),
            capacity: role.capacity,
            filled: role.filledCount,
          })
        }
        const noRole = apps.filter((a: any) => a.roleId == null)
        if (noRole.length) {
          groups.push({ key: 'no-role', name: '역할 미지정', items: noRole })
        }

        return (
          <div key={post.id} className={styles.postBlock}>
            <div className={styles.postHead}>
              <Link to={`/posts/${post.id}`} className={styles.postTitleLink}>
                {post.title}
              </Link>
              <span className={styles.postCount}>지원 {apps.length}건</span>
            </div>

            {groups.filter(g => g.items.length > 0).map(g => (
              <div key={g.key} className={styles.roleSection}>
                <div className={styles.roleHead}>
                  <span className={styles.roleHeadName}>{g.name}</span>
                  {g.capacity != null && (
                    <span className={styles.roleHeadCount}>{g.filled}/{g.capacity}명 합류</span>
                  )}
                  <span className={styles.rolePending}>{g.items.filter((a: any) => a.status === 'PENDING').length}건 대기중</span>
                </div>
                <div className={styles.appList}>
                  {g.items.map((app: any) => (
                    <div key={app.id} className={styles.appCard}>
                      <div className={styles.appHead}>
                        <Link to={`/users/${app.applicant?.id}`} className={styles.applicantName}>
                          {app.applicant?.nickname ?? '알 수 없음'}
                        </Link>
                        {app.applicant?.temperature != null && (
                          <TempBadge value={app.applicant.temperature} />
                        )}
                        <span className={styles.appDate}>{dayjs(app.createdAt).fromNow()}</span>
                        <StatusBadge status={app.status} />
                      </div>
                      <p className={styles.appIntro}>{app.introduction}</p>
                      <ApplicationAttachmentList attachments={app.attachments ?? []} />
                      {app.status === 'PENDING' && (
                        <div className={styles.appActions}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reject.mutate(app.id)}
                            loading={reject.isPending && reject.variables === app.id}
                          >
                            거절
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approve.mutate(app.id)}
                            loading={approve.isPending && approve.variables === app.id}
                          >
                            승인
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
