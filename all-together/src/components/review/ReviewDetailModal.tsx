import { useAuthStore } from '@/store/authStore'
import styles from './ReviewDetailModal.module.css'

// 사용자 리뷰(Review)와 프로젝트 리뷰(ProjectReview) 양쪽을 모두 받기 위한 구조적 타입
export interface ReviewDetailItem {
  id: number
  evaluator: { id: string; nickname: string }
  postTitle?: string
  comment: string
  scores: Array<{ itemId: number; itemName: string; score: number }>
  createdAt: string
}

interface Props {
  review: ReviewDetailItem
  onClose: () => void
  // true면 본인이 쓴 게 아닐 경우 평가자를 "함께한 멤버"로 표시. 기본 true.
  anonymize?: boolean
}

export default function ReviewDetailModal({ review, onClose, anonymize = true }: Props) {
  const { user: me } = useAuthStore()
  const isMine = me?.id === review.evaluator.id
  const showAsAnonymous = anonymize && !isMine
  const displayName = showAsAnonymous ? '함께한 멤버' : review.evaluator.nickname
  const displayInitial = showAsAnonymous ? '?' : review.evaluator.nickname.charAt(0)
  const avg =
    review.scores.length > 0
      ? review.scores.reduce((s, x) => s + x.score, 0) / review.scores.length
      : 0

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>리뷰 상세</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className={styles.body}>
          <div className={styles.meta}>
            <div className={`${styles.avatar} ${showAsAnonymous ? styles.avatarAnon : ''}`}>
              {displayInitial}
            </div>
            <div className={styles.metaText}>
              <p className={styles.evaluator}>
                {displayName}
                {isMine && anonymize && <span className={styles.mineTag}>(내가 작성)</span>}
              </p>
              {review.postTitle && <p className={styles.post}>{review.postTitle}</p>}
              <p className={styles.date}>{new Date(review.createdAt).toLocaleDateString('ko-KR')}</p>
            </div>
            <div className={styles.avgBadge}>
              <span className={styles.avgStar}>★</span>
              <span className={styles.avgValue}>{avg.toFixed(1)}</span>
            </div>
          </div>

          {review.scores.length > 0 && (
            <div className={styles.scoresSection}>
              <h3 className={styles.sectionTitle}>항목별 점수</h3>
              <div className={styles.scoresList}>
                {review.scores.map((s) => (
                  <div key={s.itemId} className={styles.scoreRow}>
                    <span className={styles.scoreLabel}>{s.itemName}</span>
                    <div className={styles.stars}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={`${styles.star} ${s.score >= n ? styles.starOn : ''}`}
                        >★</span>
                      ))}
                    </div>
                    <span className={styles.scoreValue}>{s.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.comment && (
            <div className={styles.commentSection}>
              <h3 className={styles.sectionTitle}>코멘트</h3>
              <p className={styles.comment}>"{review.comment}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
