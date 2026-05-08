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
      const me = await authApi.me()
      if (!me) throw new Error('PROFILE_NOT_FOUND')
      setAuth(me, res.session?.access_token ?? '')
      navigate('/study')
    } catch (e: any) {
      setError(e.message ?? '이메일 또는 비밀번호를 확인해주세요')
    }
  }

  return (
    <div className={styles.splitPage}>
      <div className={styles.splitLeft}>
        <Link to="/" className={styles.logo}>🤝 AllTogether</Link>
        <h1 className={styles.splitTitle}>AllTogether!</h1>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.field}>
            <label>아이디</label>
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
          아직 계정이 없다면? <Link to="/signup">회원가입</Link>
        </p>
      </div>
      <div className={styles.splitRight}>
        <div className={styles.placeholder}>
          캐릭터 or 로고
        </div>
      </div>
    </div>
  )
}
