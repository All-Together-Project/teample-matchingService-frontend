import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tagApi } from '@/api'
import { type Attachment, type Post, type PostCategory, SUB_CATEGORIES } from '@/types'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import styles from './ProjectForm.module.css'

interface RoleDraft {
  name: string
  capacity: number
}

export interface PostFormData {
  title: string
  content: string
  subCategory: string
  capacity?: number | null
  period?: string | null
  deadline?: string | null
  tagIds: number[]
  roles?: RoleDraft[]
  pendingFiles: File[]                  // 신규 업로드할 파일들
  removedAttachments: Attachment[]      // 삭제할 기존 첨부 (수정 시)
}

const MAX_FILE_SIZE = 10 * 1024 * 1024   // 10 MB
const MAX_FILES = 5

const formatBytes = (n?: number) => {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

interface Props {
  category: PostCategory
  initialData?: Post
  onSubmit: (data: PostFormData) => Promise<void>
}

const TAG_FILTER: Record<PostCategory, Array<'STUDY' | 'PROJECT' | 'MEETUP' | 'GENERAL'>> = {
  STUDY:     ['STUDY', 'GENERAL'],
  PROJECT:   ['PROJECT', 'GENERAL'],
  MEETUP:    ['MEETUP', 'GENERAL'],
  COMMUNITY: ['GENERAL'],
}

export default function ProjectForm({ category, initialData, onSubmit }: Props) {
  const isCommunity = category === 'COMMUNITY'
  const isEdit = !!initialData
  const qc = useQueryClient()

  const [title, setTitle] = useState(initialData?.title ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [subCategory, setSubCategory] = useState(initialData?.subCategory ?? '')
  const [period, setPeriod] = useState(initialData?.period ?? '')
  const [deadline, setDeadline] = useState(initialData?.deadline?.slice(0, 10) ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialData?.tags?.map(t => t.id) ?? [])
  const [saving, setSaving] = useState(false)
  const [customTagInput, setCustomTagInput] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)

  // 첨부파일 — 기존(수정 모드) + 신규 업로드 대기 + 삭제 대기
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>(initialData?.attachments ?? [])
  const [removedAttachments, setRemovedAttachments] = useState<Attachment[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const totalFileCount = existingAttachments.length + pendingFiles.length

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? [])
    const room = MAX_FILES - totalFileCount
    if (room <= 0) {
      alert(`첨부파일은 최대 ${MAX_FILES}개까지 가능합니다.`)
      return
    }
    const accepted: File[] = []
    for (const f of incoming.slice(0, room)) {
      if (f.size > MAX_FILE_SIZE) {
        alert(`"${f.name}" 파일이 10MB를 초과합니다.`)
        continue
      }
      accepted.push(f)
    }
    setPendingFiles(prev => [...prev, ...accepted])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (idx: number) =>
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))

  const removeExistingAttachment = (a: Attachment) => {
    setExistingAttachments(prev => prev.filter(x => x.id !== a.id))
    setRemovedAttachments(prev => [...prev, a])
  }

  // 역할 편집 — 신규 등록 시 기본 1개 행. 수정 모드에선 기존 역할 표시(읽기 전용)
  const [roles, setRoles] = useState<RoleDraft[]>(() => {
    if (initialData?.roles?.length) {
      return initialData.roles.map(r => ({ name: r.name, capacity: r.capacity }))
    }
    return isCommunity ? [] : [{ name: '', capacity: 1 }]
  })

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagApi.getAll(),
  })

  const allowedTagCats = TAG_FILTER[category]
  const filteredTags = (tags ?? []).filter(t => allowedTagCats.includes(t.category))
  const totalCapacity = roles.reduce((s, r) => s + (Number(r.capacity) || 0), 0)

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // 커스텀 태그 추가 — 게시글 카테고리에 맞춰서 생성 (커뮤니티는 GENERAL)
  const handleAddCustomTag = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = customTagInput.trim()
    if (!name) return
    setCreatingTag(true)
    try {
      const targetCategory = category === 'COMMUNITY' ? 'GENERAL' : category
      const tag = await tagApi.upsert(name, targetCategory)
      await qc.invalidateQueries({ queryKey: ['tags'] })
      setSelectedTagIds(prev => prev.includes(tag.id) ? prev : [...prev, tag.id])
      setCustomTagInput('')
    } catch (err: any) {
      alert(err?.message ?? '태그 추가에 실패했습니다')
    } finally {
      setCreatingTag(false)
    }
  }

  const updateRole = (idx: number, patch: Partial<RoleDraft>) =>
    setRoles(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const addRole = () => setRoles(prev => [...prev, { name: '', capacity: 1 }])
  const removeRole = (idx: number) =>
    setRoles(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isCommunity) {
      if (roles.length === 0) {
        alert('최소 1개의 역할이 필요합니다.')
        return
      }
      const invalid = roles.find(r => !r.name.trim() || !r.capacity || r.capacity < 1)
      if (invalid) {
        alert('역할 이름과 인원(1명 이상)을 모두 입력해주세요.')
        return
      }
    }

    setSaving(true)
    try {
      await onSubmit({
        title,
        content,
        subCategory,
        capacity: isCommunity ? null : (totalCapacity || null),
        period: period || null,
        deadline: deadline || null,
        tagIds: selectedTagIds,
        roles: isCommunity || isEdit ? undefined : roles,   // 수정 모드는 기존 역할 유지
        pendingFiles,
        removedAttachments,
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
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="제목을 입력해주세요" />
        </div>
        <div className={styles.field}>
          <label>하위 카테고리 *</label>
          <select required value={subCategory} onChange={e => setSubCategory(e.target.value)}>
            <option value="">선택</option>
            {SUB_CATEGORIES[category].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label>{isCommunity ? '내용 *' : '소개 *'}</label>
          <textarea
            required
            rows={6}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={isCommunity
              ? '자유롭게 글을 작성해주세요.'
              : '목적, 진행 방식, 지원 자격 등을 자유롭게 작성하세요.'}
          />
        </div>

        {!isCommunity && (
          <div className={styles.row3}>
            <div className={styles.field}>
              <label>예상 진행 기간</label>
              <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="예: 3개월 / 정기" />
            </div>
            <div className={styles.field}>
              <label>모집 마감일</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>총 모집 인원</label>
              <input type="number" value={totalCapacity} readOnly tabIndex={-1} />
            </div>
          </div>
        )}
      </div>

      {!isCommunity && (
        <div className={styles.card}>
          <h2>모집 역할</h2>
          <p className={styles.hint}>역할별로 필요한 인원을 정하세요. 지원자가 지원 시 역할을 선택합니다. (최소 1개)</p>

          {isEdit ? (
            <div className={styles.roleList}>
              {roles.length === 0 ? (
                <p className={styles.hint}>등록된 역할이 없습니다.</p>
              ) : roles.map((r, i) => (
                <div key={i} className={styles.roleRowReadonly}>
                  <span>{r.name}</span>
                  <span>{r.capacity}명</span>
                </div>
              ))}
              <p className={styles.hint}>※ 역할은 글 작성 시에만 정의할 수 있습니다.</p>
            </div>
          ) : (
            <>
              <div className={styles.roleList}>
                {roles.map((r, i) => (
                  <div key={i} className={styles.roleRow}>
                    <input
                      placeholder="역할명 (예: 개발자, 스터디장)"
                      value={r.name}
                      onChange={e => updateRole(i, { name: e.target.value })}
                    />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={r.capacity}
                      onChange={e => updateRole(i, { capacity: Number(e.target.value) })}
                    />
                    <span className={styles.unit}>명</span>
                    <button
                      type="button"
                      className={styles.roleRemove}
                      onClick={() => removeRole(i)}
                      disabled={roles.length <= 1}
                      aria-label="역할 삭제"
                    >×</button>
                  </div>
                ))}
              </div>
              <button type="button" className={styles.addRole} onClick={addRole}>
                + 역할 추가
              </button>
            </>
          )}
        </div>
      )}

      <div className={styles.card}>
        <h2>태그</h2>
        <p className={styles.hint}>AI 추천 및 검색 필터에 활용됩니다. 원하는 태그가 없다면 직접 추가하세요.</p>

        <div className={styles.customTagForm}>
          <input
            placeholder="원하는 태그 입력 후 Enter (예: 프롬프트 엔지니어링)"
            value={customTagInput}
            onChange={e => setCustomTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddCustomTag(e as unknown as React.FormEvent)
              }
            }}
            maxLength={20}
            disabled={creatingTag}
          />
          <Button
            type="button"
            size="sm"
            disabled={!customTagInput.trim() || creatingTag}
            loading={creatingTag}
            onClick={(e) => handleAddCustomTag(e as unknown as React.FormEvent)}
          >
            추가
          </Button>
        </div>

        <div className={styles.tagWrap}>
          {filteredTags.map(t => (
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

      <div className={styles.card}>
        <h2>첨부파일</h2>
        <p className={styles.hint}>
          방향성 문서, 이미지 등 (최대 {MAX_FILES}개, 파일당 10MB 이하)
        </p>

        {existingAttachments.length > 0 && (
          <ul className={styles.fileList}>
            {existingAttachments.map(a => (
              <li key={a.id} className={styles.fileItem}>
                <span className={styles.fileIcon}>📎</span>
                {a.publicUrl ? (
                  <a href={a.publicUrl} target="_blank" rel="noreferrer" className={styles.fileName}>
                    {a.fileName}
                  </a>
                ) : (
                  <span className={styles.fileName}>{a.fileName}</span>
                )}
                <span className={styles.fileSize}>{formatBytes(a.fileSize)}</span>
                <button
                  type="button"
                  className={styles.fileRemove}
                  onClick={() => removeExistingAttachment(a)}
                  aria-label="첨부 삭제"
                >×</button>
              </li>
            ))}
          </ul>
        )}

        {pendingFiles.length > 0 && (
          <ul className={styles.fileList}>
            {pendingFiles.map((f, i) => (
              <li key={i} className={`${styles.fileItem} ${styles.filePending}`}>
                <span className={styles.fileIcon}>📤</span>
                <span className={styles.fileName}>{f.name}</span>
                <span className={styles.fileSize}>{formatBytes(f.size)}</span>
                <button
                  type="button"
                  className={styles.fileRemove}
                  onClick={() => removePendingFile(i)}
                  aria-label="파일 제거"
                >×</button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFilePick}
            disabled={totalFileCount >= MAX_FILES}
            style={{ display: 'none' }}
            id="post-file-input"
          />
          <label
            htmlFor="post-file-input"
            className={`${styles.fileAddBtn} ${totalFileCount >= MAX_FILES ? styles.fileAddBtnDisabled : ''}`}
          >
            + 파일 추가 ({totalFileCount}/{MAX_FILES})
          </label>
        </div>
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={() => history.back()}>취소</Button>
        <Button type="submit" loading={saving} size="lg">
          {isEdit ? '수정 완료' : '공고 등록'}
        </Button>
      </div>
    </form>
  )
}
