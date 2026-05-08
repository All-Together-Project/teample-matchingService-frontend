import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messageApi } from '@/api'
import { type Message } from '@/types'
import Button from '@/components/common/Button'
import ComposeMessageModal from './ComposeMessageModal'
import styles from './MessagePage.module.css'

export default function MessagePage() {
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [selected, setSelected] = useState<Message | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const qc = useQueryClient()

  const { data: inbox } = useQuery({
    queryKey: ['messages-inbox'],
    queryFn: () => messageApi.getInbox(),
  })

  const { data: sent } = useQuery({
    queryKey: ['messages-sent'],
    queryFn: () => messageApi.getSent(),
    enabled: tab === 'sent',
  })

  const readMutation = useMutation({
    mutationFn: (id: number) => messageApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages-inbox'] })
      qc.invalidateQueries({ queryKey: ['messages-unread'] })
    },
  })

  const handleSelect = (msg: Message) => {
    // 즉시 UI 반영 (DB 업데이트는 백그라운드)
    setSelected({ ...msg, isRead: true })
    if (!msg.isRead && tab === 'inbox') {
      readMutation.mutate(msg.id)
    }
  }

  const messages = tab === 'inbox' ? inbox : sent
  const unreadCount = inbox?.filter(m => !m.isRead).length ?? 0

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>쪽지함</h1>
        <Button onClick={() => setShowCompose(true)}>+ 쪽지 쓰기</Button>
      </div>

      <div className={styles.layout}>
        {/* 목록 */}
        <div className={styles.listPanel}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'inbox' ? styles.active : ''}`} onClick={() => { setTab('inbox'); setSelected(null) }}>
              수신함 {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
            </button>
            <button className={`${styles.tab} ${tab === 'sent' ? styles.active : ''}`} onClick={() => { setTab('sent'); setSelected(null) }}>
              발신함
            </button>
          </div>

          <div className={styles.list}>
            {messages?.length === 0 && (
              <p className={styles.empty}>쪽지가 없습니다</p>
            )}
            {messages?.map(msg => {
              const isUnread = !msg.isRead && tab === 'inbox'
              return (
                <button
                  key={msg.id}
                  className={`${styles.msgItem} ${selected?.id === msg.id ? styles.msgSelected : ''} ${isUnread ? styles.unread : styles.read}`}
                  onClick={() => handleSelect(msg)}
                >
                  <div className={styles.msgAvatar}>
                    {(tab === 'inbox' ? msg.sender : msg.receiver).nickname.charAt(0)}
                  </div>
                  <div className={styles.msgInfo}>
                    <div className={styles.msgTop}>
                      <span className={styles.msgFrom}>
                        {msg.type === 'SYSTEM' && <span className={styles.systemTag}>시스템</span>}
                        {tab === 'inbox' ? msg.sender.nickname : msg.receiver.nickname}
                      </span>
                      <span className={styles.msgDate}>
                        {new Date(msg.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className={styles.msgPreview}>{msg.content}</p>
                  </div>
                  {isUnread && <div className={styles.dot} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* 본문 */}
        <div className={styles.contentPanel}>
          {selected ? (
            <div className={styles.msgContent}>
              <div className={styles.msgHeader}>
                <div className={styles.msgAvatarLg}>
                  {(tab === 'inbox' ? selected.sender : selected.receiver).nickname.charAt(0)}
                </div>
                <div>
                  <p className={styles.msgFromLg}>
                    {tab === 'inbox' ? selected.sender.nickname : selected.receiver.nickname}
                  </p>
                  <p className={styles.msgDateLg}>
                    {new Date(selected.createdAt).toLocaleString('ko-KR')}
                  </p>
                </div>
                {selected.type === 'SYSTEM' && (
                  <span className={styles.systemBadge}>시스템</span>
                )}
              </div>
              <div className={styles.msgBody}>
                <p>{selected.content}</p>
              </div>
            </div>
          ) : (
            <div className={styles.empty}>
              <p>쪽지를 선택하면 내용이 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeMessageModal
          onClose={() => setShowCompose(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['messages-sent'] })
          }}
        />
      )}
    </div>
  )
}
