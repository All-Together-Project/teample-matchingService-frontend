import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tagApi } from '@/api'
import type { PostCategory } from '@/types'
import TagChip from '@/components/common/TagChip'
import styles from './AdvancedSearchPanel.module.css'

export interface AdvancedFilterValue {
  category: PostCategory | ''
  status: string
  tagIds: number[]
}

interface Props {
  open: boolean
  onClose: () => void
  value: AdvancedFilterValue
  onChange: (next: AdvancedFilterValue) => void
}

const CATEGORY_OPTIONS: { value: PostCategory | ''; label: string }[] = [
  { value: '',          label: '전체' },
  { value: 'STUDY',     label: '스터디' },
  { value: 'PROJECT',   label: '프로젝트' },
  { value: 'MEETUP',    label: '모임' },
  { value: 'COMMUNITY', label: '커뮤니티' },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '',           label: '전체' },
  { value: 'RECRUITING', label: '모집중' },
  { value: 'COMPLETE',   label: '모집마감' },
  { value: 'FINISHED',   label: '종료' },
  { value: 'GENERAL',    label: '일반(커뮤)' },
]

export default function AdvancedSearchPanel({ open, onClose, value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [tagSearch, setTagSearch] = useState('')

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll(),
    enabled: open,
  })
  const { data: popularTags = [] } = useQuery({
    queryKey: ['tags', 'popular', 10],
    queryFn: () => tagApi.getPopular(10),
    enabled: open,
  })

  // 외부 클릭 / Escape 닫기
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const toggleTag = (id: number) =>
    onChange({
      ...value,
      tagIds: value.tagIds.includes(id) ? value.tagIds.filter(x => x !== id) : [...value.tagIds, id],
    })

  const reset = () => onChange({ category: '', status: '', tagIds: [] })

  const filteredSearchTags = tags
    .filter(t => !value.tagIds.includes(t.id))
    .filter(t => tagSearch.trim().length === 0 || t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    .slice(0, 20)

  return (
    <div className={styles.panel} ref={ref}>
      <div className={styles.head}>
        <h3>상세 검색</h3>
        {(value.category || value.status || value.tagIds.length > 0) && (
          <button type="button" className={styles.resetBtn} onClick={reset}>초기화</button>
        )}
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>카테고리</label>
        <div className={styles.chips}>
          {CATEGORY_OPTIONS.map(c => (
            <button
              key={c.value}
              type="button"
              className={`${styles.chip} ${value.category === c.value ? styles.chipActive : ''}`}
              onClick={() => onChange({ ...value, category: c.value })}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>상태</label>
        <div className={styles.chips}>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.value}
              type="button"
              className={`${styles.chip} ${value.status === s.value ? styles.chipActive : ''}`}
              onClick={() => onChange({ ...value, status: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>
          태그 {value.tagIds.length > 0 && <span className={styles.count}>({value.tagIds.length})</span>}
        </label>

        {value.tagIds.length > 0 && (
          <div className={styles.selectedWrap}>
            {tags
              .filter(t => value.tagIds.includes(t.id))
              .map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.selectedChip}
                  onClick={() => toggleTag(t.id)}
                >
                  {t.name} <span className={styles.removeX}>×</span>
                </button>
              ))}
          </div>
        )}

        <p className={styles.subLabel}>인기 태그</p>
        <div className={styles.tagWrap}>
          {popularTags
            .filter(t => !value.tagIds.includes(t.id))
            .map(t => (
              <TagChip key={t.id} tag={t} onClick={() => toggleTag(t.id)} size="sm" />
            ))}
        </div>

        <input
          className={styles.search}
          placeholder="태그 직접 검색..."
          value={tagSearch}
          onChange={e => setTagSearch(e.target.value)}
        />
        {tagSearch.trim().length > 0 && (
          <div className={styles.searchResult}>
            {filteredSearchTags.length === 0 ? (
              <p className={styles.empty}>일치하는 태그가 없습니다</p>
            ) : (
              filteredSearchTags.map(t => (
                <TagChip
                  key={t.id}
                  tag={t}
                  onClick={() => { toggleTag(t.id); setTagSearch('') }}
                  size="sm"
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
