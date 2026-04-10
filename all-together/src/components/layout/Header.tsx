import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api'
import styles from './Header.module.css'

export default function Header() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    logout()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link to={isAuthenticated ? '/projects' : '/'} className={styles.logo}>
          ALL<span>투게더</span>
        </Link>

        <nav className={styles.nav}>
          <Link to="/projects" className={isActive('/projects') ? styles.active : ''}>프로젝트</Link>
          <Link to="/search" className={isActive('/search') ? styles.active : ''}>검색</Link>
        </nav>

        <div className={styles.actions}>
          {isAuthenticated ? (
            <>
              <Link to="/messages" className={styles.iconBtn} title="쪽지함">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </Link>
              <Link to="/applications" className={styles.iconBtn} title="지원 내역">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </Link>
              <Link to="/my" className={styles.avatar}>
                {user?.profileImage
                  ? <img src={user.profileImage} alt={user.name} />
                  : <span>{user?.name?.charAt(0)}</span>
                }
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className={styles.loginBtn}>로그인</Link>
              <Link to="/signup" className={styles.signupBtn}>시작하기</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
