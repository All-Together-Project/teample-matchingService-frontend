import { Outlet } from 'react-router-dom'
import Header from './Header'
import HelpChatbot from '@/components/chatbot/HelpChatbot'
import styles from './MainLayout.module.css'

export default function MainLayout() {
  return (
    <div className={styles.wrap}>
      <Header />
      <main className={styles.main}>
        <div className="container">
          <Outlet />
        </div>
      </main>
      <HelpChatbot />
    </div>
  )
}
