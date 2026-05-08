import styles from './Pagination.module.css'

interface Props {
  page: number              // 0-indexed
  size: number
  total: number
  onChange: (next: number) => void
  /** 좌우에 보여줄 페이지 버튼 수 (현재 페이지 양옆) */
  siblings?: number
}

export default function Pagination({ page, size, total, onChange, siblings = 2 }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / size))
  if (totalPages <= 1) return null

  const start = Math.max(0, page - siblings)
  const end   = Math.min(totalPages - 1, page + siblings)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className={styles.pagination}>
      <button
        className={styles.btn}
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
        aria-label="이전 페이지"
      >‹</button>

      {start > 0 && (
        <>
          <button className={styles.btn} onClick={() => onChange(0)}>1</button>
          {start > 1 && <span className={styles.ellipsis}>…</span>}
        </>
      )}

      {pages.map(p => (
        <button
          key={p}
          className={`${styles.btn} ${p === page ? styles.active : ''}`}
          onClick={() => onChange(p)}
        >{p + 1}</button>
      ))}

      {end < totalPages - 1 && (
        <>
          {end < totalPages - 2 && <span className={styles.ellipsis}>…</span>}
          <button className={styles.btn} onClick={() => onChange(totalPages - 1)}>{totalPages}</button>
        </>
      )}

      <button
        className={styles.btn}
        disabled={page >= totalPages - 1}
        onClick={() => onChange(page + 1)}
        aria-label="다음 페이지"
      >›</button>
    </div>
  )
}
