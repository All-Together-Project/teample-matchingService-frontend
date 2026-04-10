import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { authApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/common/Button'
import styles from './AuthPage.module.css'

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(8, '8자 이상 입력해주세요'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError('')
    try {
      const res = await authApi.login(data)
      const { accessToken, refreshToken } = res.data.data
      const meRes = await authApi.me()
      setAuth(meRes.data.data, accessToken, refreshToken)
      navigate('/projects')
    } catch (e: any) {
      setError(e.response?.data?.message ?? '이메일 또는 비밀번호를 확인해주세요')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.logo}>ALL<span>투게더</span></Link>
        <h1 className={styles.title}>로그인</h1>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.field}>
            <label>이메일</label>
            <input type="email" placeholder="이메일 주소" {...register('email')} />
            {errors.email && <p className={styles.err}>{errors.email.message}</p>}
          </div>
          <div className={styles.field}>
            <label>비밀번호</label>
            <input type="password" placeholder="비밀번호" {...register('password')} />
            {errors.password && <p className={styles.err}>{errors.password.message}</p>}
          </div>

          {error && <p className={styles.errBox}>{error}</p>}

          <Button type="submit" fullWidth loading={isSubmitting} size="lg">
            로그인
          </Button>
        </form>

        <p className={styles.footer}>
          계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>
      </div>
    </div>
  )
}
