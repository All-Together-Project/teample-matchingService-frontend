import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'
import { postApi, tagApi, searchApi } from '@/api'
import type { PostCategory } from '@/types'
import AdvancedSearchPanel, { type AdvancedFilterValue } from '@/components/search/AdvancedSearchPanel'
import styles from './LandingPage.module.css'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const CATEGORIES = [
  { label: '스터디', path: '/study', icon: '📚', desc: '함께 공부할 사람을 찾아보세요', color: '#7C3AED' },
  { label: '프로젝트', path: '/project', icon: '⚙️', desc: '팀원을 모집하고 협업하세요', color: '#2563EB' },
  { label: '모임', path: '/meetup', icon: '👥', desc: '취미, 운동, 네트워킹 모임', color: '#059669' },
  { label: '커뮤니티', path: '/community', icon: '💬', desc: '자유롭게 소통하고 정보 공유', color: '#D97706' },
]

const CATEGORY_LABEL: Record<PostCategory, string> = {
  STUDY: '스터디',
  PROJECT: '프로젝트',
  MEETUP: '모임',
  COMMUNITY: '커뮤니티',
}

const POPULAR_PER_PAGE = 4

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [filters, setFilters] = useState<AdvancedFilterValue>({ category: '', status: '', tagIds: [] })
  const [popularPage, setPopularPage] = useState(0)
  const navigate = useNavigate()

  const buildSearchUrl = (q: string) => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (filters.category) params.set('category', filters.category)
    if (filters.status) params.set('status', filters.status)
    if (filters.tagIds.length) params.set('tagIds', filters.tagIds.join(','))
    const qs = params.toString()
    return qs ? `/search?${qs}` : '/search'
  }

  const activeFilterCount =
    (filters.category ? 1 : 0) + (filters.status ? 1 : 0) + filters.tagIds.length

  const { data: popular } = useQuery({
    queryKey: ['posts', 'popular-by-views'],
    queryFn: () => postApi.getPopular(8),
  })

  const { data: latest } = useQuery({
    queryKey: ['posts', 'latest'],
    queryFn: () => postApi.getList({ size: 8 }),
  })

  const { data: tags } = useQuery({
    queryKey: ['tags', 'all'],
    queryFn: () => tagApi.getAll(),
  })

  const { data: trending } = useQuery({
    queryKey: ['search', 'trending'],
    queryFn: () => searchApi.getTrending(10),
    staleTime: 30 * 60 * 1000,        // 30분 동안은 캐시 유효
    refetchInterval: 30 * 60 * 1000,  // 30분마다 자동 갱신
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q && activeFilterCount === 0) return
    if (q) searchApi.recordSearch(q).catch(() => {})
    navigate(buildSearchUrl(q))
  }

  const popularPosts = popular ?? []
  const latestPosts = latest?.content ?? []
  const popularTags = (tags ?? []).slice(0, 18)

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>함께할 사람을<br />찾아보세요!</h1>
        <p>스터디, 프로젝트, 모임까지 — 다양한 분야의 팀원을 매칭해드립니다.</p>
        <div className={styles.searchWrap}>
          <form className={styles.searchBar} onSubmit={handleSearch}>
            <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="어떤 스터디, 프로젝트, 모임을 찾고 계신가요?"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button type="submit">검색</button>
          </form>
          <AdvancedSearchPanel
            open={showAdvanced}
            onClose={() => setShowAdvanced(false)}
            value={filters}
            onChange={setFilters}
          />
        </div>
        <button
          type="button"
          className={`${styles.advancedToggle} ${showAdvanced ? styles.advancedToggleActive : ''}`}
          onClick={() => setShowAdvanced(s => !s)}
        >
          상세 검색
          {activeFilterCount > 0 && <span className={styles.advancedBadge}>{activeFilterCount}</span>}
          <span className={styles.advancedCaret}>{showAdvanced ? '▲' : '▼'}</span>
        </button>
      </section>

      <section className={styles.categories}>
        <h2 className={styles.sectionTitle}>빠른 카테고리</h2>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map(cat => (
            <Link to={cat.path} key={cat.path} className={styles.categoryCard}>
              <span className={styles.categoryIcon}>{cat.icon}</span>
              <h3>{cat.label}</h3>
              <p>{cat.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>인기 게시글</h2>
        {popularPosts.length === 0 ? (
          <div className={styles.empty}>모집 중인 게시글이 없습니다.</div>
        ) : (() => {
          const totalPages = Math.min(2, Math.ceil(popularPosts.length / POPULAR_PER_PAGE))
          const safePage = Math.min(popularPage, totalPages - 1)
          const start = safePage * POPULAR_PER_PAGE
          const visible = popularPosts.slice(start, start + POPULAR_PER_PAGE)
          return (
            <>
              <div className={styles.popularGrid}>
                {visible.map(post => (
                  <Link to={`/posts/${post.id}`} key={post.id} className={styles.popularCard}>
                    <span className={styles.badge}>모집중</span>
                    <span className={styles.cardCategory}>{CATEGORY_LABEL[post.category]}</span>
                    <h4>{post.title}</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {post.capacity != null
                        ? <span>{post.currentMemberCount}/{post.capacity}명</span>
                        : <span />}
                      <span>👁 {(post as any).viewCount ?? 0}</span>
                    </div>
                  </Link>
                ))}
              </div>
              {totalPages > 1 && (
                <div className={styles.popularPager}>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`${styles.popularPagerBtn} ${i === safePage ? styles.popularPagerActive : ''}`}
                      onClick={() => setPopularPage(i)}
                      aria-label={`${i + 1}페이지`}
                    >{i + 1}</button>
                  ))}
                </div>
              )}
            </>
          )
        })()}
      </section>

      <section className={styles.bottomSection}>
        <div className={styles.latestPosts}>
          <h2 className={styles.sectionTitle}>최신 게시글</h2>
          <div className={styles.postList}>
            {latestPosts.length === 0 ? (
              <div className={styles.empty}>아직 게시글이 없습니다.</div>
            ) : (
              latestPosts.map(post => (
                <Link to={`/posts/${post.id}`} key={post.id} className={styles.postItem}>
                  <span className={styles.postCategory}>{CATEGORY_LABEL[post.category]}</span>
                  <span className={styles.postTitle}>{post.title}</span>
                  <span className={styles.postMeta}>
                    {post.author?.nickname ?? '익명'} · {dayjs(post.createdAt).fromNow()}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className={styles.tagCloud}>
          <h2 className={styles.sectionTitle}>🔥 실시간 검색어</h2>
          <div className={styles.tags}>
            {!trending || trending.length === 0 ? (
              <span className={styles.empty}>아직 검색 기록이 없습니다.</span>
            ) : (
              trending.map((t, i) => (
                <Link
                  key={t.term}
                  to={`/search?q=${encodeURIComponent(t.term)}`}
                  className={styles.trendingItem}
                >
                  <span className={styles.trendingRank}>{i + 1}</span>
                  <span className={styles.trendingTerm}>{t.term}</span>
                  <span className={styles.trendingCount}>{t.count}</span>
                </Link>
              ))
            )}
          </div>

          <h2 className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>인기 태그</h2>
          <div className={styles.tags}>
            {popularTags.length === 0 ? (
              <span className={styles.empty}>등록된 태그가 없습니다.</span>
            ) : (
              popularTags.map(tag => (
                <Link key={tag.id} to={`/search?q=${encodeURIComponent(tag.name)}`} className={styles.tag}>
                  {tag.name}
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
