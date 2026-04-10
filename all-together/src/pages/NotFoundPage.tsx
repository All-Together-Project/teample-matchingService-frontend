import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
      <div style={{ fontSize: 64, marginBottom: '1rem' }}>🔍</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: '0.75rem' }}>페이지를 찾을 수 없습니다</h1>
      <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link
        to="/projects"
        style={{
          padding: '12px 28px', background: 'var(--color-primary)', color: '#fff',
          borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 600,
        }}
      >
        프로젝트 목록으로
      </Link>
    </div>
  )
}
