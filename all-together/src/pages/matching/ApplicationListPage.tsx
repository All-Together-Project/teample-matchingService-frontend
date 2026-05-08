import { useState } from 'react'
import MyApplications from '@/components/matching/MyApplications'
import ReceivedApplications from '@/components/matching/ReceivedApplications'
import styles from './ApplicationListPage.module.css'

export default function ApplicationListPage() {
  const [tab, setTab] = useState<'mine' | 'received'>('mine')

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>지원 내역</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'mine' ? styles.active : ''}`}
          onClick={() => setTab('mine')}
        >
          내가 지원한 공고
        </button>
        <button
          className={`${styles.tab} ${tab === 'received' ? styles.active : ''}`}
          onClick={() => setTab('received')}
        >
          받은 지원서 관리
        </button>
      </div>

      {tab === 'mine' ? <MyApplications /> : <ReceivedApplications />}
    </div>
  )
}
