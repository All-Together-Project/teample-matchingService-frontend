import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tagApi } from '@/api'
import { type Post, SUB_CATEGORIES } from '@/types'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import styles from './ProjectForm.module.css'

interface Props {
  initialData?: Post
  onSubmit: (data: Partial<Post>) => Promise<void>
}

export default function ProjectForm({ initialData, onSubmit }: Props) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [subCategory, setSubCategory] = useState(initialData?.subCategory ?? '')
  const [capacity, setCapacity] = useState(initialData?.capacity ?? 4)
  const [period, setPeriod] = useState(initialData?.period ?? '')
  const [deadline, setDeadline] = useState(initialData?.deadline?.slice(0, 10) ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialData?.tags?.map(t => t.id) ?? [])
  const [saving, setSaving] = useState(false)

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll(),
  })

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const selectedTags = tags?.filter(t => selectedTagIds.includes(t.id)) ?? []
      await onSubmit({
        title,
        content,
        subCategory,
        capacity,
        period: period || undefined,
        deadline: deadline || undefined,
        tags: selectedTags,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.card}>
        <h2>기본 정보</h2>
        <div className={styles.field}>
          <label>제목 *</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="이름을 입력해주세요" />
        </div>
        <div className={styles.field}>
          <label>하위 카테고리</label>
          <select value={subCategory} onChange={e => setSubCategory(e.target.value)}>
            <option value="">선택</option>
            {SUB_CATEGORIES.PROJECT.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>소개 *</label>
          <textarea required rows={6} value={content} onChange={e => setContent(e.target.value)} placeholder="목적, 기술 스택, 팀 문화 등을 자유롭게 작성하세요." />
        </div>
        <div className={styles.row3}>
          <div className={styles.field}>
            <label>모집 인원</label>
            <input type="number" min={2} max={20} value={capacity} onChange={e => setCapacity(Number(e.target.value))} />
          </div>
          <div className={styles.field}>
            <label>예상 진행 기간</label>
            <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="예: 3개월" />
          </div>
          <div className={styles.field}>
            <label>모집 마감일</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2>태그</h2>
        <p className={styles.hint}>AI 추천 및 검색 필터에 활용됩니다</p>
        <div className={styles.tagWrap}>
          {tags?.filter(t => t.category === 'PROJECT' || t.category === 'GENERAL').map(t => (
            <TagChip
              key={t.id}
              tag={t}
              selected={selectedTagIds.includes(t.id)}
              onClick={() => toggleTag(t.id)}
              size="sm"
            />
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={() => history.back()}>취소</Button>
        <Button type="submit" loading={saving} size="lg">
          {initialData ? '수정 완료' : '공고 등록'}
        </Button>
      </div>
    </form>
  )
}
