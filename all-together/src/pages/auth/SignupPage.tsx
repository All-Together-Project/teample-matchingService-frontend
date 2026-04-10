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
  name: z.string().min(2, '이름은 2자 이상 입력해주세요'),
  nickname: z.string().min(2, '닉네임은 2자 이상 입력해주세요'),
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(8, '8자 이상, 영문+숫자+특수문자 포함').regex(
    /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
    '영문, 숫자, 특수문자를 모두 포함해주세요'
  ),
  passwordConfirm: z.string(),
  agreeTerms: z.boolean().refine(Boolean, '이용약관에 동의해주세요'),
}).refine(d => d.password === d.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['passwordConfirm'],
})
type FormData = z.infer<typeof schema>

export default function SignupPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError('')
    try {
      await authApi.signup({ name: data.name, nickname: data.nickname, email: data.email, password: data.password })
      const loginRes = await authApi.login({ email: data.email, password: data.password })
      const { accessToken, refreshToken } = loginRes.data.data
      const meRes = await authApi.me()
      setAuth(meRes.data.data, accessToken, refreshToken)
      navigate('/signup/profile')
    } catch (e: any) {
      setError(e.response?.data?.message ?? '회원가입 중 오류가 발생했습니다')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.logo}>ALL<span>투게더</span></Link>
        <h1 className={styles.title}>회원가입</h1>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.row2}>
            <div className={styles.field}>
              <label>이름</label>
              <input placeholder="실명" {...register('name')} />
              {errors.name && <p className={styles.err}>{errors.name.message}</p>}
            </div>
            <div className={styles.field}>
              <label>닉네임</label>
              <input placeholder="활동명" {...register('nickname')} />
              {errors.nickname && <p className={styles.err}>{errors.nickname.message}</p>}
            </div>
          </div>
          <div className={styles.field}>
            <label>이메일</label>
            <input type="email" placeholder="이메일 주소" {...register('email')} />
            {errors.email && <p className={styles.err}>{errors.email.message}</p>}
          </div>
          <div className={styles.field}>
            <label>비밀번호</label>
            <input type="password" placeholder="8자 이상, 영문+숫자+특수문자" {...register('password')} />
            {errors.password && <p className={styles.err}>{errors.password.message}</p>}
          </div>
          <div className={styles.field}>
            <label>비밀번호 확인</label>
            <input type="password" placeholder="비밀번호 재입력" {...register('passwordConfirm')} />
            {errors.passwordConfirm && <p className={styles.err}>{errors.passwordConfirm.message}</p>}
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" {...register('agreeTerms')} />
            <span><Link to="/terms">이용약관</Link> 및 <Link to="/privacy">개인정보처리방침</Link>에 동의합니다 (필수)</span>
          </label>
          {errors.agreeTerms && <p className={styles.err}>{errors.agreeTerms.message}</p>}

          {error && <p className={styles.errBox}>{error}</p>}

          <Button type="submit" fullWidth loading={isSubmitting} size="lg">
            가입하기
          </Button>
        </form>

        <p className={styles.footer}>
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  )
}
