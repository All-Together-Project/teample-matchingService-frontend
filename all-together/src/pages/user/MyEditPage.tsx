import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tagApi, userApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import type { Tag } from '@/types'
import Button from '@/components/common/Button'
import styles from './MyEditPage.module.css'

const MAX_TAGS = 10

const TAG_GROUPS: { key: Tag['category']; label: string }[] = [
  { key: 'STUDY',   label: '스터디' },
  { key: 'PROJECT', label: '프로젝트' },
  { key: 'MEETUP',  label: '모임' },
  { key: 'GENERAL', label: '공통' },
]

export default function MyEditPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, updateUser } = useAuthStore()

  const [nickname, setNickname] = useState('')
  const [introduction, setIntroduction] = useState('')
  const [major, setMajor] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
  const [customTagInput, setCustomTagInput] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => userApi.getProfile(user!.id),
    enabled: !!user,
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll(),
  })

  useEffect(() => {
    if (hydrated || !profile) return
    setNickname(profile.nickname ?? '')
    setIntroduction(profile.introduction ?? '')
    setMajor(profile.major ?? '')
    setSelectedTagIds(new Set(profile.tags.map(t => t.id)))
    setHydrated(true)
  }, [hydrated, profile])

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_TAGS) next.add(id)
      return next
    })

  const handleAddCustomTag = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = customTagInput.trim()
    if (!name) return
    setCreatingTag(true)
    try {
      const tag = await tagApi.upsert(name, 'GENERAL')
      // tags 캐시 무효화 (그룹에 새 태그 반영)
      await qc.invalidateQueries({ queryKey: ['tags'] })
      // 자동 선택 (정원 안 차 있으면)
      setSelectedTagIds(prev => {
        const next = new Set(prev)
        if (next.size < MAX_TAGS) next.add(tag.id)
        return next
      })
      setCustomTagInput('')
    } catch (err: any) {
      alert(err?.message ?? '태그 추가에 실패했습니다')
    } finally {
      setCreatingTag(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const updated = await userApi.updateProfile(user.id, {
        nickname: nickname.trim() || user.nickname,
        introduction,
        major,
      })
      await userApi.updateTags(user.id, Array.from(selectedTagIds))
      updateUser(updated)
      await qc.invalidateQueries({ queryKey: ['user', user.id] })
      navigate('/my')
    } catch {
      alert('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>프로필 편집</h1>
        <p>한 줄 소개, 전공, 관심 태그를 한 번에 수정할 수 있어요.</p>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>기본 정보</h2>

        <div className={styles.field}>
          <label>닉네임</label>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="닉네임"
            maxLength={20}
          />
        </div>

        <div className={styles.field}>
          <label>한 줄 소개</label>
          <textarea
            rows={3}
            maxLength={80}
            value={introduction}
            onChange={e => setIntroduction(e.target.value)}
            placeholder="나를 한 줄로 소개해보세요"
          />
          <span className={styles.count}>{introduction.length} / 80자</span>
        </div>

        <div className={styles.field}>
          <label>전공 / 직무</label>
          <input
            value={major}
            onChange={e => setMajor(e.target.value)}
            placeholder="예: 컴퓨터공학, 디자이너, 마케터"
          />
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>관심 태그</h2>
          <span className={styles.tagCount}>
            {selectedTagIds.size} / {MAX_TAGS}
          </span>
        </div>
        <p className={styles.hint}>AI 맞춤 추천에 활용됩니다. 원하는 태그가 없다면 직접 추가하세요.</p>

        <form className={styles.customTagForm} onSubmit={handleAddCustomTag}>
          <input
            placeholder="원하는 태그 입력 후 Enter (예: 디자인 시스템)"
            value={customTagInput}
            onChange={e => setCustomTagInput(e.target.value)}
            maxLength={20}
            disabled={creatingTag}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!customTagInput.trim() || creatingTag}
            loading={creatingTag}
          >
            추가
          </Button>
        </form>

        {TAG_GROUPS.map(group => {
          const groupTags = tags.filter(t => t.category === group.key)
          if (groupTags.length === 0) return null
          return (
            <div key={group.key} className={styles.tagGroup}>
              <h3 className={styles.groupTitle}>{group.label}</h3>
              <div className={styles.tagWrap}>
                {groupTags.map(t => {
                  const selected = selectedTagIds.has(t.id)
                  const disabled = !selected && selectedTagIds.size >= MAX_TAGS
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.tagBtn} ${selected ? styles.tagSel : ''}`}
                      onClick={() => toggleTag(t.id)}
                      disabled={disabled}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      <div className={styles.actions}>
        <Button variant="outline" onClick={() => navigate('/my')}>취소</Button>
        <Button size="lg" onClick={handleSave} loading={saving}>저장</Button>
      </div>
    </div>
  )
}
