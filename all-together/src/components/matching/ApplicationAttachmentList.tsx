import { useState } from 'react'
import { attachmentApi } from '@/api'
import type { Attachment } from '@/types'
import styles from './ApplicationsShared.module.css'

interface Props {
  attachments: Attachment[]
}

const formatBytes = (n?: number) => {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function ApplicationAttachmentList({ attachments }: Props) {
  const [opening, setOpening] = useState<number | null>(null)

  if (!attachments?.length) return null

  const handleOpen = async (a: Attachment) => {
    setOpening(a.id)
    try {
      const url = await attachmentApi.getApplicationFileUrl(a.filePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      alert(`파일을 열 수 없습니다: ${e?.message ?? '알 수 없는 오류'}`)
    } finally {
      setOpening(null)
    }
  }

  return (
    <ul className={styles.attachList}>
      {attachments.map(a => (
        <li key={a.id} className={styles.attachItem}>
          <span className={styles.attachIcon}>📎</span>
          <button
            type="button"
            className={styles.attachName}
            onClick={() => handleOpen(a)}
            disabled={opening === a.id}
          >
            {a.fileName}
            {opening === a.id && ' (여는 중...)'}
          </button>
          <span className={styles.attachSize}>{formatBytes(a.fileSize)}</span>
        </li>
      ))}
    </ul>
  )
}
