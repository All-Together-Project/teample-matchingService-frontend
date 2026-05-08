import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { postApi, tagApi } from '@/api'
import type { PostCategory } from '@/types'
import { StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import styles from './SearchPage.module.css'

const CATEGORY_OPTIONS: { value: PostCategory | ''; label: string }[] = [
  { value: '',          label: '전체' },
  { value: 'STUDY',     label: '스터디' },
  { value: 'PROJECT',   label: '프로젝트' },
  { value: 'MEETUP',    label: '모임' },
  { value: 'COMMUNITY', label: '커뮤니티' },
]

export default function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [category, setCategory] = useState<PostCategory | ''>('')
  const [useSemanticSearch, setUseSemanticSearch] = useState(false)

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll(),
  })

  const enabled = !!(query || selectedTagIds.length || category)

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['search', { query, selectedTagIds, category, useSemanticSearch }],
    queryFn: async () => {
      if (useSemanticSearch && query) {
        const content = await postApi.semanticSearch(query, 20)
        return { content, total: content.length, page: 0, size: 20 }
      }
      return postApi.getList({
        keyword: query || undefined,
        tagIds: selectedTagIds.length ? selectedTagIds : undefined,
        category: category || undefined,
        size: 20,
      })
    },
    enabled,
  })

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(keyword)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>검색</h1>

      <form onSubmit={handleSearch} className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder={useSemanticSearch ? '예: 정처기 같이 공부할 사람 있어?' : '제목 검색...'}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
        <button type="submit" className={styles.searchBtn}>검색</button>
        <label style={{ marginLeft: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={useSemanticSearch}
            onChange={e => setUseSemanticSearch(e.target.checked)}
          /> AI 자연어 검색
        </label>
      </form>

      <div className={styles.layout}>
        <aside className={styles.filterPanel}>
          <div className={styles.filterSection}>
            <h3>카테고리</h3>
            <div className={styles.filterOptions}>
              {CATEGORY_OPTIONS.map(c => (
                <button
                  key={c.value}
                  className={`${styles.filterOpt} ${category === c.value ? styles.optActive : ''}`}
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h3>태그</h3>
            <div className={styles.tagWrap}>
              {tags?.map(t => (
                <TagChip
                  key={t.id}
                  tag={t}
                  selected={selectedTagIds.includes(t.id)}
                  onClick={() => toggleTag(t.id)}
                  size="sm"
                />
              ))}
            </div>
          </div>
        </aside>

        <div className={styles.results}>
          {!enabled && (
            <div className={styles.placeholder}>
              <p>검색어를 입력하거나 태그를 선택하세요</p>
            </div>
          )}

          {(isLoading || isFetching) && enabled ? (
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
