import type { ReviewSummary } from '@/types'
import styles from './ReviewSummaryCard.module.css'

// 슬림화된 요약 카드 — 전체 평균/개수/최근 코멘트만.
// 카테고리별 항목 breakdown은 ReviewCategoryBreakdown에서 처리.
export default function ReviewSummaryCard({ summary }: { summary: ReviewSummary }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2>평가 요약</h2>
        <div className={styles.overall}>
          <span className={styles.overallStar}>★</span>
          <span className={styles.overallNum}>{summary.averageOverall.toFixed(1)}</span>
          <span className={styles.overallSub}>/ 5.0 · {summary.totalReviews}개 리뷰</span>
        </div>
      </div>
      {summary.recentComment && (
        <p className={styles.recentComment}>"{summary.recentComment}"</p>
      )}
    </div>
  )
}
