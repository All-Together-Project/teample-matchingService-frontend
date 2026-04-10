import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userApi, tagApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { type UserRole, type Tag } from '@/types'
import Button from '@/components/common/Button'
import styles from './ProfileSetupPage.module.css'

const ROLES: { value: UserRole; label: string; icon: string }[] = [
  { value: 'DEVELOPER', label: '개발', icon: '💻' },
  { value: 'DESIGNER',  label: '디자인', icon: '🎨' },
  { value: 'PLANNER',   label: '기획', icon: '📋' },
  { value: 'DATA',      label: '데이터', icon: '📊' },
  { value: 'MARKETING', label: '마케팅', icon: '📢' },
  { value: 'OTHER',     label: '기타', icon: '➕' },
]

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()

  const [step, setStep] = useState(1)
  const [bio, setBio] = useState('')
  const [major, setMajor] = useState('')
  const [organization, setOrganization] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll().then(r => r.data.data),
  })
  const techTags  = tagsData?.filter(t => t.type === 'TECH') ?? []
  const interestTags = tagsData?.filter(t => t.type === 'INTEREST') ?? []

  const toggleRole = (r: UserRole) =>
    setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const [profileRes] = await Promise.all([
        userApi.updateProfile(user.id, { bio, major, organization, roles: selectedRoles }),
        userApi.updateTags(user.id, selectedTagIds),
      ])
      updateUser(profileRes.data.data)
      navigate('/projects')
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
          <span className={styles.logo}>ALL<span>투게더</span></span>
        </div>

        {/* 스텝 인디케이터 */}
        <div className={styles.stepper}>
          {['기본 정보', '역할 선택', '관심 태그'].map((label, i) => (
            <div key={i} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${step > i + 1 ? styles.done : step === i + 1 ? styles.active : ''}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`${styles.stepLabel} ${step === i + 1 ? styles.activeLabel : ''}`}>{label}</span>
              {i < 2 && <div className={`${styles.stepLine} ${step > i + 1 ? styles.lineDone : ''}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 — 기본 정보 */}
        {step === 1 && (
          <div className={styles.section}>
            <h2>프로필을 완성해주세요</h2>
            <p className={styles.sub}>다른 팀원들에게 보여질 정보입니다</p>
            <div className={styles.field}>
              <label>한 줄 소개</label>
              <textarea
                rows={3}
                maxLength={80}
                placeholder="나를 한 줄로 소개해보세요"
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
              <span className={styles.count}>{bio.length} / 80자</span>
            </div>
            <div className={styles.row2}>
              <div className={styles.field}>
                <label>전공</label>
                <input placeholder="전공 입력" value={major} onChange={e => setMajor(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label>학교 / 소속</label>
                <input placeholder="학교 또는 직장" value={organization} onChange={e => setOrganization(e.target.value)} />
              </div>
            </div>
            <Button fullWidth size="lg" onClick={() => setStep(2)}>다음</Button>
          </div>
        )}

        {/* Step 2 — 역할 */}
        {step === 2 && (
          <div className={styles.section}>
            <h2>활동 역할을 선택해주세요</h2>
            <p className={styles.sub}>복수 선택 가능합니다</p>
            <div className={styles.roleGrid}>
              {ROLES.map(r => (
                <button
                  key={r.value}
                  className={`${styles.roleBtn} ${selectedRoles.includes(r.value) ? styles.roleSel : ''}`}
                  onClick={() => toggleRole(r.value)}
                >
                  <span>{r.icon}</span>
                  {r.label}
                </button>
              ))}
            </div>
            <div className={styles.btnRow}>
              <Button variant="outline" onClick={() => setStep(1)}>이전</Button>
              <Button fullWidth onClick={() => setStep(3)}>다음</Button>
            </div>
          </div>
        )}

        {/* Step 3 — 태그 */}
        {step === 3 && (
          <div className={styles.section}>
            <h2>관심 태그를 선택해주세요</h2>
            <p className={styles.sub}>AI 추천의 기반이 되는 데이터입니다</p>

            <div className={styles.tagGroup}>
              <p className={styles.tagGroupLabel}>기술 스택</p>
              <div className={styles.tagWrap}>
                {techTags.map(t => (
                  <button
                    key={t.id}
                    className={`${styles.tag} ${styles.tagTech} ${selectedTagIds.includes(t.id) ? styles.tagSel : ''}`}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.tagGroup}>
              <p className={styles.tagGroupLabel}>관심 분야</p>
              <div className={styles.tagWrap}>
                {interestTags.map(t => (
                  <button
                    key={t.id}
                    className={`${styles.tag} ${styles.tagInterest} ${selectedTagIds.includes(t.id) ? styles.tagSelPurple : ''}`}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.btnRow}>
              <Button variant="outline" onClick={() => setStep(2)}>이전</Button>
              <Button fullWidth loading={saving} onClick={handleSave}>완료 — 시작하기!</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
