import type { UserTier } from '@/types'
import styles from './Badge.module.css'

export function TempBadge({ value }: { value: number }) {
  const color = value >= 60 ? '#1D9E75' : value >= 40 ? '#EF9F27' : '#E24B4A'
  return (
    <span className={styles.temp} style={{ color, borderColor: color + '40', background: color + '12' }}>
      🌡 {value.toFixed(1)}°
    </span>
  )
}

const TIER_LABELS: Record<UserTier, string> = {
  ROOKIE: '루키', BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘',
}
const TIER_COLORS: Record<UserTier, { bg: string; color: string; border: string }> = {
  ROOKIE:   { bg: '#F1EFE8', color: '#5F5E5A', border: '#D3D1C7' },
  BRONZE:   { bg: '#FAECE7', color: '#712B13', border: '#F0997B' },
  SILVER:   { bg: '#F1EFE8', color: '#444441', border: '#B4B2A9' },
  GOLD:     { bg: '#FAEEDA', color: '#633806', border: '#FAC775' },
  PLATINUM: { bg: '#EEEDFE', color: '#3C3489', border: '#AFA9EC' },
}

export function TierBadge({ tier }: { tier: UserTier }) {
  const c = TIER_COLORS[tier]
  return (
    <span className={styles.tier} style={{ background: c.bg, color: c.color, borderColor: c.border }}>
      🏅 {TIER_LABELS[tier]}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    RECRUITING: { label: '모집중', cls: styles.recruiting },
    COMPLETED:  { label: '모집완료', cls: styles.completed },
    CLOSED:     { label: '종료', cls: styles.closed },
    PENDING:    { label: '검토중', cls: styles.pending },
    APPROVED:   { label: '승인', cls: styles.approved },
    REJECTED:   { label: '거절', cls: styles.rejected },
    CANCELLED:  { label: '취소', cls: styles.cancelled },
  }
  const s = map[status] ?? { label: status, cls: '' }
  return <span className={`${styles.status} ${s.cls}`}>{s.label}</span>
}
