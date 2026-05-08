import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { applicationApi, attachmentApi } from '@/api'
import { type Post } from '@/types'
import Button from '@/components/common/Button'
import styles from './ApplyModal.module.css'

interface Props {
  post: Post
  onClose: () => void
  onSuccess: () => void
}

const MAX_APP_FILES = 5
const MAX_APP_SIZE = 10 * 1024 * 1024

const formatBytes = (n: number) =>
  n < 1024 ? `${n} B`
  : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB`
  : `${(n / 1024 / 1024).toFixed(1)} MB`

export default function ApplyModal({ post, onClose, onSuccess }: Props) {
  const roles = post.roles ?? []
  const hasRoles = roles.length > 0
  const isCommunity = post.category === 'COMMUNITY'

  const [introduction, setIntroduction] = useState('')
  const [roleId, setRoleId] = useState<number | null>(
    hasRoles ? (roles.find(r => r.filledCount < r.capacity)?.id ?? roles[0].id) : null
  )
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? [])
    const room = MAX_APP_FILES - files.length
    if (room <= 0) {
      alert(`첨부파일은 최대 ${MAX_APP_FILES}개까지 가능합니다.`)
      return
    }
    const accepted: File[] = []
    for (const f of incoming.slice(0, room)) {
      if (f.size > MAX_APP_SIZE) {
        alert(`"${f.name}" 파일이 10MB를 초과합니다.`)
        continue
      }
      accepted.push(f)
    }
    setFiles(prev => [...prev, ...accepted])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const applyMutation = useMutation({
    mutationFn: async () => {
      const created = await applicationApi.apply(post.id, {
        introduction,
        roleId: roleId ?? undefined,
      })
      // 첨부 업로드 — 일부 실패해도 지원서는 이미 생성됨
      const failed: string[] = []
      for (const f of files) {
        try { await attachmentApi.uploadApplicationFile(created.id, f) }
        catch (e) { failed.push(f.name); console.error(e) }
      }
      if (failed.length > 0) {
        alert(`다음 파일 업로드에 실패했습니다:\n${failed.join('\n')}`)
      }
      return created
    },
    onSuccess,
  })

  const errorMsg = applyMutation.error instanceof Error
    ? applyMutation.error.message
    : null

  const canSubmit =
    introduction.trim().length > 0 &&
    (!hasRoles || roleId !== null) &&
    !isCommunity

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>지원하기</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p className={styles.projectTitle}>{post.title}</p>

        {hasRoles && (
          <div className={styles.section}>
            <label className={styles.label}>지원 역할 *</label>
            <div className={styles.roleGrid}>
              {roles.map(r => {
                const full = r.filledCount >= r.capacity
                const selected = roleId === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`${styles.roleBtn} ${selected ? styles.roleBtnActive : ''} ${full ? styles.roleBtnFull : ''}`}
                    disabled={full}
                    onClick={() => setRoleId(r.id)}
                  >
                    <span className={styles.roleName}>{r.name}</span>
                    <span className={styles.roleCount}>
                      {r.filledCount}/{r.capacity}명{full ? ' · 마감' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <label className={styles.label}>지원 동기 / 자기소개 *</label>
          <textarea
            rows={6}
            placeholder="이 게시글에 지원하는 이유와 본인의 역량·경험을 자유롭게 작성해주세요"
            value={introduction}
            onChange={e => setIntroduction(e.target.value)}
            maxLength={500}
          />
          <span className={styles.count}>{introduction.length} / 500자</span>
        </div>

        <div className={styles.section}>
          <label className={styles.label}>첨부파일</label>
          <p className={styles.fileHint}>
            자기소개서, 포트폴리오, 스펙 자료 등 (최대 {MAX_APP_FILES}개, 파일당 10MB)
          </p>

          {files.length > 0 && (
            <ul className={styles.fileList}>
              {files.map((f, i) => (
                <li key={i} className={styles.fileItem}>
                  <span className={styles.fileIcon}>📎</span>
                  <span className={styles.fileName}>{f.name}</span>
                  <span className={styles.fileSize}>{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    className={styles.fileRemove}
                    onClick={() => removeFile(i)}
                    aria-label="파일 제거"
                  >×</button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileInputRef}
            id="apply-file-input"
            type="file"
            multiple
            onChange={handleFilePick}
            disabled={files.length >= MAX_APP_FILES}
            style={{ display: 'none' }}
          />
          <label
            htmlFor="apply-file-input"
            className={`${styles.fileAddBtn} ${files.length >= MAX_APP_FILES ? styles.fileAddBtnDisabled : ''}`}
          >
            + 파일 추가 ({files.length}/{MAX_APP_FILES})
          </label>
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
          <p className={styles.error}>{errorMsg || '지원 중 오류가 발생했습니다. 다시 시도해주세요.'}</p>
        )}
      </div>
    </div>
  )
}
