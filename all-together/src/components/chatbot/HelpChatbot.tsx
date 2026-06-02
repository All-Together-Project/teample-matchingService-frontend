import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { chatApi, type ChatTurn } from '@/api'
import styles from './HelpChatbot.module.css'

type Message = { role: 'user' | 'model'; text: string }

const INTRO: Message = {
  role: 'model',
  text: '안녕하세요! AllTogether 챗봇이에요 🤝\n지금 보시는 페이지나 서비스 사용법에 대해 궁금한 점을 편하게 물어보세요.',
}

export default function HelpChatbot() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INTRO])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const ask = useMutation({
    mutationFn: (msg: string) =>
      chatApi.ask({
        message: msg,
        route: location.pathname,
        history: messages
          .filter((m): m is Message => m.role === 'user' || m.role === 'model')
          .slice(-10) as ChatTurn[],
      }),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: 'model', text: data.reply }])
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text:
            err instanceof Error
              ? `죄송해요, 응답 중 문제가 생겼어요. (${err.message})`
              : '죄송해요, 응답 중 문제가 생겼어요.',
        },
      ])
    },
  })

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open, ask.isPending])

  const send = () => {
    const text = input.trim()
    if (!text || ask.isPending) return
    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    ask.mutate(text)
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => setOpen(true)}
          aria-label="AllTogether 챗봇 열기"
        >
          <span className={styles.fabIcon}>💬</span>
          <span className={styles.fabLabel}>AllTogether 챗봇에게 도움 요청하기</span>
        </button>
      )}

      {open && (
        <div className={styles.panel} role="dialog" aria-label="AllTogether 챗봇">
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span className={styles.headerEmoji}>🤝</span>
              <div>
                <div className={styles.headerName}>AllTogether 챗봇</div>
                <div className={styles.headerHint}>현재 페이지를 보고 안내해 드려요</div>
              </div>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          <div className={styles.body} ref={scrollRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.botBubble}`}
              >
                {m.text}
              </div>
            ))}
            {ask.isPending && (
              <div className={`${styles.bubble} ${styles.botBubble} ${styles.typing}`}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            )}
          </div>

          <form
            className={styles.inputRow}
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              type="text"
              className={styles.input}
              placeholder="궁금한 점을 입력해 주세요"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={ask.isPending}
              maxLength={500}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim() || ask.isPending}
              aria-label="보내기"
            >
              ▶
            </button>
          </form>
        </div>
      )}
    </>
  )
}
