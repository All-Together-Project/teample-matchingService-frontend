import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { postApi, tagApi } from '@/api'
import { type PostStatus } from '@/types'
import { StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import styles from './ProjectListPage.module.css'

const STATUS_OPTIONS: { value: PostStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'RECRUITING', label: '모집중' },
  { value: 'COMPLETE', label: '모집완료' },
  { value: 'FINISHED', label: '종료' },
]

export default function ProjectListPage() {
  const [status, setStatus] = useState<PostStatus | ''>('')
  const [keyword, setKeyword] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['posts', { category: 'PROJECT', status, keyword, selectedTagIds, page }],
    queryFn: () => postApi.getList({
      category: 'PROJECT',
      status: status || undefined,
      keyword: keyword || undefined,
      tagIds: selectedTagIds.length ? selectedTagIds : undefined,
      page, size: 12,
    }),
  })

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll(),
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1
  const isFirst = page === 0
  const isLast = data ? page >= totalPages - 1 : true

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div>
          <h1 className={styles.heading}>프로젝트 탐색</h1>
          <p className={styles.sub}>팀원을 찾는 프로젝트를 둘러보세요</p>
        </div>
        <Link to="/project/new">
          <Button size="md">+ 모집 공고 등록</Button>
        </Link>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.search}
          placeholder="프로젝트 검색..."
          value={keyword}
          onChange={e => { setKeyword(e.target.value); setPage(0) }}
        />
        <div className={styles.statusTabs}>
          {STATUS_OPTIONS.map(o => (
            <button
              key={o.value}
              className={`${styles.tab} ${status === o.value ? styles.tabActive : ''}`}
              onClick={() => { setStatus(o.value); setPage(0) }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {tags && (
        <div className={styles.tagFilter}>
          {tags.filter(t => t.category === 'PROJECT').map(t => (
            <TagChip
              key={t.id}
              tag={t}
              selected={selectedTagIds.includes(t.id)}
              onClick={() => { toggleTag(t.id); setPage(0) }}
              size="sm"
            />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading}>불러오는 중...</div>
      ) : (
        <>
          <div className={styles.grid}>
            {data?.content.map(post => (
              <Link to={`/posts/${post.id}`} key={post.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <StatusBadge status={post.status} />
                  <span className={styles.category}>{post.subCategory}</span>
                </div>
                <h3 className={styles.cardTitle}>{post.title}</h3>
                <p className={styles.cardDesc}>{post.content}</p>
                <div className={styles.cardTags}>
                  {post.tags?.slice(0, 3).map(t => (
                    <TagChip key={t.id} tag={t} size="sm" />
                  ))}
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.leader}>
                    <div className={styles.leaderAvatar}>
                      {post.author?.nickname?.charAt(0)}
                    </div>
                    <span>{post.author?.nickname}</span>
                  </div>
                  {post.capacity != null && (
                    <span className={styles.members}>
                      {post.currentMemberCount} / {post.capacity}명
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {data && totalPages > 1 && (
            <div className={styles.pagination}>
              <Button variant="outline" size="sm" disabled={isFirst} onClick={() => setPage(p => p - 1)}>이전</Button>
              <span>{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={isLast} onClick={() => setPage(p => p + 1)}>다음</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
