import styles from './Badge.module.css'

export function TempBadge({ value }: { value: number }) {
  const color = value >= 50 ? '#1D9E75' : value >= 36.5 ? '#EF9F27' : '#E24B4A'
  return (
    <span className={styles.temp} style={{ color, borderColor: color + '40', background: color + '12' }}>
      🌡 {value.toFixed(1)}°
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    RECRUITING: { label: '모집중', cls: styles.recruiting },
    COMPLETE:   { label: '모집완료', cls: styles.completed },
    FINISHED:   { label: '종료', cls: styles.closed },
    GENERAL:    { label: '일반', cls: styles.completed },
    PENDING:    { label: '검토중', cls: styles.pending },
    ACCEPTED:   { label: '승인', cls: styles.approved },
    REJECTED:   { label: '거절', cls: styles.rejected },
  }
  const s = map[status] ?? { label: status, cls: '' }
  return <span className={`${styles.status} ${s.cls}`}>{s.label}</span>
}
