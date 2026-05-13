import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { projectReviewApi, postApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import type { Post } from '@/types'
import Button from '@/components/common/Button'
import { TempBadge } from '@/components/common/Badge'
import ProjectReviewModal from './ProjectReviewModal'
import ReviewDetailModal, { type ReviewDetailItem } from './ReviewDetailModal'
import styles from './ProjectReviewSection.module.css'

interface Props {
  post: Post
}

const CATEGORY_LABEL: Record<'STUDY' | 'PROJECT' | 'MEETUP', string> = {
  STUDY:   '스터디',
  PROJECT: '프로젝트',
  MEETUP:  '모임',
}

export default function ProjectReviewSection({ post }: Props) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [detail, setDetail] = useState<ReviewDetailItem | null>(null)

  if (post.category === 'COMMUNITY') return null
  const category = post.category as 'STUDY' | 'PROJECT' | 'MEETUP'

  const { data: reviews = [] } = useQuery({
    queryKey: ['project-reviews', post.id],
    queryFn: () => projectReviewApi.getForPost(post.id),
  })

  const { data: summary } = useQuery({
    queryKey: ['project-review-summary', post.id],
    queryFn: () => projectReviewApi.getSummaryForPost(post.id),
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', post.id],
    queryFn: () => postApi.getMembers(post.id),
  })

  const { data: myReview } = useQuery({
    queryKey: ['my-project-review', post.id, user?.id],
    queryFn: () => projectReviewApi.getMyForPost(post.id),
    enabled: !!user,
  })

  const isAuthor = user?.id === post.author?.id
  const isMember = !!user && (members as any[]).some(m => m.userId === user.id)
  const canWrite =
    !!user
    && post.status === 'FINISHED'
    && isMember
    && !isAuthor
    && !myReview

  // 작성자(리더)는 자기 프로젝트에 리뷰 못 남기고, FINISHED 상태에서만 노출
  // 멤버지만 이미 작성한 경우는 "작성 완료" 표기
  const showWriteSection = post.status === 'FINISHED' && isMember && !isAuthor

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>{CATEGORY_LABEL[category]} 리뷰</h2>
        {summary && summary.totalReviews > 0 && (
          <span className={styles.headSummary}>
            ★ {summary.averageOverall.toFixed(1)} · 리뷰 {summary.totalReviews}개
          </span>
        )}
      </div>

      {showWriteSection && (
        <div className={styles.writeBox}>
          {myReview ? (
            <p className={styles.writeDone}>✓ 이 {CATEGORY_LABEL[category]}에 대한 리뷰를 작성했습니다.</p>
          ) : (
            <>
              <p className={styles.writeHint}>
                참여한 {CATEGORY_LABEL[category]}이 어땠는지 평가를 남겨주세요. 작성된 리뷰는 다른 사용자가 이 리더를 판단할 때 활용됩니다.
              </p>
              <Button onClick={() => setShowModal(true)} disabled={!canWrite}>
                리뷰 작성하기
              </Button>
            </>
          )}
        </div>
      )}

      {summary && summary.totalReviews > 0 && summary.itemAverages.length > 0 && (
        <div className={styles.summaryBox}>
          {summary.itemAverages.map(it => (
            <div key={it.itemName} className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{it.itemName}</span>
              <div className={styles.summaryBar}>
                <div className={styles.summaryFill} style={{ width: `${(it.average / 5) * 100}%` }} />
              </div>
              <span className={styles.summaryValue}>{it.average.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.reviewList}>
        {reviews.length === 0 ? (
          <p className={styles.empty}>
            {post.status === 'FINISHED'
              ? '아직 작성된 리뷰가 없습니다.'
              : `${CATEGORY_LABEL[category]} 종료 후 멤버들이 리뷰를 남길 수 있습니다.`}
          </p>
        ) : (
          reviews.map(r => (
            <button
              type="button"
              key={r.id}
              className={styles.reviewCard}
              onClick={() => setDetail({
                id: r.id,
                evaluator: { id: r.evaluator.id, nickname: r.evaluator.nickname },
                postTitle: `${CATEGORY_LABEL[category]} 리뷰`,
                comment: r.comment ?? '',
                scores: r.scores.map(s => ({ itemId: s.itemId, itemName: s.itemName, score: s.score })),
                createdAt: r.createdAt,
              })}
            >
              <div className={styles.reviewHeader}>
                <div className={styles.reviewerAvatar}>
                  {r.evaluator.profileUrl
                    ? <img src={r.evaluator.profileUrl} alt={r.evaluator.nickname} />
                    : <span>{r.evaluator.nickname.charAt(0)}</span>
                  }
                </div>
                <div className={styles.reviewerInfo}>
                  <p className={styles.reviewerName}>{r.evaluator.nickname}</p>
                  {r.evaluator.temperature != null && <TempBadge value={r.evaluator.temperature} />}
                </div>
                <span className={styles.reviewDate}>
                  {dayjs(r.createdAt).format('YYYY.MM.DD')}
                </span>
              </div>

              <div className={styles.scores}>
                {r.scores.map(s => (
                  <div key={s.itemId} className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>{s.itemName}</span>
                    <div className={styles.starRow}>
                      {[1, 2, 3, 4, 5].map(n => (
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

              {r.comment && <p className={styles.reviewComment}>"{r.comment}"</p>}
            </button>
          ))
        )}
      </div>

      {detail && (
        <ReviewDetailModal review={detail} onClose={() => setDetail(null)} />
      )}

      {showModal && (
        <ProjectReviewModal
          post={post}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            qc.invalidateQueries({ queryKey: ['project-reviews', post.id] })
            qc.invalidateQueries({ queryKey: ['project-review-summary', post.id] })
            qc.invalidateQueries({ queryKey: ['my-project-review', post.id, user?.id] })
            qc.invalidateQueries({ queryKey: ['leader-summary', post.author?.id] })
            qc.invalidateQueries({ queryKey: ['leader-reviews', post.author?.id] })
          }}
        />
      )}
    </div>
  )
}
