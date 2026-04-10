import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userApi, reviewApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { TempBadge, TierBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import ReviewSummaryCard from '@/components/review/ReviewSummaryCard'
import styles from './MyPage.module.css'

export default function MyPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'profile' | 'reviews'>('profile')

  const { data: reviewSummary } = useQuery({
    queryKey: ['review-summary', user?.id],
    queryFn: () => reviewApi.getUserSummary(user!.id).then(r => r.data.data),
    enabled: !!user,
  })

  const { data: reviews } = useQuery({
    queryKey: ['reviews', user?.id],
    queryFn: () => reviewApi.getUserReviews(user!.id).then(r => r.data.data),
    enabled: !!user && tab === 'reviews',
  })

  const { data: recommendedProjects } = useQuery({
    queryKey: ['recommended-projects'],
    queryFn: () => userApi.getRecommendedProjects().then(r => r.data.data),
  })

  if (!user) return null

  return (
    <div className={styles.page}>
      {/* 프로필 헤더 */}
      <div className={styles.profileCard}>
        <div className={styles.avatarWrap}>
          {user.profileImage
            ? <img src={user.profileImage} className={styles.avatarImg} alt={user.name} />
            : <div className={styles.avatar}>{user.name.charAt(0)}</div>
          }
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{user.nickname}</h1>
            <div className={styles.badges}>
              <TempBadge value={user.temperature} />
              <TierBadge tier={user.tier} />
            </div>
          </div>
          {user.bio && <p className={styles.bio}>{user.bio}</p>}
          <div className={styles.subInfo}>
            {user.major && <span>{user.major}</span>}
            {user.organization && <><span>·</span><span>{user.organization}</span></>}
          </div>
          <div className={styles.tagRow}>
            {user.techTags.map(t => <TagChip key={t.id} tag={t} size="sm" />)}
            {user.interestTags.map(t => <TagChip key={t.id} tag={t} size="sm" />)}
          </div>
        </div>
        <Link to="/my/edit" className={styles.editBtn}>프로필 편집</Link>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'profile' ? styles.active : ''}`} onClick={() => setTab('profile')}>
          AI 추천 프로젝트
        </button>
        <button className={`${styles.tab} ${tab === 'reviews' ? styles.active : ''}`} onClick={() => setTab('reviews')}>
          받은 리뷰 {reviewSummary ? `(${reviewSummary.totalReviews})` : ''}
        </button>
      </div>

      {tab === 'profile' && (
        <div className={styles.section}>
          <p className={styles.sectionHint}>내 관심 태그와 역량 기반으로 AI가 추천하는 프로젝트입니다</p>
          <div className={styles.projectGrid}>
            {recommendedProjects?.map(p => (
              <Link to={`/projects/${p.id}`} key={p.id} className={styles.projectCard}>
                <span className={styles.projectStatus}>{p.status === 'RECRUITING' ? '모집중' : p.status}</span>
                <h3 className={styles.projectTitle}>{p.title}</h3>
                <p className={styles.projectDesc}>{p.description}</p>
                <div className={styles.projectTags}>
                  {p.tags.slice(0, 3).map(t => <TagChip key={t.id} tag={t} size="sm" />)}
                </div>
              </Link>
            ))}
            {!recommendedProjects?.length && (
              <p className={styles.empty}>태그를 설정하면 맞춤 프로젝트를 추천해드려요!</p>
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
                  <div className={styles.reviewerAvatar}>{r.reviewer.name.charAt(0)}</div>
                  <div>
                    <p className={styles.reviewerName}>{r.reviewer.nickname}</p>
                    <p className={styles.reviewProject}>{r.projectTitle}</p>
                  </div>
                  <span className={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
                <div className={styles.scores}>
                  {[
                    { label: '전문성', v: r.expertise },
                    { label: '소통', v: r.communication },
                    { label: '시간 준수', v: r.punctuality },
                    { label: '참여도', v: r.participation },
                    { label: '열정', v: r.passion },
                  ].map(s => (
                    <div key={s.label} className={styles.scoreItem}>
                      <span className={styles.scoreLabel}>{s.label}</span>
                      <div className={styles.scoreBar}>
                        <div className={styles.scoreFill} style={{ width: `${(s.v / 5) * 100}%` }} />
                      </div>
                      <span className={styles.scoreValue}>{s.v}</span>
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
