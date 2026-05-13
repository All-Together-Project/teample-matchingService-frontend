import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userApi, reviewApi, messageApi, projectReviewApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { TempBadge } from '@/components/common/Badge'
import ReviewSummaryCard from '@/components/review/ReviewSummaryCard'
import ReviewCategoryBreakdown from '@/components/review/ReviewCategoryBreakdown'
import ReviewCategoryTabs, { type ReviewCategoryFilter } from '@/components/review/ReviewCategoryTabs'
import ReviewDetailModal from '@/components/review/ReviewDetailModal'
import Button from '@/components/common/Button'
import { useState } from 'react'
import type { Review } from '@/types'
import styles from './UserProfilePage.module.css'

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const userId = id ?? ''
  const { user: me } = useAuthStore()
  const [msgContent, setMsgContent] = useState('')
  const [msgSent, setMsgSent] = useState(false)
  const [reviewDetail, setReviewDetail] = useState<Review | null>(null)
  const [reviewFilter, setReviewFilter] = useState<ReviewCategoryFilter>('ALL')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userApi.getProfile(userId),
    enabled: !!userId,
  })

  const { data: summary } = useQuery({
    queryKey: ['review-summary', userId],
    queryFn: () => reviewApi.getUserSummary(userId),
    enabled: !!userId,
  })

  const { data: reviews } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => reviewApi.getUserReviews(userId),
    enabled: !!userId,
  })

  const { data: leaderSummary } = useQuery({
    queryKey: ['leader-summary', userId],
    queryFn: () => projectReviewApi.getLeaderSummary(userId),
    enabled: !!userId,
  })

  const handleSendMsg = async () => {
    if (!msgContent.trim() || !userId) return
    await messageApi.send({ receiverId: userId, content: msgContent })
    setMsgSent(true)
    setMsgContent('')
  }

  if (isLoading) return <p className={styles.loading}>불러오는 중...</p>
  if (!profile) return <p className={styles.loading}>사용자를 찾을 수 없습니다</p>
  const isMe = me?.id === userId

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.profileCard}>
            <div className={styles.avatarWrap}>
              {profile.profileUrl
                ? <img src={profile.profileUrl} className={styles.avatarImg} alt={profile.nickname} />
                : <div className={styles.avatar}>{profile.nickname.charAt(0)}</div>
              }
            </div>
            <div className={styles.info}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{profile.nickname}</h1>
                <TempBadge value={profile.temperature} />
              </div>
              {profile.introduction && <p className={styles.bio}>{profile.introduction}</p>}
              <div className={styles.subInfo}>
                {profile.major && <span>{profile.major}</span>}
              </div>
            </div>
          </div>

          {leaderSummary && (leaderSummary.hostedCount > 0 || leaderSummary.reviewCount > 0) && (
            <div className={styles.leaderCard}>
              <h3 className={styles.leaderTitle}>리더 활동 지표</h3>
              <div className={styles.leaderStats}>
                <div className={styles.leaderStat}>
                  <span className={styles.leaderStatLabel}>운영</span>
                  <span className={styles.leaderStatValue}>{leaderSummary.hostedCount}</span>
                </div>
                <div className={styles.leaderStat}>
                  <span className={styles.leaderStatLabel}>종료</span>
                  <span className={styles.leaderStatValue}>{leaderSummary.finishedCount}</span>
                </div>
                <div className={styles.leaderStat}>
                  <span className={styles.leaderStatLabel}>리뷰</span>
                  <span className={styles.leaderStatValue}>{leaderSummary.reviewCount}</span>
                </div>
                <div className={styles.leaderStat}>
                  <span className={styles.leaderStatLabel}>평점</span>
                  <span className={styles.leaderStatValue}>
                    {leaderSummary.reviewCount > 0
                      ? `★ ${leaderSummary.averageOverall.toFixed(1)}`
                      : '—'}
                  </span>
                </div>
              </div>
              {leaderSummary.itemAverages.length > 0 && (
                <div className={styles.leaderItems}>
                  {leaderSummary.itemAverages.map(it => (
                    <div key={it.itemName} className={styles.leaderItemRow}>
                      <span className={styles.leaderItemLabel}>{it.itemName}</span>
                      <div className={styles.leaderItemBar}>
                        <div className={styles.leaderItemFill} style={{ width: `${(it.average / 5) * 100}%` }} />
                      </div>
                      <span className={styles.leaderItemValue}>{it.average.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {summary && <ReviewSummaryCard summary={summary} />}
          {reviews && reviews.length > 0 && <ReviewCategoryBreakdown reviews={reviews} />}

          <div className={styles.section}>
            <h2>받은 리뷰 ({reviews?.length ?? 0})</h2>
            {reviews && reviews.length > 0 && (
              <ReviewCategoryTabs
                value={reviewFilter}
                counts={{
                  ALL:     reviews.length,
                  STUDY:   reviews.filter(r => r.postCategory === 'STUDY').length,
                  PROJECT: reviews.filter(r => r.postCategory === 'PROJECT').length,
                  MEETUP:  reviews.filter(r => r.postCategory === 'MEETUP').length,
                }}
                onChange={setReviewFilter}
              />
            )}
            {reviews?.filter(r => reviewFilter === 'ALL' || r.postCategory === reviewFilter).map(r => {
              const isMine = me?.id === r.evaluator.id
              const showAsAnon = !isMine
              const name = showAsAnon ? '함께한 멤버' : r.evaluator.nickname
              return (
                <button
                  key={r.id}
                  type="button"
                  className={styles.reviewCard}
                  onClick={() => setReviewDetail(r)}
                  aria-label={`${r.postTitle}에 남긴 리뷰 상세보기`}
                >
                  <div className={styles.reviewTop}>
                    <div className={`${styles.reviewerAvatar} ${showAsAnon ? styles.reviewerAvatarAnon : ''}`}>
                      {showAsAnon ? '?' : r.evaluator.nickname.charAt(0)}
                    </div>
                    <div>
                      <p className={styles.reviewerName}>
                        {name}
                        {isMine && <span className={styles.mineTag}>(내가 작성)</span>}
                      </p>
                      <p className={styles.reviewProject}>{r.postTitle}</p>
                    </div>
                    <span className={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {r.comment && <p className={styles.comment}>"{r.comment}"</p>}
                </button>
              )
            })}
            {!reviews?.length && <p className={styles.empty}>아직 받은 리뷰가 없습니다</p>}
          </div>
        </div>

        {reviewDetail && (
          <ReviewDetailModal review={reviewDetail} onClose={() => setReviewDetail(null)} />
        )}

        {!isMe && me && (
          <aside className={styles.sidebar}>
            <div className={styles.msgCard}>
              <h3>쪽지 보내기</h3>
              <textarea
                rows={4}
                placeholder={`${profile.nickname}님에게 쪽지를 보내세요`}
                value={msgContent}
                onChange={e => setMsgContent(e.target.value)}
              />
              {msgSent
                ? <p className={styles.msgSent}>쪽지가 전송되었습니다!</p>
                : <Button fullWidth onClick={handleSendMsg} disabled={!msgContent.trim()}>전송</Button>
              }
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
