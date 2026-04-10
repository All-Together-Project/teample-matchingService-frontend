import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { projectApi, tagApi } from '@/api'
import { StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import styles from './SearchPage.module.css'

export default function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [category, setCategory] = useState('')

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll().then(r => r.data.data),
  })

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['search', { query, selectedTagIds, category }],
    queryFn: () =>
      projectApi.getList({
        keyword: query || undefined,
        tagIds: selectedTagIds.length ? selectedTagIds : undefined,
        category: category || undefined,
        size: 20,
      }).then(r => r.data.data),
    enabled: !!(query || selectedTagIds.length || category),
  })

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(keyword)
  }

  const categories = ['웹 서비스', '앱 개발', 'AI/ML', '커머스', '핀테크', '헬스케어', '에듀테크', '기타']

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>검색</h1>

      {/* 검색바 */}
      <form onSubmit={handleSearch} className={styles.searchBar}>
        <input
          className={styles.searchInput}
          placeholder="프로젝트 이름, 설명 검색..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
        <button type="submit" className={styles.searchBtn}>검색</button>
      </form>

      <div className={styles.layout}>
        {/* 필터 사이드바 */}
        <aside className={styles.filterPanel}>
          <div className={styles.filterSection}>
            <h3>카테고리</h3>
            <div className={styles.filterOptions}>
              <button
                className={`${styles.filterOpt} ${category === '' ? styles.optActive : ''}`}
                onClick={() => setCategory('')}
              >전체</button>
              {categories.map(c => (
                <button
                  key={c}
                  className={`${styles.filterOpt} ${category === c ? styles.optActive : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h3>기술 스택</h3>
            <div className={styles.tagWrap}>
              {tags?.filter(t => t.type === 'TECH').map(t => (
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

          <div className={styles.filterSection}>
            <h3>관심 분야</h3>
            <div className={styles.tagWrap}>
              {tags?.filter(t => t.type === 'INTEREST').map(t => (
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

        {/* 결과 */}
        <div className={styles.results}>
          {!query && !selectedTagIds.length && !category && (
            <div className={styles.placeholder}>
              <p>검색어를 입력하거나 태그를 선택하세요</p>
            </div>
          )}

          {isLoading || isFetching ? (
            <p className={styles.loading}>검색 중...</p>
          ) : (
            <>
              {results && (
                <p className={styles.resultCount}>
                  {results.totalElements}개의 프로젝트를 찾았습니다
                </p>
              )}
              <div className={styles.grid}>
                {results?.content.map(project => (
                  <Link to={`/projects/${project.id}`} key={project.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <StatusBadge status={project.status} />
                      <span className={styles.cat}>{project.category}</span>
                    </div>
                    <h3 className={styles.cardTitle}>{project.title}</h3>
                    <p className={styles.cardDesc}>{project.description}</p>
                    <div className={styles.cardTags}>
                      {project.tags.slice(0, 4).map(t => <TagChip key={t.id} tag={t} size="sm" />)}
                    </div>
                    <div className={styles.cardFooter}>
                      <span>{project.leader.nickname}</span>
                      <span>{project.currentMembers}/{project.maxMembers}명</span>
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
