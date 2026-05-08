import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { applicationApi } from '@/api'
import { type Post } from '@/types'
import Button from '@/components/common/Button'
import styles from './ApplyModal.module.css'

interface Props {
  post: Post
  onClose: () => void
  onSuccess: () => void
}

export default function ApplyModal({ post, onClose, onSuccess }: Props) {
  const [introduction, setIntroduction] = useState('')

  const applyMutation = useMutation({
    mutationFn: () => applicationApi.apply(post.id, { introduction }),
    onSuccess,
  })

  const canSubmit = introduction.trim().length > 0

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>지원하기</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p className={styles.projectTitle}>{post.title}</p>

        <div className={styles.section}>
          <label className={styles.label}>지원 동기 / 자기소개 *</label>
          <textarea
            rows={6}
            placeholder="이 게시글에 지원하는 이유와 본인의 역량·경험을 자유롭게 작성해주세요"
            value={introduction}
            onChange={e => setIntroduction(e.target.value)}
            maxLength={500}
          />
          <span className={styles.count}>{introduction.length} / 500자</span>
        </div>

        <div className={styles.actions}>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            disabled={!canSubmit}
            loading={applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
          >
            지원서 제출
          </Button>
        </div>

        {applyMutation.isError && (
          <p className={styles.error}>지원 중 오류가 발생했습니다. 다시 시도해주세요.</p>
        )}
      </div>
    </div>
  )
}
