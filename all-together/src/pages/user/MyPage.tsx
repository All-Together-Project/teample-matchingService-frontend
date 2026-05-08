import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userApi, reviewApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { TempBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import ReviewSummaryCard from '@/components/review/ReviewSummaryCard'
import styles from './MyPage.module.css'

export default function MyPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'recommend' | 'reviews'>('recommend')

  const { data: reviewSummary } = useQuery({
    queryKey: ['review-summary', user?.id],
    queryFn: () => reviewApi.getUserSummary(user!.id),
    enabled: !!user,
  })

  const { data: reviews } = useQuery({
    queryKey: ['reviews', user?.id],
    queryFn: () => reviewApi.getUserReviews(user!.id),
    enabled: !!user && tab === 'reviews',
  })

  const { data: recommendedPosts } = useQuery({
    queryKey: ['recommended-posts'],
    queryFn: () => userApi.getRecommendedPosts(6),
  })

  if (!user) return null

  return (
    <div className={styles.page}>
      <div className={styles.profileCard}>
        <div className={styles.avatarWrap}>
          {user.profileUrl
            ? <img src={user.profileUrl} className={styles.avatarImg} alt={user.nickname} />
            : <div className={styles.avatar}>{user.nickname.charAt(0)}</div>
          }
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{user.nickname}</h1>
            <div className={styles.badges}>
              <TempBadge value={user.temperature} />
            </div>
          </div>
          {user.introduction && <p className={styles.bio}>{user.introduction}</p>}
          <div className={styles.subInfo}>
            {user.major && <span>{user.major}</span>}
          </div>
        </div>
        <Link to="/my/edit" className={styles.editBtn}>프로필 편집</Link>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'recommend' ? styles.active : ''}`} onClick={() => setTab('recommend')}>
          AI 추천 게시글
        </button>
        <button className={`${styles.tab} ${tab === 'reviews' ? styles.active : ''}`} onClick={() => setTab('reviews')}>
          받은 리뷰 {reviewSummary ? `(${reviewSummary.totalReviews})` : ''}
        </button>
      </div>

      {tab === 'recommend' && (
        <div className={styles.section}>
          <p className={styles.sectionHint}>내 관심 태그·매너 온도 기반으로 AI가 추천하는 게시글입니다</p>
          <div className={styles.projectGrid}>
            {recommendedPosts?.map((p) => (
              <Link to={`/posts/${p.id}`} key={p.id} className={styles.projectCard}>
                <span className={styles.projectStatus}>{p.status === 'RECRUITING' ? '모집중' : p.status}</span>
                <h3 className={styles.projectTitle}>{p.title}</h3>
                <p className={styles.projectDesc}>{p.content}</p>
                <div className={styles.projectTags}>
                  {p.tags?.slice(0, 3).map(t => <TagChip key={t.id} tag={t} size="sm" />)}
                </div>
              </Link>
            ))}
            {!recommendedPosts?.length && (
              <p className={styles.empty}>관심 태그를 설정하면 맞춤 게시글을 추천해드려요!</p>
            )}
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className={styles.section}>
          {reviewSummary && <ReviewSummaryCard summary={reviewSummary} />}
          <div className={styles.reviewList}>
            {reviews?.map(r => (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewHeader}>
                  <div className={styles.reviewerAvatar}>{r.evaluator.nickname.charAt(0)}</div>
                  <div>
                    <p className={styles.reviewerName}>{r.evaluator.nickname}</p>
                    <p className={styles.reviewProject}>{r.postTitle}</p>
                  </div>
                  <span className={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
                <div className={styles.scores}>
                  {r.scores.map((s) => (
                    <div key={s.itemId} className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>{s.itemName}</span>
                      <div className={styles.scoreBar}>
                        <div className={styles.scoreFill} style={{ width: `${(s.score / 5) * 100}%` }} />
                      </div>
                      <span className={styles.scoreValue}>{s.score}</span>
                    </div>
                  ))}
                </div>
                {r.comment && <p className={styles.reviewComment}>"{r.comment}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
