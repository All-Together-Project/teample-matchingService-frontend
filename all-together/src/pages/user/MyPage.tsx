import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'
import { userApi, reviewApi, postApi, projectReviewApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { TempBadge, StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import Pagination from '@/components/common/Pagination'
import ReviewSummaryCard from '@/components/review/ReviewSummaryCard'
import ReviewCategoryBreakdown from '@/components/review/ReviewCategoryBreakdown'
import ReviewCategoryTabs, { type ReviewCategoryFilter } from '@/components/review/ReviewCategoryTabs'
import ReviewDetailModal, { type ReviewDetailItem } from '@/components/review/ReviewDetailModal'
import MyApplications from '@/components/matching/MyApplications'
import ReceivedApplications from '@/components/matching/ReceivedApplications'
import AIRecommendPanel from '@/components/recommend/AIRecommendPanel'
import type { Post, Review, ProjectReview } from '@/types'
import styles from './MyPage.module.css'

dayjs.extend(relativeTime)
dayjs.locale('ko')

type Tab = 'posts' | 'applications' | 'projects' | 'recommend' | 'reviews'
type AppSubTab = 'applied' | 'received'
type ProjectSubTab = 'ongoing' | 'finished'
type ReviewSubTab = 'personal' | 'leader'

const POSTS_PER_PAGE   = 6
const PROJECTS_PER_PAGE = 6
const REVIEWS_PER_PAGE = 8

const CATEGORY_LABEL: Record<string, string> = {
  STUDY:     '스터디',
  PROJECT:   '프로젝트',
  MEETUP:    '모임',
  COMMUNITY: '커뮤니티',
}

export default function MyPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('posts')
  const [appSubTab, setAppSubTab] = useState<AppSubTab>('applied')
  const [projectSubTab, setProjectSubTab] = useState<ProjectSubTab>('ongoing')
  const [reviewSubTab, setReviewSubTab] = useState<ReviewSubTab>('personal')

  // 페이지 상태 (서브탭 별로 분리)
  const [postsPage,    setPostsPage]    = useState(0)
  const [projectPage,  setProjectPage]  = useState(0)
  const [personalPage, setPersonalPage] = useState(0)
  const [leaderPage,   setLeaderPage]   = useState(0)
  const [reviewDetail, setReviewDetail] = useState<{ data: ReviewDetailItem; anonymize: boolean } | null>(null)
  const [personalFilter, setPersonalFilter] = useState<ReviewCategoryFilter>('ALL')
  const [leaderFilter, setLeaderFilter] = useState<ReviewCategoryFilter>('ALL')

  // 서브탭 변경 시 해당 페이지 리셋
  useEffect(() => { setProjectPage(0) }, [projectSubTab])
  useEffect(() => { setPersonalPage(0); setLeaderPage(0) }, [reviewSubTab])

  const { data: profile } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => userApi.getProfile(user!.id),
    enabled: !!user,
  })

  const { data: myPosts } = useQuery({
    queryKey: ['my-posts'],
    queryFn: () => postApi.getMyPosts(),
    enabled: !!user,
  })

  const { data: memberPosts } = useQuery({
    queryKey: ['member-posts'],
    queryFn: () => postApi.getMemberPosts(),
    enabled: !!user && tab === 'projects',
  })

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

  const { data: leaderSummary } = useQuery({
    queryKey: ['leader-summary', user?.id],
    queryFn: () => projectReviewApi.getLeaderSummary(user!.id),
    enabled: !!user && tab === 'reviews',
  })

  const { data: leaderReviews } = useQuery({
    queryKey: ['leader-reviews', user?.id],
    queryFn: () => projectReviewApi.getLeaderReviews(user!.id),
    enabled: !!user && tab === 'reviews',
  })

  if (!user) return null

  const tags = profile?.tags ?? []

  // 프로젝트 분류
  const ongoingProjects  = (memberPosts ?? []).filter(p => p.status !== 'FINISHED' && p.category !== 'COMMUNITY')
  const finishedProjects = (memberPosts ?? []).filter(p => p.status === 'FINISHED' && p.category !== 'COMMUNITY')
  const projectList      = projectSubTab === 'ongoing' ? ongoingProjects : finishedProjects

  // 페이지 슬라이싱 헬퍼
  const sliceFor = <T,>(arr: T[], page: number, size: number) =>
    arr.slice(page * size, (page + 1) * size)

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
            <span>·</span>
            <span>{user.email}</span>
          </div>
          {tags.length > 0 && (
            <div className={styles.tagsRow}>
              {tags.map(t => <TagChip key={t.id} tag={t} size="sm" />)}
            </div>
          )}
        </div>
        <Link to="/my/edit" className={styles.editBtn}>프로필 편집</Link>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'posts' ? styles.active : ''}`} onClick={() => setTab('posts')}>
          모집 공고 {myPosts ? `(${myPosts.length})` : ''}
        </button>
        <button className={`${styles.tab} ${tab === 'applications' ? styles.active : ''}`} onClick={() => setTab('applications')}>
          지원
        </button>
        <button className={`${styles.tab} ${tab === 'projects' ? styles.active : ''}`} onClick={() => setTab('projects')}>
          프로젝트
        </button>
        <button className={`${styles.tab} ${tab === 'recommend' ? styles.active : ''}`} onClick={() => setTab('recommend')}>
          AI 추천
        </button>
        <button className={`${styles.tab} ${tab === 'reviews' ? styles.active : ''}`} onClick={() => setTab('reviews')}>
          리뷰
        </button>
      </div>

      {/* ── 모집 공고 ────────────────────────────────────────────── */}
      {tab === 'posts' && (
        <div className={styles.section}>
          {!myPosts ? (
            <p className={styles.empty}>불러오는 중...</p>
          ) : myPosts.length === 0 ? (
            <p className={styles.empty}>아직 작성한 글이 없습니다.</p>
          ) : (
            <>
              <div className={styles.myPostList}>
                {sliceFor(myPosts, postsPage, POSTS_PER_PAGE).map(p => (
                  <PostRowCard key={p.id} post={p} />
                ))}
              </div>
              <Pagination
                page={postsPage}
                size={POSTS_PER_PAGE}
                total={myPosts.length}
                onChange={setPostsPage}
              />
            </>
          )}
        </div>
      )}

      {/* ── 지원 (서브탭) ───────────────────────────────────────── */}
      {tab === 'applications' && (
        <div className={styles.section}>
          <div className={styles.subTabs}>
            <button
              className={`${styles.subTab} ${appSubTab === 'applied' ? styles.subActive : ''}`}
              onClick={() => setAppSubTab('applied')}
            >
              내가 지원한
            </button>
            <button
              className={`${styles.subTab} ${appSubTab === 'received' ? styles.subActive : ''}`}
              onClick={() => setAppSubTab('received')}
            >
              받은 지원서
            </button>
          </div>
          {appSubTab === 'applied' ? <MyApplications /> : <ReceivedApplications />}
        </div>
      )}

      {/* ── 프로젝트 (서브탭: 참여중 / 종료) ─────────────────────── */}
      {tab === 'projects' && (
        <div className={styles.section}>
          <div className={styles.subTabs}>
            <button
              className={`${styles.subTab} ${projectSubTab === 'ongoing' ? styles.subActive : ''}`}
              onClick={() => setProjectSubTab('ongoing')}
            >
              참여중 <span className={styles.subCount}>{ongoingProjects.length}</span>
            </button>
            <button
              className={`${styles.subTab} ${projectSubTab === 'finished' ? styles.subActive : ''}`}
              onClick={() => setProjectSubTab('finished')}
            >
              종료 <span className={styles.subCount}>{finishedProjects.length}</span>
            </button>
          </div>

          {projectSubTab === 'finished' && (
            <p className={styles.sectionHint}>
              종료된 프로젝트에서는 팀원 리뷰와 프로젝트 리뷰를 작성할 수 있습니다.
            </p>
          )}

          {!memberPosts ? (
            <p className={styles.empty}>불러오는 중...</p>
          ) : projectList.length === 0 ? (
            <p className={styles.empty}>
              {projectSubTab === 'ongoing'
                ? '참여중인 프로젝트가 없습니다.'
                : '종료된 프로젝트가 없습니다.'}
            </p>
          ) : (
            <>
              <div className={styles.myPostList}>
                {sliceFor(projectList, projectPage, PROJECTS_PER_PAGE).map(p => (
                  <ProjectRowCard key={p.id} post={p} />
                ))}
              </div>
              <Pagination
                page={projectPage}
                size={PROJECTS_PER_PAGE}
                total={projectList.length}
                onChange={setProjectPage}
              />
            </>
          )}
        </div>
      )}

      {/* ── AI 추천 ─────────────────────────────────────────────── */}
      {tab === 'recommend' && (
        <div className={styles.section}>
          <p className={styles.sectionHint}>
            원하는 프로젝트나 팀원의 조건을 자유롭게 입력하면 AI가 추천 결과와 이유를 함께 보여줍니다.
          </p>
          <AIRecommendPanel />
        </div>
      )}

      {/* ── 리뷰 (서브탭: 받은 개인 / 리더 프로젝트) ───────────── */}
      {tab === 'reviews' && (
        <div className={styles.section}>
          {/* 지표 카드 — 항상 상단에 노출 (서브탭 무관) */}
          <div className={styles.metricsRow}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>매너 온도</span>
              <span className={styles.metricValue}>{user.temperature.toFixed(1)}°</span>
              <span className={styles.metricHint}>받은 개인 리뷰 {reviewSummary?.totalReviews ?? 0}개</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>리더 평점</span>
              <span className={styles.metricValue}>
                {leaderSummary && leaderSummary.reviewCount > 0
                  ? `★ ${leaderSummary.averageOverall.toFixed(1)}`
                  : '—'}
              </span>
              <span className={styles.metricHint}>
                운영 {leaderSummary?.hostedCount ?? 0}개 · 종료 {leaderSummary?.finishedCount ?? 0}개 · 리뷰 {leaderSummary?.reviewCount ?? 0}개
              </span>
            </div>
          </div>

          {/* 서브탭 */}
          <div className={styles.subTabs}>
            <button
              className={`${styles.subTab} ${reviewSubTab === 'personal' ? styles.subActive : ''}`}
              onClick={() => setReviewSubTab('personal')}
            >
              받은 개인 리뷰 <span className={styles.subCount}>{reviewSummary?.totalReviews ?? 0}</span>
            </button>
            <button
              className={`${styles.subTab} ${reviewSubTab === 'leader' ? styles.subActive : ''}`}
              onClick={() => setReviewSubTab('leader')}
            >
              리더 프로젝트 리뷰 <span className={styles.subCount}>{leaderSummary?.reviewCount ?? 0}</span>
            </button>
          </div>

          {/* 받은 개인 리뷰 */}
          {reviewSubTab === 'personal' && (
            <>
              {reviewSummary && reviewSummary.totalReviews > 0 && (
                <ReviewSummaryCard summary={reviewSummary} />
              )}
              {reviews && reviews.length > 0 && <ReviewCategoryBreakdown reviews={reviews} />}
              {!reviews ? (
                <p className={styles.empty}>불러오는 중...</p>
              ) : reviews.length === 0 ? (
                <p className={styles.empty}>아직 받은 개인 리뷰가 없습니다.</p>
              ) : (
                <>
                  <ReviewCategoryTabs
                    value={personalFilter}
                    counts={{
                      ALL:     reviews.length,
                      STUDY:   reviews.filter(r => r.postCategory === 'STUDY').length,
                      PROJECT: reviews.filter(r => r.postCategory === 'PROJECT').length,
                      MEETUP:  reviews.filter(r => r.postCategory === 'MEETUP').length,
                    }}
                    onChange={(v) => { setPersonalFilter(v); setPersonalPage(0) }}
                  />
                  {(() => {
                    const filtered = reviews.filter(r => personalFilter === 'ALL' || r.postCategory === personalFilter)
                    if (filtered.length === 0) {
                      return <p className={styles.empty}>이 카테고리의 리뷰가 없습니다.</p>
                    }
                    return (
                      <>
                        <div className={styles.compactReviewList}>
                          {sliceFor(filtered, personalPage, REVIEWS_PER_PAGE).map(r => (
                            <CompactPersonalReviewCard
                              key={r.id}
                              review={r}
                              onClick={() => setReviewDetail({ data: r, anonymize: true })}
                            />
                          ))}
                        </div>
                        <Pagination
                          page={personalPage}
                          size={REVIEWS_PER_PAGE}
                          total={filtered.length}
                          onChange={setPersonalPage}
                        />
                      </>
                    )
                  })()}
                </>
              )}
            </>
          )}

          {/* 리더 프로젝트 리뷰 */}
          {reviewSubTab === 'leader' && (
            <>
              <p className={styles.sectionHint}>
                내가 운영한 프로젝트에 멤버들이 남긴 리뷰입니다. 새 지원자가 나를 판단할 때 참고합니다.
              </p>

              {leaderSummary && leaderSummary.itemAverages.length > 0 && (
                <div className={styles.itemAvgBox}>
                  {leaderSummary.itemAverages.map(it => (
                    <div key={it.itemName} className={styles.scoreItem}>
                      <span className={styles.scoreLabel} style={{ width: 110 }}>{it.itemName}</span>
                      <div className={styles.scoreBar}>
                        <div className={styles.scoreFill} style={{ width: `${(it.average / 5) * 100}%` }} />
                      </div>
                      <span className={styles.scoreValue}>{it.average.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              {!leaderReviews ? (
                <p className={styles.empty}>불러오는 중...</p>
              ) : leaderReviews.length === 0 ? (
                <p className={styles.empty}>아직 리더 프로젝트 리뷰가 없습니다.</p>
              ) : (
                <>
                  <ReviewCategoryTabs
                    value={leaderFilter}
                    counts={{
                      ALL:     leaderReviews.length,
                      STUDY:   leaderReviews.filter(r => r.postCategory === 'STUDY').length,
                      PROJECT: leaderReviews.filter(r => r.postCategory === 'PROJECT').length,
                      MEETUP:  leaderReviews.filter(r => r.postCategory === 'MEETUP').length,
                    }}
                    onChange={(v) => { setLeaderFilter(v); setLeaderPage(0) }}
                  />
                  {(() => {
                    const filteredLeader = leaderReviews.filter(r => leaderFilter === 'ALL' || r.postCategory === leaderFilter)
                    if (filteredLeader.length === 0) {
                      return <p className={styles.empty}>이 카테고리의 리뷰가 없습니다.</p>
                    }
                    return (
                      <>
                        <div className={styles.compactReviewList}>
                          {sliceFor(filteredLeader, leaderPage, REVIEWS_PER_PAGE).map(r => (
                            <CompactLeaderReviewCard
                              key={r.id}
                              review={r}
                              onClick={() => setReviewDetail({ data: r, anonymize: false })}
                            />
                          ))}
                        </div>
                        <Pagination
                          page={leaderPage}
                          size={REVIEWS_PER_PAGE}
                          total={filteredLeader.length}
                          onChange={setLeaderPage}
                        />
                      </>
                    )
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {reviewDetail && (
        <ReviewDetailModal
          review={reviewDetail.data}
          anonymize={reviewDetail.anonymize}
          onClose={() => setReviewDetail(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function PostRowCard({ post }: { post: Post }) {
  return (
    <Link to={`/posts/${post.id}`} className={styles.myPostCard}>
      <div className={styles.myPostHead}>
        <StatusBadge status={post.status} />
        <span className={styles.myPostCategory}>
          {CATEGORY_LABEL[post.category]} · {post.subCategory}
        </span>
        <span className={styles.myPostDate}>{dayjs(post.createdAt).fromNow()}</span>
      </div>
      <h3 className={styles.myPostTitle}>{post.title}</h3>
      {post.capacity != null && (
        <span className={styles.myPostMembers}>
          {post.currentMemberCount}/{post.capacity}명
        </span>
      )}
    </Link>
  )
}

function ProjectRowCard({ post }: { post: Post }) {
  return (
    <Link to={`/posts/${post.id}`} className={styles.myPostCard}>
      <div className={styles.myPostHead}>
        <StatusBadge status={post.status} />
        <span className={styles.myPostCategory}>
          {CATEGORY_LABEL[post.category]} · {post.subCategory}
        </span>
        <span className={styles.myPostDate}>{dayjs(post.createdAt).fromNow()}</span>
      </div>
      <h3 className={styles.myPostTitle}>{post.title}</h3>
      <div className={styles.myPostMeta}>
        <span>리더 {post.author?.nickname ?? '익명'}</span>
        {post.capacity != null && (
          <>
            <span className={styles.dot}>·</span>
            <span>{post.currentMemberCount}/{post.capacity}명</span>
          </>
        )}
      </div>
    </Link>
  )
}

function CompactPersonalReviewCard({ review, onClick }: { review: Review; onClick: () => void }) {
  const { user: me } = useAuthStore()
  const isMine = me?.id === review.evaluator.id
  const showAsAnon = !isMine
  const avg =
    review.scores.length > 0
      ? review.scores.reduce((s, x) => s + x.score, 0) / review.scores.length
      : 0
  return (
    <button type="button" className={styles.compactCard} onClick={onClick}>
      <div className={styles.compactHead}>
        <div className={`${styles.compactAvatar} ${showAsAnon ? styles.compactAvatarAnon : ''}`}>
          {showAsAnon ? '?' : review.evaluator.nickname.charAt(0)}
        </div>
        <span className={styles.compactName}>
          {showAsAnon ? '함께한 멤버' : review.evaluator.nickname}
          {isMine && <span className={styles.compactMineTag}>(내가 작성)</span>}
        </span>
        <span className={styles.compactDot}>·</span>
        <span className={styles.compactProject}>{review.postTitle}</span>
        <span className={styles.compactStars}>★ {avg.toFixed(1)}</span>
        <span className={styles.compactDate}>
          {dayjs(review.createdAt).format('YY.MM.DD')}
        </span>
      </div>
      <div className={styles.compactScoreRow}>
        {review.scores.map(s => (
          <span key={s.itemId} className={styles.compactScoreChip}>
            {s.itemName} <strong>{s.score}</strong>
          </span>
        ))}
      </div>
      {review.comment && (
        <p className={styles.compactComment}>"{review.comment}"</p>
      )}
    </button>
  )
}

function CompactLeaderReviewCard({ review, onClick }: { review: ProjectReview; onClick: () => void }) {
  const avg =
    review.scores.length > 0
      ? review.scores.reduce((s, x) => s + x.score, 0) / review.scores.length
      : 0
  return (
    <button type="button" className={styles.compactCard} onClick={onClick}>
      <div className={styles.compactHead}>
        <div className={styles.compactAvatar}>{review.evaluator.nickname.charAt(0)}</div>
        <span className={styles.compactName}>{review.evaluator.nickname}</span>
        <span className={styles.compactDot}>·</span>
        <span className={styles.compactProject}>
          {review.postCategory ? CATEGORY_LABEL[review.postCategory] + ' · ' : ''}
          {review.postTitle}
        </span>
        <span className={styles.compactStars}>★ {avg.toFixed(1)}</span>
        <span className={styles.compactDate}>
          {dayjs(review.createdAt).format('YY.MM.DD')}
        </span>
      </div>
      <div className={styles.compactScoreRow}>
        {review.scores.map(s => (
          <span key={s.itemId} className={styles.compactScoreChip}>
            {s.itemName} <strong>{s.score}</strong>
          </span>
        ))}
      </div>
      {review.comment && (
        <p className={styles.compactComment}>"{review.comment}"</p>
      )}
    </button>
  )
}
