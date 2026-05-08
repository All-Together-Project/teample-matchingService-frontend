import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { postApi, tagApi, searchApi } from '@/api'
import type { PostCategory } from '@/types'
import { StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import Pagination from '@/components/common/Pagination'
import AdvancedSearchPanel, { type AdvancedFilterValue } from '@/components/search/AdvancedSearchPanel'
import styles from './SearchPage.module.css'

const PAGE_SIZE = 12

const CATEGORY_LABEL: Record<string, string> = {
  STUDY:     '스터디',
  PROJECT:   '프로젝트',
  MEETUP:    '모임',
  COMMUNITY: '커뮤니티',
}
const STATUS_LABEL: Record<string, string> = {
  RECRUITING: '모집중',
  COMPLETE:   '모집마감',
  FINISHED:   '종료',
  GENERAL:    '일반',
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()

  const [keyword, setKeyword] = useState(params.get('q') ?? '')
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [filters, setFilters] = useState<AdvancedFilterValue>({
    category: (params.get('category') as PostCategory) || '',
    status: params.get('status') ?? '',
    tagIds: params.get('tagIds')?.split(',').map(Number).filter(Boolean) ?? [],
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(Math.max(0, Number(params.get('page') ?? '0') || 0))
  const [aiMode, setAiMode] = useState(params.get('ai') === '1')

  // URL 동기화
  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (filters.category) next.set('category', filters.category)
    if (filters.status) next.set('status', filters.status)
    if (filters.tagIds.length) next.set('tagIds', filters.tagIds.join(','))
    if (page > 0) next.set('page', String(page))
    if (aiMode) next.set('ai', '1')
    setParams(next, { replace: true })
  }, [query, filters, page, aiMode, setParams])

  // 검색어/필터 변경 시 페이지 리셋 (초기 마운트는 URL ?page= 보존)
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    setPage(0)
  }, [query, filters])

  // 외부 진입 (?q=xxx) 감지 — 검색어 기록
  useEffect(() => {
    const q = params.get('q')
    if (q && q !== query) {
      setKeyword(q)
      setQuery(q)
      searchApi.recordSearch(q).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: () => tagApi.getAll() })

  // AI 모드는 keyword 필수 (의미 검색에 검색어가 필요)
  const enabled = aiMode
    ? !!query
    : !!(query || filters.tagIds.length || filters.category || filters.status)

  // 일반 검색 (키워드 + 필터 + 페이징)
  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['search', { query, filters, page }],
    queryFn: () =>
      postApi.getList({
        keyword: query || undefined,
        tagIds: filters.tagIds.length ? filters.tagIds : undefined,
        category: filters.category || undefined,
        status: filters.status || undefined,
        page,
        size: PAGE_SIZE,
      }),
    enabled: enabled && !aiMode,
  })

  // AI 의미 검색 (페이징 없음 — top N 반환)
  const { data: aiResults, isLoading: aiLoading, isFetching: aiFetching, error: aiError } = useQuery({
    queryKey: ['ai-search', { query, filters }],
    queryFn: () =>
      postApi.semanticSearch({
        query,
        limit: 24,
        category: filters.category || undefined,
        status: filters.status || undefined,
      }),
    enabled: enabled && aiMode,
    retry: false,
  })

  const handlePage = (next: number) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(keyword)
    if (keyword.trim()) searchApi.recordSearch(keyword).catch(() => {})
    setShowAdvanced(false)
  }

  const activeFilterCount =
    (filters.category ? 1 : 0) +
    (filters.status ? 1 : 0) +
    filters.tagIds.length

  const removeTag = (id: number) =>
    setFilters(f => ({ ...f, tagIds: f.tagIds.filter(x => x !== id) }))

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>검색</h1>

      <div className={styles.searchBarWrap}>
        <form onSubmit={handleSearch} className={styles.searchBar}>
          <input
            className={styles.searchInput}
            placeholder={aiMode
              ? '예: "개발자 모집하는 사이드 프로젝트", "정처기 같이 공부할 사람"'
              : '제목·본문에서 검색...'}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>검색</button>
          <button
            type="button"
            className={`${styles.advancedBtn} ${showAdvanced ? styles.advancedBtnActive : ''}`}
            onClick={() => setShowAdvanced(s => !s)}
          >
            상세 검색
            {activeFilterCount > 0 && <span className={styles.activeBadge}>{activeFilterCount}</span>}
            <span className={styles.caret}>{showAdvanced ? '▲' : '▼'}</span>
          </button>
        </form>

        <button
          type="button"
          className={`${styles.aiToggle} ${aiMode ? styles.aiToggleActive : ''}`}
          onClick={() => setAiMode(v => !v)}
          title="AI 의미 검색 — 자연어로 원하는 글을 찾아줍니다"
        >
          {aiMode ? '✨ AI 검색 ON' : '✨ AI 검색'}
        </button>

        <AdvancedSearchPanel
          open={showAdvanced}
          onClose={() => setShowAdvanced(false)}
          value={filters}
          onChange={setFilters}
        />
      </div>

      {/* 적용된 필터 요약 (드롭다운 닫혀있을 때 보이는 칩) */}
      {activeFilterCount > 0 && (
        <div className={styles.activeFilters}>
          {filters.category && (
            <button
              type="button"
              className={styles.activeChip}
              onClick={() => setFilters(f => ({ ...f, category: '' }))}
            >
              {CATEGORY_LABEL[filters.category]} ×
            </button>
          )}
          {filters.status && (
            <button
              type="button"
              className={styles.activeChip}
              onClick={() => setFilters(f => ({ ...f, status: '' }))}
            >
              {STATUS_LABEL[filters.status]} ×
            </button>
          )}
          {filters.tagIds.map(id => {
            const tag = tags.find(t => t.id === id)
            if (!tag) return null
            return (
              <button
                key={id}
                type="button"
                className={styles.activeChip}
                onClick={() => removeTag(id)}
              >
                #{tag.name} ×
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.results}>
        {!enabled && (
          <div className={styles.placeholder}>
            <p>{aiMode
              ? '검색어를 입력하세요. AI가 의미상 비슷한 글을 찾아드립니다.'
              : '검색어를 입력하거나 상세 검색으로 필터를 설정하세요'}</p>
          </div>
        )}

        {/* AI 의미 검색 결과 */}
        {aiMode && enabled && (
          (aiLoading || aiFetching) ? (
            <p className={styles.loading}>AI가 의미상 비슷한 글을 찾는 중...</p>
          ) : aiError ? (
            <p className={styles.loading}>
              AI 검색에 실패했습니다. ({aiError instanceof Error ? aiError.message : '알 수 없는 오류'})
            </p>
          ) : (
            <>
              <p className={styles.resultCount}>
                ✨ AI가 찾은 관련 게시글 {aiResults?.length ?? 0}개
              </p>
              <div className={styles.grid}>
                {aiResults?.map(post => (
                  <Link to={`/posts/${post.id}`} key={post.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <StatusBadge status={post.status} />
                      <span className={styles.cat}>{post.subCategory}</span>
                      {typeof post.similarity === 'number' && (
                        <span className={styles.similarity}>
                          {Math.round(post.similarity * 100)}% 일치
                        </span>
                      )}
                    </div>
                    <h3 className={styles.cardTitle}>{post.title}</h3>
                    <p className={styles.cardDesc}>{post.content}</p>
                    <div className={styles.cardTags}>
                      {post.tags?.slice(0, 4).map(t => <TagChip key={t.id} tag={t} size="sm" />)}
                    </div>
                    <div className={styles.cardFooter}>
                      <span>{post.author?.nickname}</span>
                      {post.capacity != null && (
                        <span>{post.currentMemberCount}/{post.capacity}명</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )
        )}

        {/* 일반 검색 결과 */}
        {!aiMode && enabled && (
          (isLoading || isFetching) ? (
            <p className={styles.loading}>검색 중...</p>
          ) : (
            <>
              {results && (
                <p className={styles.resultCount}>
                  {results.total}개의 게시글을 찾았습니다
                </p>
              )}
              <div className={styles.grid}>
                {results?.content.map(post => (
                  <Link to={`/posts/${post.id}`} key={post.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <StatusBadge status={post.status} />
                      <span className={styles.cat}>{post.subCategory}</span>
                    </div>
                    <h3 className={styles.cardTitle}>{post.title}</h3>
                    <p className={styles.cardDesc}>{post.content}</p>
                    <div className={styles.cardTags}>
                      {post.tags?.slice(0, 4).map(t => <TagChip key={t.id} tag={t} size="sm" />)}
                    </div>
                    <div className={styles.cardFooter}>
                      <span>{post.author?.nickname}</span>
                      {post.capacity != null && (
                        <span>{post.currentMemberCount}/{post.capacity}명</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {results && (
                <Pagination
                  page={page}
                  size={PAGE_SIZE}
                  total={results.total}
                  onChange={handlePage}
                />
              )}
            </>
          )
        )}
      </div>
    </div>
  )
}
