import clsx from 'clsx'
import type { Tag } from '@/types'
import styles from './TagChip.module.css'

interface TagChipProps {
  tag: Tag
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
}

export default function TagChip({ tag, selected, onClick, size = 'md' }: TagChipProps) {
  const colorClass =
    tag.type === 'TECH' ? styles.tech :
    tag.type === 'INTEREST' ? styles.interest :
    styles.role

  return (
    <span
      className={clsx(styles.chip, colorClass, styles[size], selected && styles.selected, onClick && styles.clickable)}
      onClick={onClick}
    >
      {tag.name}
    </span>
  )
}
