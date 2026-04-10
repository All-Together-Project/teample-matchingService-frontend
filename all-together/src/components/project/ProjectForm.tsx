import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tagApi } from '@/api'
import { type Project, type UserRole } from '@/types'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import styles from './ProjectForm.module.css'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'DEVELOPER', label: '개발' },
  { value: 'DESIGNER', label: '디자인' },
  { value: 'PLANNER', label: '기획' },
  { value: 'DATA', label: '데이터' },
  { value: 'MARKETING', label: '마케팅' },
]

interface Props {
  initialData?: Project
  onSubmit: (data: Partial<Project>) => Promise<void>
}

export default function ProjectForm({ initialData, onSubmit }: Props) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [category, setCategory] = useState(initialData?.category ?? '')
  const [maxMembers, setMaxMembers] = useState(initialData?.maxMembers ?? 4)
  const [startDate, setStartDate] = useState(initialData?.startDate ?? '')
  const [endDate, setEndDate] = useState(initialData?.endDate ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialData?.tags.map(t => t.id) ?? [])
  const [saving, setSaving] = useState(false)

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll().then(r => r.data.data),
  })

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const selectedTags = tags?.filter(t => selectedTagIds.includes(t.id)) ?? []
      await onSubmit({ title, description, category, maxMembers, startDate, endDate, tags: selectedTags })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.card}>
        <h2>기본 정보</h2>
        <div className={styles.field}>
          <label>프로젝트 제목 *</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="프로젝트 이름을 입력해주세요" />
        </div>
        <div className={styles.field}>
          <label>카테고리</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">선택</option>
            {['웹 서비스', '앱 개발', 'AI/ML', '커머스', '핀테크', '헬스케어', '에듀테크', '기타'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>프로젝트 소개 *</label>
          <textarea required rows={6} value={description} onChange={e => setDescription(e.target.value)} placeholder="프로젝트를 소개해주세요. 목적, 기술 스택, 팀 문화 등을 자유롭게 작성하세요." />
        </div>
        <div className={styles.row3}>
          <div className={styles.field}>
            <label>모집 인원</label>
            <input type="number" min={2} max={20} value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} />
          </div>
          <div className={styles.field}>
            <label>시작 예정일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>종료 예정일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 태그 */}
      <div className={styles.card}>
        <h2>기술 스택 태그</h2>
        <p className={styles.hint}>AI 추천 및 검색 필터에 활용됩니다</p>
        <div className={styles.tagWrap}>
          {tags?.filter(t => t.type === 'TECH').map(t => (
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
