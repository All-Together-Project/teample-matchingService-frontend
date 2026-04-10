import type { ReviewSummary } from '@/types'
import styles from './ReviewSummaryCard.module.css'

const METRICS = [
  { key: 'averageExpertise',    label: '전문성' },
  { key: 'averageCommunication', label: '소통성' },
  { key: 'averagePunctuality',  label: '시간 준수' },
  { key: 'averageParticipation', label: '참여 태도' },
  { key: 'averagePassion',      label: '열정' },
] as const

export default function ReviewSummaryCard({ summary }: { summary: ReviewSummary }) {
  const overall = (
    summary.averageExpertise +
    summary.averageCommunication +
    summary.averagePunctuality +
    summary.averageParticipation +
    summary.averagePassion
  ) / 5

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2>평가 요약</h2>
        <div className={styles.overall}>
          <span className={styles.overallNum}>{overall.toFixed(1)}</span>
          <span className={styles.overallSub}>/ 5.0 · {summary.totalReviews}개 리뷰</span>
        </div>
      </div>

      <div className={styles.bars}>
        {METRICS.map(m => {
          const val = summary[m.key]
          return (
            <div key={m.key} className={styles.barRow}>
              <span className={styles.barLabel}>{m.label}</span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(val / 5) * 100}%` }} />
              </div>
              <span className={styles.barValue}>{val.toFixed(1)}</span>
            </div>
          )
        })}
      </div>

      {summary.recentComment && (
        <p className={styles.recentComment}>"{summary.recentComment}"</p>
      )}
    </div>
  )
}
