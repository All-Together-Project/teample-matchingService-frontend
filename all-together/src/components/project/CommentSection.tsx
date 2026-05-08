import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commentApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { type Comment } from '@/types'
import Button from '@/components/common/Button'
import styles from './CommentSection.module.css'

export default function CommentSection({ postId }: { postId: number }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')

  const { data: comments } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => commentApi.getList(postId),
  })

  const createMutation = useMutation({
    mutationFn: (body: { content: string; parentId?: number }) =>
      commentApi.create(postId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      setText('')
      setReplyTo(null)
      setReplyText('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => commentApi.delete(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', postId] }),
  })

  const rootComments = comments?.filter(c => !c.parentId) ?? []

  return (
    <div className={styles.wrap}>
      <h2>댓글 {comments?.length ?? 0}개</h2>

      {user && (
        <div className={styles.inputRow}>
          <div className={styles.avatar}>{user.nickname.charAt(0)}</div>
          <div className={styles.inputArea}>
            <textarea
              rows={2}
              placeholder="질문이나 의견을 남겨주세요"
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <div className={styles.inputFooter}>
              <Button
                size="sm"
                disabled={!text.trim()}
                loading={createMutation.isPending}
                onClick={() => createMutation.mutate({ content: text })}
              >
                등록
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.list}>
        {rootComments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={user?.id}
            replyTo={replyTo}
            replyText={replyText}
            onReplyToggle={(id) => setReplyTo(prev => prev === id ? null : id)}
            onReplyTextChange={setReplyText}
            onReplySubmit={() => createMutation.mutate({ content: replyText, parentId: comment.id })}
            onDelete={(id) => deleteMutation.mutate(id)}
            isSubmitting={createMutation.isPending}
          />
        ))}
      </div>
    </div>
  )
}

function CommentItem({
  comment, currentUserId, replyTo, replyText,
  onReplyToggle, onReplyTextChange, onReplySubmit, onDelete, isSubmitting,
}: {
  comment: Comment
  currentUserId?: string
  replyTo: number | null
  replyText: string
  onReplyToggle: (id: number) => void
  onReplyTextChange: (v: string) => void
  onReplySubmit: () => void
  onDelete: (id: number) => void
  isSubmitting: boolean
}) {
  return (
    <div className={styles.commentItem}>
      <div className={styles.avatar}>{comment.author.nickname.charAt(0)}</div>
      <div className={styles.commentBody}>
        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>{comment.author.nickname}</span>
          <span className={styles.commentDate}>
            {new Date(comment.createdAt).toLocaleDateString('ko-KR')}
          </span>
        </div>
        <p className={styles.commentText}>{comment.content}</p>
        <div className={styles.commentActions}>
          <button className={styles.actionBtn} onClick={() => onReplyToggle(comment.id)}>
            답글
          </button>
          {currentUserId === comment.author.id && (
            <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(comment.id)}>
              삭제
            </button>
          )}
        </div>

        {replyTo === comment.id && (
          <div className={styles.replyInput}>
            <textarea
              rows={2}
              placeholder="답글을 입력해주세요"
              value={replyText}
              onChange={e => onReplyTextChange(e.target.value)}
            />
            <div className={styles.inputFooter}>
              <Button size="sm" variant="outline" onClick={() => onReplyToggle(comment.id)}>취소</Button>
              <Button size="sm" disabled={!replyText.trim()} loading={isSubmitting} onClick={onReplySubmit}>
                답글 등록
              </Button>
            </div>
          </div>
        )}

        {comment.replies?.map(reply => (
          <div key={reply.id} className={styles.replyItem}>
            <div className={`${styles.avatar} ${styles.avatarSm}`}>{reply.author.nickname.charAt(0)}</div>
            <div className={styles.commentBody}>
              <div className={styles.commentMeta}>
                <span className={styles.commentAuthor}>{reply.author.nickname}</span>
                <span className={styles.commentDate}>{new Date(reply.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <p className={styles.commentText}>{reply.content}</p>
              {currentUserId === reply.author.id && (
                <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(reply.id)}>
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
