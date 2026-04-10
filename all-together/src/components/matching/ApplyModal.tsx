import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { applicationApi } from '@/api'
import { type Project } from '@/types'
import Button from '@/components/common/Button'
import styles from './ApplyModal.module.css'

interface Props {
  project: Project
  onClose: () => void
  onSuccess: () => void
}

export default function ApplyModal({ project, onClose, onSuccess }: Props) {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [motivation, setMotivation] = useState('')
  const [introduction, setIntroduction] = useState('')

  const applyMutation = useMutation({
    mutationFn: () =>
      applicationApi.apply(project.id, {
        roleId: selectedRoleId!,
        motivation,
        introduction,
      }),
    onSuccess,
  })

  const availableRoles = project.roles.filter(r => r.filledCount < r.count)
  const canSubmit = selectedRoleId !== null && motivation.trim() && introduction.trim()

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>지원하기</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p className={styles.projectTitle}>{project.title}</p>

        {/* 역할 선택 */}
        <div className={styles.section}>
          <label className={styles.label}>지원 역할 선택 *</label>
          {availableRoles.length === 0 ? (
            <p className={styles.noRole}>현재 모집 중인 역할이 없습니다</p>
          ) : (
            <div className={styles.roles}>
              {availableRoles.map(role => (
                <button
                  key={role.id}
                  className={`${styles.roleBtn} ${selectedRoleId === role.id ? styles.selected : ''}`}
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  <span className={styles.roleName}>{role.roleName}</span>
                  <span className={styles.roleCount}>{role.filledCount}/{role.count}명</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 지원 동기 */}
        <div className={styles.section}>
          <label className={styles.label}>지원 동기 *</label>
          <textarea
            rows={3}
            placeholder="이 프로젝트에 지원하는 이유를 작성해주세요"
            value={motivation}
            onChange={e => setMotivation(e.target.value)}
            maxLength={500}
          />
          <span className={styles.count}>{motivation.length} / 500자</span>
        </div>

        {/* 자기소개 */}
        <div className={styles.section}>
          <label className={styles.label}>자기소개 *</label>
          <textarea
            rows={3}
            placeholder="본인의 역량과 경험을 소개해주세요"
            value={introduction}
            onChange={e => setIntroduction(e.target.value)}
            maxLength={500}
          />
          <span className={styles.count}>{introduction.length} / 500자</span>
        </div>

        <div className={styles.actions}>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button
            disabled={!canSubmit}
            loading={applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
          >
            지원서 제출
          </Button>
        </div>

        {applyMutation.isError && (
          <p className={styles.error}>지원 중 오류가 발생했습니다. 다시 시도해주세요.</p>
        )}
      </div>
    </div>
  )
}
