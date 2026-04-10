import { Link } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <span className={styles.logo}>ALL<span>투게더</span></span>
        <div className={styles.navActions}>
          <Link to="/login" className={styles.loginBtn}>로그인</Link>
          <Link to="/signup" className={styles.signupBtn}>시작하기</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.badge}>통합 팀 매칭 플랫폼</div>
        <h1>완벽한 팀, 지금 바로<br /><span>ALL 투게더</span>에서 찾으세요</h1>
        <p>프로젝트 공고 등록부터 AI 기반 팀원 추천, 상호 평가 시스템까지.<br />당신의 다음 프로젝트를 함께할 팀을 연결해드립니다.</p>
        <div className={styles.heroBtns}>
          <Link to="/signup" className={styles.btnPrimary}>프로젝트 시작하기</Link>
          <Link to="/projects" className={styles.btnOutline}>둘러보기</Link>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}><strong>1,240+</strong><span>등록 프로젝트</span></div>
          <div className={styles.stat}><strong>3,800+</strong><span>활성 사용자</span></div>
          <div className={styles.stat}><strong>92%</strong><span>매칭 성공률</span></div>
        </div>
      </section>

      <section className={styles.features}>
        {[
          { icon: '👥', title: '팀 매칭 시스템', desc: '역할별 지원서로 기획/개발/디자인 각 포지션에 최적화된 팀원을 모집하세요.' },
          { icon: '✨', title: 'AI 맞춤 추천', desc: '관심 태그와 역량 데이터 기반으로 딱 맞는 프로젝트와 팀원을 자동으로 추천합니다.' },
          { icon: '⭐', title: '신뢰도 시스템', desc: '프로젝트 종료 후 팀원 상호 평가로 온도와 티어가 자동 갱신됩니다.' },
          { icon: '💬', title: '소통 기능', desc: '댓글과 1:1 쪽지로 자유롭게 소통하고, 상태 변경 시 자동 알림을 받으세요.' },
        ].map(f => (
          <div key={f.title} className={styles.featureCard}>
            <div className={styles.featureIcon}>{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
