import type { ReviewSummary } from '@/types'
import styles from './ReviewSummaryCard.module.css'

export default function ReviewSummaryCard({ summary }: { summary: ReviewSummary }) {
  const items = summary.itemAverages ?? []

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2>평가 요약</h2>
        <div className={styles.overall}>
          <span className={styles.overallNum}>{summary.averageOverall.toFixed(1)}</span>
          <span className={styles.overallSub}>/ 5.0 · {summary.totalReviews}개 리뷰</span>
        </div>
      </div>

      <div className={styles.bars}>
        {items.map((m) => (
          <div key={m.itemName} className={styles.barRow}>
            <span className={styles.barLabel}>{m.itemName}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${(m.average / 5) * 100}%` }} />
            </div>
            <span className={styles.barValue}>{m.average.toFixed(1)}</span>
          </div>
        ))}
      </div>

      {summary.recentComment && (
        <p className={styles.recentComment}>"{summary.recentComment}"</p>
      )}
    </div>
  )
}
