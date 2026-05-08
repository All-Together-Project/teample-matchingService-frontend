import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { projectReviewApi } from '@/api'
import type { Post } from '@/types'
import Button from '@/components/common/Button'
import styles from './ReviewModal.module.css'

interface Props {
  post: Post
  onClose: () => void
  onSuccess: () => void
}

const SCORE_LABELS = ['', '아쉬워요', '그저그래요', '괜찮아요', '좋아요', '최고예요']

const CATEGORY_LABEL: Record<'STUDY' | 'PROJECT' | 'MEETUP', string> = {
  STUDY:   '스터디',
  PROJECT: '프로젝트',
  MEETUP:  '모임',
}

export default function ProjectReviewModal({ post, onClose, onSuccess }: Props) {
  const category = post.category as 'STUDY' | 'PROJECT' | 'MEETUP'
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['project-review-items', category],
    queryFn: () => projectReviewApi.getItems(category),
  })

  const [scores, setScores] = useState<Record<number, number>>({})
  const [comment, setComment] = useState('')

  const submitMutation = useMutation({
    mutationFn: () =>
      projectReviewApi.create({
        postId: post.id,
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
          <h2>{CATEGORY_LABEL[category]} 리뷰</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.targetInfo}>
          <div className={styles.targetAvatar}>
            <span>★</span>
          </div>
          <div>
            <div className={styles.targetName}>{post.title}</div>
            <p className={styles.postTitle}>이 {CATEGORY_LABEL[category]} 자체에 대한 평가입니다</p>
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
                    >★</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.commentSection}>
          <label>한 줄 후기 (선택)</label>
          <textarea
            rows={3}
            placeholder={`이 ${CATEGORY_LABEL[category]}이 어땠는지, 어떤 점이 좋았는지 자유롭게 남겨주세요`}
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
          <p className={styles.error}>등록에 실패했습니다. 이미 작성했거나 권한이 없을 수 있습니다.</p>
        )}
      </div>
    </div>
  )
}
