import { useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'
import { postApi } from '@/api'
import type { PostCategory } from '@/types'
import Button from '@/components/common/Button'
import { StatusBadge } from '@/components/common/Badge'
import Pagination from '@/components/common/Pagination'
import styles from './CategoryPage.module.css'

const PAGE_SIZE = 12

dayjs.extend(relativeTime)
dayjs.locale('ko')

const CATEGORY_META: Record<string, { title: string; desc: string; category: PostCategory; subs: string[] }> = {
  study: {
    title: '스터디',
    desc: '함께 공부할 팀원을 찾아보세요',
    category: 'STUDY',
    subs: ['전체', '어학', '자격증/시험', '독서', '코딩/개발', '기타 학습'],
  },
  project: {
    title: '프로젝트',
    desc: '팀원을 모집하고 함께 만들어보세요',
    category: 'PROJECT',
    subs: ['전체', '개발', '디자인', '공모전', '창업/사이드', '기타 협업'],
  },
  meetup: {
    title: '모임',
    desc: '관심사가 비슷한 사람들과 만나보세요',
    category: 'MEETUP',
    subs: ['전체', '운동/스포츠', '취미/문화', '네트워킹', '밥약/번개', '기타 모임'],
  },
  community: {
    title: '커뮤니티',
    desc: '자유롭게 소통하고 정보를 나눠보세요',
    category: 'COMMUNITY',
    subs: ['전체', '자유게시판', '후기', 'Q&A', '정보공유', '공지사항'],
  },
}

type StatusFilter = 'ALL' | 'RECRUITING' | 'COMPLETE' | 'FINISHED' | 'GENERAL'

const STATUS_TABS: { value: StatusFilter; label: string; categoryFilter?: 'COMMUNITY' | 'NON_COMMUNITY' }[] = [
  { value: 'ALL',        label: '전체' },
  { value: 'RECRUITING', label: '모집중',     categoryFilter: 'NON_COMMUNITY' },
  { value: 'COMPLETE',   label: '모집마감',   categoryFilter: 'NON_COMMUNITY' },
  { value: 'FINISHED',   label: '종료',       categoryFilter: 'NON_COMMUNITY' },
  { value: 'GENERAL',    label: '일반',       categoryFilter: 'COMMUNITY' },
]

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSub = searchParams.get('sub') || '전체'
  const selectedStatus = (searchParams.get('status') as StatusFilter) || 'ALL'
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0)

  const meta = CATEGORY_META[category || ''] || CATEGORY_META.study
  const isCommunity = meta.category === 'COMMUNITY'

  const visibleStatusTabs = STATUS_TABS.filter(t => {
    if (!t.categoryFilter) return true
    if (t.categoryFilter === 'COMMUNITY') return isCommunity
    if (t.categoryFilter === 'NON_COMMUNITY') return !isCommunity
    return true
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['posts', meta.category, selectedSub, selectedStatus, page],
    queryFn: () =>
      postApi.getList({
        category: meta.category,
        subCategory: selectedSub === '전체' ? undefined : selectedSub,
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        page,
        size: PAGE_SIZE,
      }),
  })

  const updateParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    next.delete('page')   // 필터 변경 시 첫 페이지로
    setSearchParams(next)
  }

  const handleSubFilter = (sub: string) => updateParam('sub', sub, '전체')
  const handleStatusFilter = (status: StatusFilter) => updateParam('status', status, 'ALL')

  const handlePage = (next: number) => {
    const params = new URLSearchParams(searchParams)
    if (next === 0) params.delete('page')
    else params.set('page', String(next))
    setSearchParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 카테고리 자체가 바뀌면 페이지 리셋
  useEffect(() => {
    if (page !== 0) {
      const params = new URLSearchParams(searchParams)
      params.delete('page')
      setSearchParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  const posts = data?.content ?? []
  const total = data?.total ?? 0

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div>
          <h1 className={styles.heading}>{meta.title}</h1>
          <p className={styles.sub}>{meta.desc}</p>
        </div>
        <Link to={`/${category}/new`}>
          <Button size="md">+ 글쓰기</Button>
        </Link>
      </div>

      <div className={styles.statusTabs}>
        {visibleStatusTabs.map(t => (
          <button
            key={t.value}
            className={`${styles.statusTab} ${selectedStatus === t.value ? styles.statusActive : ''}`}
            onClick={() => handleStatusFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.filterBar}>
        {meta.subs.map(sub => (
          <button
            key={sub}
            className={`${styles.filterBtn} ${selectedSub === sub ? styles.filterActive : ''}`}
            onClick={() => handleSubFilter(sub)}
          >
            {sub}
          </button>
        ))}
      </div>

      {isLoading && <div className={styles.empty}>불러오는 중...</div>}
      {isError && <div className={styles.empty}>게시글을 불러오지 못했습니다.</div>}
      {!isLoading && !isError && posts.length === 0 && (
        <div className={styles.empty}>
          {selectedSub === '전체' ? '아직 게시글이 없습니다.' : `'${selectedSub}' 게시글이 아직 없습니다.`}
        </div>
      )}

      <div className={styles.list}>
        {posts.map(post => (
          <Link to={`/posts/${post.id}`} key={post.id} className={styles.postCard}>
            <div className={styles.cardHead}>
              <StatusBadge status={post.status} />
              <span className={styles.subCategory}>{post.subCategory}</span>
            </div>
            <h3 className={styles.postTitle}>{post.title}</h3>
            {post.tags?.length > 0 && (
              <div className={styles.postTags}>
                {post.tags.map(tag => (
                  <span key={tag.id} className={styles.tag}>{tag.name}</span>
                ))}
              </div>
            )}
            <div className={styles.postMeta}>
              <span>{post.author?.nickname ?? '익명'}</span>
              <span>·</span>
              <span>{dayjs(post.createdAt).fromNow()}</span>
              {post.capacity != null && (
                <span className={styles.members}>
                  {post.currentMemberCount}/{post.capacity}명
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      <Pagination page={page} size={PAGE_SIZE} total={total} onChange={handlePage} />
    </div>
  )
}
