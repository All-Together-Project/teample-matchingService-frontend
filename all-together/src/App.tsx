import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import MainLayout from '@/components/layout/MainLayout'

// Pages
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import ProfileSetupPage from '@/pages/auth/ProfileSetupPage'
import ProjectListPage from '@/pages/project/ProjectListPage'
import ProjectDetailPage from '@/pages/project/ProjectDetailPage'
import ProjectCreatePage from '@/pages/project/ProjectCreatePage'
import ProjectEditPage from '@/pages/project/ProjectEditPage'
import MyPage from '@/pages/user/MyPage'
import UserProfilePage from '@/pages/user/UserProfilePage'
import ApplicationListPage from '@/pages/matching/ApplicationListPage'
import MessagePage from '@/pages/message/MessagePage'
import SearchPage from '@/pages/search/SearchPage'
import NotFoundPage from '@/pages/NotFoundPage'

// 인증 필요 라우트 가드
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 라우트 */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/profile" element={<ProfileSetupPage />} />

        {/* 인증 필요 라우트 — MainLayout 내부 */}
        <Route
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/projects/new" element={<ProjectCreatePage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects/:id/edit" element={<ProjectEditPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="/users/:id" element={<UserProfilePage />} />
          <Route path="/applications" element={<ApplicationListPage />} />
          <Route path="/messages" element={<MessagePage />} />
          <Route path="/search" element={<SearchPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
