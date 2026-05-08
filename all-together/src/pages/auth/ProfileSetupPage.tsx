import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userApi, tagApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import type { PostCategory } from '@/types'
import Button from '@/components/common/Button'
import styles from './ProfileSetupPage.module.css'

const ACTIVITY_CATEGORIES: { value: Exclude<PostCategory, 'COMMUNITY'>; label: string; icon: string }[] = [
  { value: 'STUDY',   label: '스터디', icon: '📚' },
  { value: 'PROJECT', label: '프로젝트', icon: '💻' },
  { value: 'MEETUP',  label: '모임', icon: '🤝' },
]

const MAX_TAGS = 10

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, updateUser } = useAuthStore()
  const isEdit = location.pathname === '/my/edit'

  const [step, setStep] = useState(1)
  const [introduction, setIntroduction] = useState('')
  const [major, setMajor] = useState('')
  const [activeCats, setActiveCats] = useState<PostCategory[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll(),
  })

  // 편집 모드 초기 데이터 로드
  const { data: profile } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => userApi.getProfile(user!.id),
    enabled: isEdit && !!user,
  })

  useEffect(() => {
    if (!isEdit || hydrated || !profile) return
    setIntroduction(profile.introduction ?? '')
    setMajor(profile.major ?? '')
    const tagIds = profile.tags.map(t => t.id)
    setSelectedTagIds(tagIds)
    // 기존 태그가 속한 카테고리를 활동 카테고리로 자동 선택
    const cats = new Set<PostCategory>()
    for (const t of profile.tags) {
      if (t.category === 'STUDY' || t.category === 'PROJECT' || t.category === 'MEETUP') {
        cats.add(t.category)
      }
    }
    setActiveCats(Array.from(cats))
    setHydrated(true)
  }, [isEdit, hydrated, profile])

  const visibleTags = (tagsData ?? []).filter(t =>
    t.category === 'GENERAL' || activeCats.includes(t.category as PostCategory)
  )

  const toggleCat = (c: PostCategory) =>
    setActiveCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= MAX_TAGS) return prev
      return [...prev, id]
    })

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const updated = await userApi.updateProfile(user.id, { introduction, major })
      await userApi.updateTags(user.id, selectedTagIds)
      updateUser(updated)
      navigate(isEdit ? '/my' : '/')
    } catch {
      alert('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <span className={styles.logo}>{isEdit ? '프로필 편집' : <>ALL<span>투게더</span></>}</span>
        </div>

        <div className={styles.stepper}>
          {['기본 정보', '활동 카테고리', '관심 태그'].map((label, i) => (
            <div key={i} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${step > i + 1 ? styles.done : step === i + 1 ? styles.active : ''}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`${styles.stepLabel} ${step === i + 1 ? styles.activeLabel : ''}`}>{label}</span>
              {i < 2 && <div className={`${styles.stepLine} ${step > i + 1 ? styles.lineDone : ''}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className={styles.section}>
            <h2>{isEdit ? '기본 정보 수정' : '프로필을 완성해주세요'}</h2>
            <p className={styles.sub}>다른 멤버들에게 보여질 정보입니다</p>
            <div className={styles.field}>
              <label>한 줄 소개</label>
              <textarea
                rows={3}
                maxLength={80}
                placeholder="나를 한 줄로 소개해보세요"
                value={introduction}
                onChange={e => setIntroduction(e.target.value)}
              />
              <span className={styles.count}>{introduction.length} / 80자</span>
            </div>
            <div className={styles.field}>
              <label>전공 / 직무</label>
              <input placeholder="예: 컴퓨터공학, 디자이너, 마케터" value={major} onChange={e => setMajor(e.target.value)} />
            </div>
            <div className={styles.btnRow}>
              {isEdit && <Button variant="outline" onClick={() => navigate('/my')}>취소</Button>}
              <Button fullWidth size="lg" onClick={() => setStep(2)}>다음</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.section}>
            <h2>어떤 활동에 관심 있으신가요?</h2>
            <p className={styles.sub}>복수 선택 가능합니다</p>
            <div className={styles.roleGrid}>
              {ACTIVITY_CATEGORIES.map(c => (
                <button
                  key={c.value}
                  className={`${styles.roleBtn} ${activeCats.includes(c.value) ? styles.roleSel : ''}`}
                  onClick={() => toggleCat(c.value)}
                >
                  <span>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
            <div className={styles.btnRow}>
              <Button variant="outline" onClick={() => setStep(1)}>이전</Button>
              <Button fullWidth onClick={() => setStep(3)} disabled={!activeCats.length}>다음</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.section}>
            <h2>관심 태그를 선택해주세요</h2>
            <p className={styles.sub}>AI 맞춤 추천의 기반이 됩니다 (최대 {MAX_TAGS}개)</p>

            <div className={styles.tagGroup}>
              <p className={styles.tagGroupLabel}>선택됨 {selectedTagIds.length} / {MAX_TAGS}</p>
              <div className={styles.tagWrap}>
                {visibleTags.map(t => (
                  <button
                    key={t.id}
                    className={`${styles.tag} ${styles.tagTech} ${selectedTagIds.includes(t.id) ? styles.tagSel : ''}`}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
                {!visibleTags.length && <p style={{ color: '#888' }}>활동 카테고리를 먼저 선택해주세요</p>}
              </div>
            </div>

            <div className={styles.btnRow}>
              <Button variant="outline" onClick={() => setStep(2)}>이전</Button>
              <Button fullWidth loading={saving} onClick={handleSave}>
                {isEdit ? '저장' : '완료 — 시작하기!'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
