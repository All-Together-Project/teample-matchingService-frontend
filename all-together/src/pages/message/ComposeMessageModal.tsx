import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { messageApi } from '@/api'
import Button from '@/components/common/Button'
import styles from './ComposeMessageModal.module.css'

interface Props {
  onClose: () => void
  onSuccess: () => void
  defaultEmail?: string
}

export default function ComposeMessageModal({ onClose, onSuccess, defaultEmail }: Props) {
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [content, setContent] = useState('')

  const sendMutation = useMutation({
    mutationFn: () => messageApi.sendByEmail({ email, content }),
    onSuccess: () => {
      onSuccess()
    },
  })

  const errorMsg = sendMutation.error instanceof Error ? sendMutation.error.message : null
  const canSubmit = email.trim().length > 0 && content.trim().length > 0 && !sendMutation.isPending

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>쪽지 쓰기</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className={styles.field}>
          <label>받는 사람 이메일 *</label>
          <input
            type="email"
            placeholder="example@hansung.ac.kr"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            disabled={sendMutation.isPending}
          />
        </div>

        <div className={styles.field}>
          <label>내용 *</label>
          <textarea
            rows={8}
            placeholder="전달할 내용을 입력하세요"
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={1000}
            disabled={sendMutation.isPending}
          />
          <span className={styles.count}>{content.length} / 1000자</span>
        </div>

        {errorMsg && <p className={styles.error}>{errorMsg}</p>}
        {sendMutation.isSuccess && (
          <p className={styles.success}>
            {sendMutation.data?.receiver.nickname ?? ''}님에게 쪽지를 보냈습니다.
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="outline" onClick={onClose} disabled={sendMutation.isPending}>닫기</Button>
          <Button
            disabled={!canSubmit}
            loading={sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            쪽지 보내기
          </Button>
        </div>
      </div>
    </div>
  )
}
