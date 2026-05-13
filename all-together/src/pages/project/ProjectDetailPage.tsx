import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postApi, reviewApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { StatusBadge, TempBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import CommentSection from '@/components/project/CommentSection'
import ApplyModal from '@/components/matching/ApplyModal'
import ReviewModal from '@/components/review/ReviewModal'
import MemberReviewsModal from '@/components/review/MemberReviewsModal'
import ProjectReviewSection from '@/components/review/ProjectReviewSection'
import type { Post, User } from '@/types'
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

  // 상세 진입 시 1회 조회수 증가 (페이지 변경 시마다)
  useEffect(() => {
    if (postId) postApi.incrementView(postId).catch(() => {})
  }, [postId])

  const deleteMutation = useMutation({
    mutationFn: () => postApi.delete(postId),
    onSuccess: () => navigate('/project'),
  })

  const statusMutation = useMutation({
    mutationFn: (status: 'RECRUITING' | 'COMPLETE' | 'FINISHED') => postApi.updateStatus(postId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post', postId] }),
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

          {post.attachments && post.attachments.length > 0 && (() => {
            const isImage = (a: typeof post.attachments[number]) =>
              a.mimeType?.startsWith('image/') ||
              /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(a.fileName)
            const images = post.attachments.filter(isImage)
            const files = post.attachments.filter(a => !isImage(a))
            return (
              <div className={styles.section}>
                <h2>첨부파일</h2>

                {images.length > 0 && (
                  <div className={styles.imageGrid}>
                    {images.map(a => (
                      <a
                        key={a.id}
                        href={a.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.imageItem}
                        title={a.fileName}
                      >
                        <img src={a.publicUrl} alt={a.fileName} loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}

                {files.length > 0 && (
                  <ul className={styles.attachList}>
                    {files.map(a => (
                      <li key={a.id} className={styles.attachItem}>
                        <span className={styles.attachIcon}>📎</span>
                        <a href={a.publicUrl} target="_blank" rel="noreferrer" className={styles.attachName}>
                          {a.fileName}
                        </a>
                        {a.fileSize && (
                          <span className={styles.attachSize}>
                            {a.fileSize < 1024 * 1024
                              ? `${(a.fileSize / 1024).toFixed(1)} KB`
                              : `${(a.fileSize / 1024 / 1024).toFixed(1)} MB`}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })()}

          {post.status === 'FINISHED' && post.category !== 'COMMUNITY' && (
            <ReviewSection post={post} />
          )}

          {post.category !== 'COMMUNITY' && <ProjectReviewSection post={post} />}

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
                {post.category !== 'COMMUNITY' && (
                  <div className={styles.statusActions}>
                    {post.status === 'RECRUITING' && (
                      <>
                        <Button
                          variant="outline"
                          fullWidth
                          onClick={() => statusMutation.mutate('COMPLETE')}
                          loading={statusMutation.isPending}
                        >
                          모집 마감
                        </Button>
                        <Button
                          variant="outline"
                          fullWidth
                          onClick={() => confirm('진행 중 단계를 건너뛰고 바로 종료하시겠습니까?') && statusMutation.mutate('FINISHED')}
                          loading={statusMutation.isPending}
                        >
                          바로 종료
                        </Button>
                      </>
                    )}
                    {post.status === 'COMPLETE' && (
                      <>
                        <Button
                          fullWidth
                          onClick={() => confirm('활동을 종료하시겠습니까? 종료 후 멤버끼리 리뷰를 작성할 수 있습니다.') && statusMutation.mutate('FINISHED')}
                          loading={statusMutation.isPending}
                        >
                          활동 종료
                        </Button>
                        <Button
                          variant="outline"
                          fullWidth
                          onClick={() => statusMutation.mutate('RECRUITING')}
                          loading={statusMutation.isPending}
                        >
                          다시 모집
                        </Button>
                      </>
                    )}
                    {post.status === 'FINISHED' && (
                      <Button variant="outline" fullWidth disabled>
                        종료된 공고입니다
                      </Button>
                    )}
                  </div>
                )}
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
                  <span>모집 인원</span><span>{post.currentMemberCount}/{post.capacity}명</span>
                </div>
              )}
            </div>

            {post.roles && post.roles.length > 0 && (
              <div className={styles.roleBlock}>
                <h3 className={styles.sideTitle}>모집 역할</h3>
                <ul className={styles.roleList}>
                  {post.roles.map(r => {
                    const full = r.filledCount >= r.capacity
                    return (
                      <li key={r.id} className={styles.roleItem}>
                        <span className={styles.roleItemName}>{r.name}</span>
                        <span className={`${styles.roleItemCount} ${full ? styles.roleItemFull : ''}`}>
                          {r.filledCount}/{r.capacity}명{full ? ' · 마감' : ''}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
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

function ReviewSection({ post }: { post: Post }) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [target, setTarget] = useState<Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'> | null>(null)
  const [viewing, setViewing] = useState<Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'> | null>(null)

  const { data: members = [] } = useQuery({
    queryKey: ['members', post.id],
    queryFn: () => postApi.getMembers(post.id),
  })
  const { data: myReviews = [] } = useQuery({
    queryKey: ['my-reviews', post.id],
    queryFn: () => reviewApi.getMyReviewsForPost(post.id),
    enabled: !!user,
  })

  // 작성자 + 멤버 합쳐서 dedup. 본인은 그리드에서 제외 (자기 자신은 리뷰 대상 X).
  const candidates = new Map<string, Pick<User, 'id' | 'nickname' | 'profileUrl' | 'temperature'>>()
  if (post.author && post.author.id !== user?.id) {
    candidates.set(post.author.id, post.author)
  }
  for (const m of members as any[]) {
    const u = m.user
    if (!u || u.id === user?.id) continue
    candidates.set(u.id, u)
  }
  const list = Array.from(candidates.values())

  const isAuthor = post.author?.id === user?.id
  const isMember = !!user && (members as any[]).some(m => m.userId === user.id)
  const canWriteReview = !!user && (isAuthor || isMember)
  const reviewedIds = new Set(myReviews.map(r => r.targetId))

  if (list.length === 0) return null

  return (
    <div className={styles.section}>
      <h2>함께한 멤버 ({list.length})</h2>
      <p className={styles.reviewHint}>
        멤버 카드를 클릭하면 다른 멤버들이 남긴 익명 리뷰를 볼 수 있어요.
        {canWriteReview && ' 프로필 사진을 클릭하면 해당 멤버의 페이지로 이동합니다.'}
      </p>
      <div className={styles.memberGrid}>
        {list.map(m => {
          const done = reviewedIds.has(m.id)
          return (
            <button
              key={m.id}
              type="button"
              className={styles.memberCard}
              onClick={() => setViewing(m)}
            >
              <Link
                to={`/users/${m.id}`}
                className={styles.memberAvatarLink}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${m.nickname} 프로필로 이동`}
              >
                <div className={styles.memberAvatar}>
                  {m.profileUrl
                    ? <img src={m.profileUrl} alt={m.nickname} />
                    : <span>{m.nickname.charAt(0)}</span>
                  }
                </div>
              </Link>
              <div className={styles.memberMeta}>
                <p className={styles.memberName}>{m.nickname}</p>
                <TempBadge value={m.temperature} />
              </div>
              {canWriteReview && (
                done ? (
                  <span className={styles.reviewDone}>✓ 리뷰 완료</span>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e: any) => { e.stopPropagation(); setTarget(m) }}
                  >
                    리뷰 작성
                  </Button>
                )
              )}
            </button>
          )
        })}
      </div>

      {viewing && (
        <MemberReviewsModal
          postId={post.id}
          postTitle={post.title}
          member={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {target && (
        <ReviewModal
          post={post}
          target={target}
          onClose={() => setTarget(null)}
          onSuccess={() => {
            setTarget(null)
            qc.invalidateQueries({ queryKey: ['my-reviews', post.id] })
            qc.invalidateQueries({ queryKey: ['reviews-for-target', post.id, target.id] })
            qc.invalidateQueries({ queryKey: ['review-summary', target.id] })
            qc.invalidateQueries({ queryKey: ['user', target.id] })
          }}
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
