import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

const CATEGORIES = [
  { label: '스터디', path: '/study', icon: '📚', desc: '함께 공부할 사람을 찾아보세요', color: '#7C3AED' },
  { label: '프로젝트', path: '/project', icon: '⚙️', desc: '팀원을 모집하고 협업하세요', color: '#2563EB' },
  { label: '모임', path: '/meetup', icon: '👥', desc: '취미, 운동, 네트워킹 모임', color: '#059669' },
  { label: '커뮤니티', path: '/community', icon: '💬', desc: '자유롭게 소통하고 정보 공유', color: '#D97706' },
]

const POPULAR_TAGS = [
  'React', 'TypeScript', 'Python', 'Spring', '토익', '정처기',
  '알고리즘', 'AI/ML', '독서', '러닝', 'Figma', 'AWS',
  '공모전', '사이드프로젝트', '네트워킹',
]

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <span className={styles.logo}>🤝 AllTogether</span>
        <div className={styles.navActions}>
          <Link to="/login" className={styles.loginBtn}>로그인</Link>
          <Link to="/signup" className={styles.signupBtn}>시작하기</Link>
        </div>
      </header>

      {/* 히어로 배너 */}
      <section className={styles.hero}>
        <h1>함께할 사람을<br />찾아보세요!</h1>
        <p>스터디, 프로젝트, 모임까지 — 다양한 분야의 팀원을 매칭해드립니다.</p>
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
      </section>

      {/* 빠른 카테고리 */}
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

      {/* 인기 게시글 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>인기 게시글</h2>
        <div className={styles.popularScroll}>
          {[
            { id: 1, title: '정처기 실기 스터디 모집', category: '스터디', status: '모집중', members: '3/5' },
            { id: 2, title: 'React 사이드 프로젝트', category: '프로젝트', status: '모집중', members: '2/4' },
            { id: 3, title: '주말 러닝 크루', category: '모임', status: '모집중', members: '8/15' },
            { id: 4, title: 'AI 논문 리딩 모임', category: '스터디', status: '모집중', members: '4/6' },
            { id: 5, title: '공모전 팀원 구합니다', category: '프로젝트', status: '모집중', members: '1/3' },
          ].map(post => (
            <div key={post.id} className={styles.popularCard}>
              <span className={styles.badge}>{post.status}</span>
              <span className={styles.cardCategory}>{post.category}</span>
              <h4>{post.title}</h4>
              <span className={styles.cardMembers}>{post.members}명</span>
            </div>
          ))}
        </div>
      </section>

      {/* 최신 게시글 + 인기 태그 */}
      <section className={styles.bottomSection}>
        <div className={styles.latestPosts}>
          <h2 className={styles.sectionTitle}>최신 게시글</h2>
          <div className={styles.postList}>
            {[
              { id: 1, title: '토익 900+ 목표 스터디', category: '스터디', author: '김지원', time: '방금 전' },
              { id: 2, title: 'Flutter 앱 개발 팀원 모집', category: '프로젝트', author: '이수연', time: '10분 전' },
              { id: 3, title: '강남 독서모임 (매주 토)', category: '모임', author: '박민준', time: '30분 전' },
              { id: 4, title: '백엔드 개발자 구합니다', category: '프로젝트', author: '최하은', time: '1시간 전' },
              { id: 5, title: 'SQLD 자격증 같이 준비해요', category: '스터디', author: '정서윤', time: '2시간 전' },
            ].map(post => (
              <div key={post.id} className={styles.postItem}>
                <span className={styles.postCategory}>{post.category}</span>
                <span className={styles.postTitle}>{post.title}</span>
                <span className={styles.postMeta}>{post.author} · {post.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.tagCloud}>
          <h2 className={styles.sectionTitle}>인기 태그</h2>
          <div className={styles.tags}>
            {POPULAR_TAGS.map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
