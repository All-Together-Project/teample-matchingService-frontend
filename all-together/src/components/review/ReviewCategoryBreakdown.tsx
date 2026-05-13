import type { Review, PostCategory } from '@/types'
import styles from './ReviewCategoryBreakdown.module.css'

interface Props {
  reviews: Review[]
}

const CATEGORY_LABEL: Record<Exclude<PostCategory, 'COMMUNITY'>, string> = {
  STUDY:   '스터디',
  PROJECT: '프로젝트',
  MEETUP:  '모임',
}

// 정렬용 표시 순서
const ORDER: Array<Exclude<PostCategory, 'COMMUNITY'>> = ['STUDY', 'PROJECT', 'MEETUP']

interface CategoryStat {
  count: number
  avgOverall: number
  items: Array<{ itemName: string; average: number; sortOrder: number }>
}

function buildStats(reviews: Review[]): Partial<Record<Exclude<PostCategory, 'COMMUNITY'>, CategoryStat>> {
  const byCat: Partial<Record<Exclude<PostCategory, 'COMMUNITY'>, {
    reviewCount: number
    overallSum: number
    overallCount: number
    itemMap: Map<string, { sum: number; count: number; sortOrder: number }>
  }>> = {}

  for (const r of reviews) {
    const cat = r.postCategory
    if (!cat || cat === ('COMMUNITY' as any)) continue
    const key = cat as Exclude<PostCategory, 'COMMUNITY'>
    if (!byCat[key]) {
      byCat[key] = { reviewCount: 0, overallSum: 0, overallCount: 0, itemMap: new Map() }
    }
    const slot = byCat[key]!
    slot.reviewCount++

    for (const [idx, s] of r.scores.entries()) {
      slot.overallSum += s.score
      slot.overallCount++
      const entry = slot.itemMap.get(s.itemName) ?? { sum: 0, count: 0, sortOrder: idx }
      entry.sum += s.score
      entry.count++
      slot.itemMap.set(s.itemName, entry)
    }
  }

  const out: Partial<Record<Exclude<PostCategory, 'COMMUNITY'>, CategoryStat>> = {}
  for (const k of ORDER) {
    const v = byCat[k]
    if (!v) continue
    const items = Array.from(v.itemMap.entries())
      .map(([itemName, e]) => ({ itemName, average: e.sum / e.count, sortOrder: e.sortOrder }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    out[k] = {
      count: v.reviewCount,
      avgOverall: v.overallCount > 0 ? v.overallSum / v.overallCount : 0,
      items,
    }
  }
  return out
}

export default function ReviewCategoryBreakdown({ reviews }: Props) {
  const stats = buildStats(reviews)
  const present = ORDER.filter((c) => stats[c])

  if (present.length === 0) return null

  return (
    <div className={styles.wrap}>
      {present.map((cat) => {
        const s = stats[cat]!
        return (
          <section key={cat} className={styles.section}>
            <header className={styles.head}>
              <span className={styles.catName}>{CATEGORY_LABEL[cat]}</span>
              <span className={styles.catCount}>{s.count}건</span>
              <span className={styles.catAvg}>★ {s.avgOverall.toFixed(1)}</span>
            </header>
            <div className={styles.items}>
              {s.items.map((it) => (
                <span key={it.itemName} className={styles.itemChip}>
                  {it.itemName} <strong>{it.average.toFixed(1)}</strong>
                </span>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
