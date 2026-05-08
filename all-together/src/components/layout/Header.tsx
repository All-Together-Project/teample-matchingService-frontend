import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { authApi, postApi } from '@/api'
import type { PostCategory } from '@/types'
import styles from './Header.module.css'

const PATH_TO_CATEGORY: Record<string, PostCategory> = {
  '/study': 'STUDY',
  '/project': 'PROJECT',
  '/meetup': 'MEETUP',
  '/community': 'COMMUNITY',
}

const MENU_ITEMS = [
  {
    label: '스터디',
    path: '/study',
    subs: [
      { name: '어학', desc: '영어, 일본어, 중국어 등', icon: '🌐' },
      { name: '자격증/시험', desc: '토익, 정처기, 공무원 등', icon: '📝' },
      { name: '독서', desc: '함께 읽고 토론해요', icon: '📚' },
      { name: '코딩/개발', desc: '알고리즘, CS 스터디', icon: '💻' },
      { name: '기타 학습', desc: '그 외 학습 모임', icon: '📖' },
    ],
  },
  {
    label: '프로젝트',
    path: '/project',
    subs: [
      { name: '개발', desc: '웹, 앱, 서버 프로젝트', icon: '⚙️' },
      { name: '디자인', desc: 'UI/UX, 그래픽 협업', icon: '🎨' },
      { name: '공모전', desc: '대회, 해커톤 참가', icon: '🏆' },
      { name: '창업/사이드', desc: '사이드 프로젝트, 창업', icon: '🚀' },
      { name: '기타 협업', desc: '그 외 협업 프로젝트', icon: '🤝' },
    ],
  },
  {
    label: '모임',
    path: '/meetup',
    subs: [
      { name: '운동/스포츠', desc: '러닝, 헬스, 풋살 등', icon: '⚽' },
      { name: '취미/문화', desc: '음악, 영화, 게임 등', icon: '🎵' },
      { name: '네트워킹', desc: '직무, 업종별 교류', icon: '🔗' },
      { name: '밥약/번개', desc: '가볍게 만나는 모임', icon: '🍽️' },
      { name: '기타 모임', desc: '그 외 모임', icon: '👋' },
    ],
  },
  {
    label: '커뮤니티',
    path: '/community',
    subs: [
      { name: '자유게시판', desc: '자유롭게 이야기해요', icon: '💬' },
      { name: '후기', desc: '활동 후기 공유', icon: '⭐' },
      { name: 'Q&A', desc: '궁금한 것을 질문해요', icon: '❓' },
      { name: '정보공유', desc: '유용한 정보 나눔', icon: '📌' },
      { name: '공지사항', desc: '서비스 공지', icon: '📢' },
    ],
  },
]

export default function Header() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    try { await authApi.logout() } catch { /* ignore */ }
    await logout()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <header className={styles.header} onMouseLeave={() => setOpenMenu(null)}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.logo}>
          🤝 AllTogether
        </Link>

        <nav className={styles.nav}>
          {MENU_ITEMS.map(item => (
            <div
              key={item.path}
              className={styles.menuItem}
              onMouseEnter={() => setOpenMenu(item.path)}
            >
              <Link
                to={item.path}
                className={`${styles.menuLink} ${isActive(item.path) ? styles.active : ''}`}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </nav>

        <div className={styles.actions}>
          {isAuthenticated ? (
            <>
              <Link to="/messages" className={styles.iconBtn} title="쪽지함">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </Link>
              <div className={styles.avatarWrap}>
                <Link to="/my" className={styles.avatar} title="마이페이지">
                  {user?.profileUrl
                    ? <img src={user.profileUrl} alt={user.nickname} />
                    : <span>{user?.nickname?.charAt(0)}</span>
                  }
                </Link>
                <button
                  type="button"
                  className={styles.miniLogoutBtn}
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            </>
          ) : (
            <Link to="/login" className={styles.loginBtn}>로그인</Link>
          )}
        </div>
      </div>

      {/* 메가 메뉴 드롭다운 */}
      {openMenu && (
        <div className={styles.megaMenu} onMouseLeave={() => setOpenMenu(null)}>
          <div className={`container ${styles.megaInner}`}>
            <div className={styles.megaSubs}>
              {MENU_ITEMS.find(m => m.path === openMenu)?.subs.map(sub => (
                <Link
                  key={sub.name}
                  to={`${openMenu}?sub=${encodeURIComponent(sub.name)}`}
                  className={styles.subItem}
                  onClick={() => setOpenMenu(null)}
                >
                  <span className={styles.subIcon}>{sub.icon}</span>
                  <div>
                    <div className={styles.subName}>{sub.name}</div>
                    <div className={styles.subDesc}>{sub.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
            <MegaMenuPreview categoryPath={openMenu} />
          </div>
        </div>
      )}
    </header>
  )
}

function MegaMenuPreview({ categoryPath }: { categoryPath: string }) {
  const category = PATH_TO_CATEGORY[categoryPath]
  const { data, isLoading } = useQuery({
    queryKey: ['mega-preview', category],
    queryFn: () => postApi.getList({ category, status: 'RECRUITING', size: 4 }),
    enabled: !!category,
    staleTime: 60_000,
  })

  const posts = data?.content ?? []

  return (
    <div className={styles.megaPreview}>
      <h4 className={styles.previewTitle}>모집중 게시글</h4>
      {isLoading && <p className={styles.previewEmpty}>불러오는 중...</p>}
      {!isLoading && posts.length === 0 && <p className={styles.previewEmpty}>모집중인 게시글이 없습니다.</p>}
      {posts.map(p => (
        <Link key={p.id} to={`/posts/${p.id}`} className={styles.previewItem}>
          <span className={styles.previewSub}>{p.subCategory}</span>
          <p className={styles.previewItemTitle}>{p.title}</p>
        </Link>
      ))}
    </div>
  )
}

