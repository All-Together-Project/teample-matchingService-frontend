import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectApi, tagApi } from '@/api'
import { type ProjectStatus } from '@/types'
import { StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import styles from './ProjectListPage.module.css'

const STATUS_OPTIONS: { value: ProjectStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'RECRUITING', label: '모집중' },
  { value: 'COMPLETED', label: '모집완료' },
  { value: 'CLOSED', label: '종료' },
]

export default function ProjectListPage() {
  const [status, setStatus] = useState<ProjectStatus | ''>('')
  const [keyword, setKeyword] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['projects', { status, keyword, selectedTagIds, page }],
    queryFn: () => projectApi.getList({
      status: status || undefined,
      keyword: keyword || undefined,
      tagIds: selectedTagIds.length ? selectedTagIds : undefined,
      page, size: 12,
    }).then(r => r.data.data),
  })

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll().then(r => r.data.data),
  })

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div className={styles.page}>
      {/* 헤더 */}
      <div className={styles.top}>
        <div>
          <h1 className={styles.heading}>프로젝트 탐색</h1>
          <p className={styles.sub}>팀원을 찾는 프로젝트를 둘러보세요</p>
        </div>
        <Link to="/projects/new">
          <Button size="md">+ 모집 공고 등록</Button>
        </Link>
      </div>

      {/* 검색 + 필터 */}
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

      {/* 태그 필터 */}
      {tags && (
        <div className={styles.tagFilter}>
          {tags.filter(t => t.type === 'TECH').map(t => (
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

      {/* 목록 */}
      {isLoading ? (
        <div className={styles.loading}>불러오는 중...</div>
      ) : (
        <>
          <div className={styles.grid}>
            {data?.content.map(project => (
              <Link to={`/projects/${project.id}`} key={project.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <StatusBadge status={project.status} />
                  <span className={styles.category}>{project.category}</span>
                </div>
                <h3 className={styles.cardTitle}>{project.title}</h3>
                <p className={styles.cardDesc}>{project.description}</p>
                <div className={styles.cardTags}>
                  {project.tags.slice(0, 3).map(t => (
                    <TagChip key={t.id} tag={t} size="sm" />
                  ))}
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.leader}>
                    <div className={styles.leaderAvatar}>
                      {project.leader.name.charAt(0)}
                    </div>
                    <span>{project.leader.nickname}</span>
                  </div>
                  <span className={styles.members}>
                    {project.currentMembers} / {project.maxMembers}명
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* 페이지네이션 */}
          {data && data.totalPages > 1 && (
            <div className={styles.pagination}>
              <Button variant="outline" size="sm" disabled={data.first} onClick={() => setPage(p => p - 1)}>이전</Button>
              <span>{page + 1} / {data.totalPages}</span>
              <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage(p => p + 1)}>다음</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
