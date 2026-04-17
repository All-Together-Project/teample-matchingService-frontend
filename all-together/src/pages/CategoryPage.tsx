import { useParams, useSearchParams, Link } from 'react-router-dom'
import type { PostCategory } from '@/types'
import Button from '@/components/common/Button'
import styles from './CategoryPage.module.css'

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

const MOCK_POSTS = [
  { id: 1, title: '정처기 실기 스터디 모집합니다', status: '모집중', author: '김지원', time: '2시간 전', tags: ['정처기', '자격증'], members: '3/5' },
  { id: 2, title: '토익 900+ 목표 같이 해요', status: '모집중', author: '이수연', time: '5시간 전', tags: ['토익', '어학'], members: '2/4' },
  { id: 3, title: 'CS 면접 스터디 (주 2회)', status: '모집완료', author: '박민준', time: '1일 전', tags: ['CS', '면접'], members: '6/6' },
]

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSub = searchParams.get('sub') || '전체'

  const meta = CATEGORY_META[category || ''] || CATEGORY_META.study

  const handleSubFilter = (sub: string) => {
    if (sub === '전체') {
      setSearchParams({})
    } else {
      setSearchParams({ sub })
    }
  }

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

      {/* 태그 필터 바 */}
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

      {/* 게시글 리스트 */}
      <div className={styles.list}>
        {MOCK_POSTS.map(post => (
          <Link to={`/${category}/${post.id}`} key={post.id} className={styles.postCard}>
            <span className={`${styles.badge} ${post.status === '모집완료' ? styles.badgeDone : ''}`}>
              {post.status}
            </span>
            <h3 className={styles.postTitle}>{post.title}</h3>
            <div className={styles.postTags}>
              {post.tags.map(tag => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
            <div className={styles.postMeta}>
              <span>{post.author}</span>
              <span>·</span>
              <span>{post.time}</span>
              <span className={styles.members}>{post.members}명</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
