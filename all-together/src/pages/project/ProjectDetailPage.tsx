import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import CommentSection from '@/components/project/CommentSection'
import ApplyModal from '@/components/matching/ApplyModal'
import styles from './ProjectDetailPage.module.css'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const postId = Number(id)
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showApply, setShowApply] = useState(false)

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => postApi.getDetail(postId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => postApi.delete(postId),
    onSuccess: () => navigate('/project'),
  })

  const isAuthor = user?.id === post?.author?.id

  if (isLoading) return <div className={styles.loading}>불러오는 중...</div>
  if (!post) return <div className={styles.loading}>게시글을 찾을 수 없습니다</div>

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <StatusBadge status={post.status} />
              <span className={styles.category}>{post.subCategory}</span>
            </div>
            <h1 className={styles.title}>{post.title}</h1>
            <div className={styles.meta}>
              <Link to={`/users/${post.author.id}`} className={styles.leaderLink}>
                <div className={styles.leaderAvatar}>{post.author.nickname.charAt(0)}</div>
                <span>{post.author.nickname}</span>
              </Link>
              <span className={styles.dot}>·</span>
              <span>{new Date(post.createdAt).toLocaleDateString('ko-KR')}</span>
              {post.capacity != null && (
                <>
                  <span className={styles.dot}>·</span>
                  <span>{post.currentMemberCount} / {post.capacity}명</span>
                </>
              )}
            </div>
            <div className={styles.tags}>
              {post.tags?.map(t => <TagChip key={t.id} tag={t} size="sm" />)}
            </div>
          </div>

          <div className={styles.section}>
            <h2>소개</h2>
            <p className={styles.desc}>{post.content}</p>
          </div>

          <CommentSection postId={postId} />
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            {!isAuthor && post.status === 'RECRUITING' && (
              <Button fullWidth size="lg" onClick={() => setShowApply(true)}>
                지원하기
              </Button>
            )}
            {isAuthor && (
              <div className={styles.leaderActions}>
                <Link to={`/posts/${post.id}/edit`}>
                  <Button variant="outline" fullWidth>공고 수정</Button>
                </Link>
                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => confirm('정말 삭제하시겠습니까?') && deleteMutation.mutate()}
                  loading={deleteMutation.isPending}
                >
                  공고 삭제
                </Button>
              </div>
            )}

            <div className={styles.sideInfo}>
              <div className={styles.sideRow}>
                <span>상태</span><StatusBadge status={post.status} />
              </div>
              {post.period && (
                <div className={styles.sideRow}>
                  <span>기간</span><span>{post.period}</span>
                </div>
              )}
              {post.deadline && (
                <div className={styles.sideRow}>
                  <span>마감일</span><span>{new Date(post.deadline).toLocaleDateString('ko-KR')}</span>
                </div>
              )}
              {post.capacity != null && (
                <div className={styles.sideRow}>
                  <span>모집 인원</span><span>{post.capacity}명</span>
                </div>
              )}
            </div>
          </div>

          {isAuthor && <RecommendedMembers postId={postId} />}
        </aside>
      </div>

      {showApply && (
        <ApplyModal
          post={post}
          onClose={() => setShowApply(false)}
          onSuccess={() => { setShowApply(false); qc.invalidateQueries({ queryKey: ['post', postId] }) }}
        />
      )}
    </div>
  )
}

function RecommendedMembers({ postId }: { postId: number }) {
  const { data } = useQuery({
    queryKey: ['recommended-members', postId],
    queryFn: () => postApi.getRecommendedMembers(postId),
  })
  if (!data?.length) return null
  return (
    <div className={styles.sideCard}>
      <h3 className={styles.sideTitle}>AI 추천 팀원</h3>
      <div className={styles.recommendList}>
        {data.slice(0, 5).map(u => (
          <Link to={`/users/${u.id}`} key={u.id} className={styles.recommendItem}>
            <div className={styles.recAvatar}>{u.nickname.charAt(0)}</div>
            <div>
              <p className={styles.recName}>{u.nickname}</p>
              <p className={styles.recRole}>🌡 {u.temperature.toFixed(1)}°</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
