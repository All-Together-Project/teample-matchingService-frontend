import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userApi, reviewApi, messageApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { TempBadge, TierBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import ReviewSummaryCard from '@/components/review/ReviewSummaryCard'
import Button from '@/components/common/Button'
import { useState } from 'react'
import styles from './UserProfilePage.module.css'

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const userId = Number(id)
  const { user: me } = useAuthStore()
  const [msgContent, setMsgContent] = useState('')
  const [msgSent, setMsgSent] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userApi.getProfile(userId).then(r => r.data.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['review-summary', userId],
    queryFn: () => reviewApi.getUserSummary(userId).then(r => r.data.data),
  })

  const { data: reviews } = useQuery({
    queryKey: ['reviews', userId],
    queryFn: () => reviewApi.getUserReviews(userId).then(r => r.data.data),
  })

  const handleSendMsg = async () => {
    if (!msgContent.trim()) return
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
          {/* 프로필 */}
          <div className={styles.profileCard}>
            <div className={styles.avatarWrap}>
              {profile.profileImage
                ? <img src={profile.profileImage} className={styles.avatarImg} alt={profile.name} />
                : <div className={styles.avatar}>{profile.name.charAt(0)}</div>
              }
            </div>
            <div className={styles.info}>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{profile.nickname}</h1>
                <TempBadge value={profile.temperature} />
                <TierBadge tier={profile.tier} />
              </div>
              {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
              <div className={styles.subInfo}>
                {profile.major && <span>{profile.major}</span>}
                {profile.organization && <><span>·</span><span>{profile.organization}</span></>}
              </div>
              <div className={styles.roles}>
                {profile.roles.map(r => (
                  <span key={r} className={styles.roleChip}>{r}</span>
                ))}
              </div>
              <div className={styles.tags}>
                {profile.techTags.map(t => <TagChip key={t.id} tag={t} size="sm" />)}
                {profile.interestTags.map(t => <TagChip key={t.id} tag={t} size="sm" />)}
              </div>
            </div>
          </div>

          {/* 리뷰 요약 */}
          {summary && <ReviewSummaryCard summary={summary} />}

          {/* 리뷰 목록 */}
          <div className={styles.section}>
            <h2>받은 리뷰 ({reviews?.length ?? 0})</h2>
            {reviews?.map(r => (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewTop}>
                  <div className={styles.reviewerAvatar}>{r.reviewer.name.charAt(0)}</div>
                  <div>
                    <p className={styles.reviewerName}>{r.reviewer.nickname}</p>
                    <p className={styles.reviewProject}>{r.projectTitle}</p>
                  </div>
                  <span className={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                </div>
                {r.comment && <p className={styles.comment}>"{r.comment}"</p>}
              </div>
            ))}
            {!reviews?.length && <p className={styles.empty}>아직 받은 리뷰가 없습니다</p>}
          </div>
        </div>

        {/* 사이드바 — 쪽지 보내기 */}
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
