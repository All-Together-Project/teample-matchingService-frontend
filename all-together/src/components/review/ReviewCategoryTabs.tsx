import type { PostCategory } from '@/types'
import styles from './ReviewCategoryTabs.module.css'

export type ReviewCategoryFilter = 'ALL' | Exclude<PostCategory, 'COMMUNITY'>

interface Props {
  value: ReviewCategoryFilter
  counts: Record<ReviewCategoryFilter, number>
  onChange: (next: ReviewCategoryFilter) => void
}

const TABS: Array<{ key: ReviewCategoryFilter; label: string }> = [
  { key: 'ALL',     label: '전체' },
  { key: 'STUDY',   label: '스터디' },
  { key: 'PROJECT', label: '프로젝트' },
  { key: 'MEETUP',  label: '모임' },
]

export default function ReviewCategoryTabs({ value, counts, onChange }: Props) {
  return (
    <div className={styles.tabs}>
      {TABS.map(t => (
        <button
          key={t.key}
          type="button"
          className={`${styles.tab} ${value === t.key ? styles.active : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          <span className={styles.count}>{counts[t.key]}</span>
        </button>
      ))}
    </div>
  )
}
