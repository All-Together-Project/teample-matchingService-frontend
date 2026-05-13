import { useQuery } from '@tanstack/react-query'
import { reviewApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { TempBadge } from '@/components/common/Badge'
import type { User } from '@/types'
import styles from './MemberReviewsModal.module.css'

interface Props {
  postId: number
  postTitle: string
  member: Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'>
  onClose: () => void
}

export default function MemberReviewsModal({ postId, postTitle, member, onClose }: Props) {
  const { user: me } = useAuthStore()
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews-for-target', postId, member.id],
    queryFn: () => reviewApi.getForPostAndTarget(postId, member.id),
  })

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.avatar}>
              {member.profileUrl
                ? <img src={member.profileUrl} alt={member.nickname} />
                : <span>{member.nickname.charAt(0)}</span>
              }
            </div>
            <div className={styles.headerInfo}>
              <p className={styles.memberName}>{member.nickname}</p>
              <div className={styles.headerSub}>
                <TempBadge value={member.temperature ?? 36.5} />
                <span className={styles.postLabel}>{postTitle}</span>
              </div>
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className={styles.body}>
          <p className={styles.notice}>
            다른 멤버들이 이 사람에게 남긴 리뷰입니다. 평가자는 익명으로 표시되며, 내가 작성한 리뷰만 표시됩니다.
          </p>

          {isLoading ? (
            <p className={styles.empty}>불러오는 중...</p>
          ) : reviews.length === 0 ? (
            <p className={styles.empty}>아직 이 멤버에 대한 리뷰가 없습니다.</p>
          ) : (
            <div className={styles.reviewList}>
              {reviews.map((r) => {
                const isMine = me?.id === r.evaluator.id
                const avg = r.scores.length > 0
                  ? r.scores.reduce((s, x) => s + x.score, 0) / r.scores.length
                  : 0
                return (
                  <div key={r.id} className={styles.reviewCard}>
                    <div className={styles.reviewTop}>
                      <div className={`${styles.reviewerAvatar} ${!isMine ? styles.reviewerAvatarAnon : ''}`}>
                        {isMine ? r.evaluator.nickname.charAt(0) : '?'}
                      </div>
                      <span className={styles.reviewerName}>
                        {isMine ? r.evaluator.nickname : '함께한 멤버'}
                        {isMine && <span className={styles.mineTag}>(내가 작성)</span>}
                      </span>
                      <span className={styles.avg}>★ {avg.toFixed(1)}</span>
                      <span className={styles.date}>
                        {new Date(r.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div className={styles.scores}>
                      {r.scores.map((s) => (
                        <span key={s.itemId} className={styles.scoreChip}>
                          {s.itemName} <strong>{s.score}</strong>
                        </span>
                      ))}
                    </div>
                    {r.comment && <p className={styles.comment}>"{r.comment}"</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
