import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import MainLayout from '@/components/layout/MainLayout'

// Pages
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/auth/LoginPage'
import SignupPage from '@/pages/auth/SignupPage'
import ProfileSetupPage from '@/pages/auth/ProfileSetupPage'
import CategoryPage from '@/pages/CategoryPage'
import ProjectListPage from '@/pages/project/ProjectListPage'
import ProjectDetailPage from '@/pages/project/ProjectDetailPage'
import ProjectCreatePage from '@/pages/project/ProjectCreatePage'
import ProjectEditPage from '@/pages/project/ProjectEditPage'
import MyPage from '@/pages/user/MyPage'
import MyEditPage from '@/pages/user/MyEditPage'
import UserProfilePage from '@/pages/user/UserProfilePage'
import ApplicationListPage from '@/pages/matching/ApplicationListPage'
import MessagePage from '@/pages/message/MessagePage'
import SearchPage from '@/pages/search/SearchPage'
import NotFoundPage from '@/pages/NotFoundPage'

function PrivateOutlet() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 인증 페이지 — 헤더 없음 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/profile" element={<ProfileSetupPage />} />

        {/* 메인 레이아웃 (헤더 공통) */}
        <Route element={<MainLayout />}>
          {/* 메인은 비로그인도 접근 가능 */}
          <Route path="/" element={<LandingPage />} />

          {/* 인증 필요 라우트 */}
          <Route element={<PrivateOutlet />}>
            <Route path="/:category/new" element={<ProjectCreatePage />} />
            <Route path="/:category" element={<CategoryPage />} />
            <Route path="/posts/:id" element={<ProjectDetailPage />} />
            <Route path="/posts/:id/edit" element={<ProjectEditPage />} />

            {/* 하위 호환 — 기존 /projects 경로 유지 */}
            <Route path="/projects" element={<ProjectListPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/projects/:id/edit" element={<ProjectEditPage />} />

            {/* 사용자 */}
            <Route path="/my" element={<MyPage />} />
            <Route path="/my/edit" element={<MyEditPage />} />
            <Route path="/users/:id" element={<UserProfilePage />} />
            <Route path="/applications" element={<ApplicationListPage />} />
            <Route path="/messages" element={<MessagePage />} />
            <Route path="/search" element={<SearchPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
