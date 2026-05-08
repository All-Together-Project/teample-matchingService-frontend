import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { reviewApi } from '@/api'
import type { Post, User } from '@/types'
import Button from '@/components/common/Button'
import { TempBadge } from '@/components/common/Badge'
import styles from './ReviewModal.module.css'

interface Props {
  post: Post
  target: Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'>
  onClose: () => void
  onSuccess: () => void
}

const SCORE_LABELS = ['', '아쉬워요', '그저그래요', '괜찮아요', '좋아요', '최고예요']

export default function ReviewModal({ post, target, onClose, onSuccess }: Props) {
  const category = post.category as 'STUDY' | 'PROJECT' | 'MEETUP'
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['review-items', category],
    queryFn: () => reviewApi.getItems(category),
  })

  const [scores, setScores] = useState<Record<number, number>>({})
  const [comment, setComment] = useState('')

  const submitMutation = useMutation({
    mutationFn: () =>
      reviewApi.create({
        postId: post.id,
        targetId: target.id,
        comment: comment.trim(),
        scores: items.map(it => ({ itemId: it.id, score: scores[it.id] ?? 3 })),
      }),
    onSuccess,
  })

  const allRated = items.length > 0 && items.every(it => scores[it.id])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>리뷰 작성</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.targetInfo}>
          <div className={styles.targetAvatar}>
            {target.profileUrl
              ? <img src={target.profileUrl} alt={target.nickname} />
              : <span>{target.nickname.charAt(0)}</span>
            }
          </div>
          <div>
            <div className={styles.targetName}>
              {target.nickname}
              <TempBadge value={target.temperature} />
            </div>
            <p className={styles.postTitle}>{post.title}</p>
          </div>
        </div>

        {isLoading && <p className={styles.empty}>평가 항목 불러오는 중...</p>}

        {!isLoading && items.length > 0 && (
          <div className={styles.items}>
            {items.map(it => (
              <div key={it.id} className={styles.itemRow}>
                <div className={styles.itemHead}>
                  <span className={styles.itemName}>{it.itemName}</span>
                  <span className={styles.itemScore}>
                    {scores[it.id] ? `${scores[it.id]}점 · ${SCORE_LABELS[scores[it.id]]}` : '미평가'}
                  </span>
                </div>
                <div className={styles.starRow}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.star} ${(scores[it.id] ?? 0) >= n ? styles.starOn : ''}`}
                      onClick={() => setScores(prev => ({ ...prev, [it.id]: n }))}
                      aria-label={`${n}점`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.commentSection}>
          <label>한 줄 코멘트 (선택)</label>
          <textarea
            rows={3}
            placeholder="활동 소감, 인상 깊었던 점 등을 남겨주세요"
            maxLength={200}
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <span className={styles.count}>{comment.length} / 200</span>
        </div>

        <div className={styles.actions}>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            disabled={!allRated}
            loading={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            리뷰 등록
          </Button>
        </div>

        {submitMutation.isError && (
          <p className={styles.error}>등록에 실패했습니다. 이미 작성한 리뷰일 수 있습니다.</p>
        )}
      </div>
    </div>
  )
}
