import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  postApi,
  recommendApi,
  type RecommendedProject,
  type RecommendProjectsResult,
  type RecommendMembersResult,
} from '@/api'
import { TempBadge, StatusBadge } from '@/components/common/Badge'
import TagChip from '@/components/common/TagChip'
import Button from '@/components/common/Button'
import styles from './AIRecommendPanel.module.css'

type Mode = 'project' | 'member'

const CATEGORY_LABEL: Record<string, string> = {
  STUDY:     '스터디',
  PROJECT:   '프로젝트',
  MEETUP:    '모임',
  COMMUNITY: '커뮤니티',
}

export default function AIRecommendPanel() {
  const [mode, setMode] = useState<Mode>('project')
  const [prompt, setPrompt] = useState('')
  const [pickedPostId, setPickedPostId] = useState<number | null>(null)

  // 리더의 모집중 공고
  const { data: myPosts } = useQuery({
    queryKey: ['my-posts'],
    queryFn: () => postApi.getMyPosts(),
    enabled: mode === 'member',
  })
  const recruiting = (myPosts ?? []).filter(
    p => p.status === 'RECRUITING' && p.category !== 'COMMUNITY',
  )

  const projectMutation = useMutation({
    mutationFn: (q: string) => recommendApi.recommendProjects(q),
  })
  const memberMutation = useMutation({
    mutationFn: ({ postId, q }: { postId: number; q: string }) =>
      recommendApi.recommendMembers(postId, q),
  })

  const isLoading = projectMutation.isPending || memberMutation.isPending
  const error =
    (projectMutation.error instanceof Error && projectMutation.error.message) ||
    (memberMutation.error instanceof Error && memberMutation.error.message) ||
    null

  const projectResults = projectMutation.data ?? null
  const memberResults  = memberMutation.data ?? null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = prompt.trim()
    if (!q) return
    if (mode === 'project') {
      projectMutation.mutate(q)
    } else {
      if (!pickedPostId) {
        alert('어떤 모집 공고의 팀원을 찾을지 먼저 선택해주세요.')
        return
      }
      memberMutation.mutate({ postId: pickedPostId, q })
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    projectMutation.reset()
    memberMutation.reset()
  }

  return (
    <div className={styles.panel}>
      <div className={styles.modeTabs}>
        <button
          type="button"
          className={`${styles.modeTab} ${mode === 'project' ? styles.active : ''}`}
          onClick={() => switchMode('project')}
        >
          ✨ 프로젝트 추천
        </button>
        <button
          type="button"
          className={`${styles.modeTab} ${mode === 'member' ? styles.active : ''}`}
          onClick={() => switchMode('member')}
        >
          👥 팀원 추천 <span className={styles.leaderBadge}>리더 전용</span>
        </button>
      </div>

      {mode === 'member' && (
        <div className={styles.postPicker}>
          <label className={styles.pickerLabel}>어떤 모집 공고의 팀원을 찾을까요?</label>
          {recruiting.length === 0 ? (
            <p className={styles.empty}>모집중인 공고가 없습니다. 새 공고를 등록해주세요.</p>
          ) : (
            <select
              className={styles.pickerSelect}
              value={pickedPostId ?? ''}
              onChange={e => setPickedPostId(Number(e.target.value) || null)}
            >
              <option value="">선택...</option>
              {recruiting.map(p => (
                <option key={p.id} value={p.id}>
                  [{CATEGORY_LABEL[p.category]}] {p.title}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <form className={styles.promptForm} onSubmit={handleSubmit}>
        <textarea
          className={styles.promptInput}
          rows={2}
          placeholder={
            mode === 'project'
              ? '예: "프론트엔드 사이드 프로젝트 같이 할 사람", "정처기 같이 공부하는 모임"'
              : '예: "React 1년 이상, TypeScript 능숙한 사람", "디자인 감각 있는 PM"'
          }
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          disabled={isLoading}
        />
        <Button type="submit" disabled={!prompt.trim() || isLoading} loading={isLoading}>
          AI 추천 받기
        </Button>
      </form>

      {error && <p className={styles.error}>오류: {error}</p>}

      {/* 결과 */}
      {mode === 'project' && projectResults && (
        <ProjectResultsView results={projectResults} />
      )}
      {mode === 'member' && memberResults && (
        <MemberResultsView results={memberResults} />
      )}
    </div>
  )
}

function ProjectResultsView({ results }: { results: RecommendProjectsResult }) {
  const { primary, related, primaryIntro, relatedIntro } = results
  if (primary.length === 0 && related.length === 0) {
    return <p className={styles.empty}>요청에 맞는 게시글을 찾지 못했어요. 다른 표현으로 시도해보세요.</p>
  }
  return (
    <div className={styles.resultGroups}>
      {primary.length > 0 && (
        <section className={styles.resultSection}>
          <header className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>✨ 주 추천</h3>
            {primaryIntro && <p className={styles.sectionIntro}>{primaryIntro}</p>}
          </header>
          <div className={styles.resultGrid}>
            {primary.map(r => <ProjectCard key={r.id} r={r} />)}
          </div>
        </section>
      )}
      {related.length > 0 && (
        <section className={styles.resultSection}>
          <header className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>🔍 추가 추천</h3>
            {relatedIntro && <p className={styles.sectionIntro}>{relatedIntro}</p>}
          </header>
          <div className={styles.resultGrid}>
            {related.map(r => <ProjectCard key={r.id} r={r} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function ProjectCard({ r }: { r: RecommendedProject }) {
  return (
    <Link to={`/posts/${r.id}`} className={styles.resultCard}>
      <div className={styles.cardTop}>
        <StatusBadge status={r.status as any} />
        <span className={styles.cat}>{CATEGORY_LABEL[r.category]} · {r.subCategory}</span>
        <span className={styles.similarity}>{Math.round(r.similarity * 100)}% 일치</span>
      </div>
      <h3 className={styles.cardTitle}>{r.title}</h3>
      {r.reason && (
        <p className={styles.reason}>
          <span className={styles.reasonIcon}>✨</span>{r.reason}
        </p>
      )}
      <div className={styles.cardTags}>
        {r.tags?.slice(0, 4).map(t => <TagChip key={t.id} tag={t} size="sm" />)}
      </div>
      <div className={styles.cardFooter}>
        <span>{r.author?.nickname ?? '익명'}</span>
        {r.capacity != null && <span>{r.currentMemberCount}/{r.capacity}명</span>}
      </div>
    </Link>
  )
}

function MemberResultsView({ results }: { results: RecommendMembersResult }) {
  const { intro, results: members } = results
  if (members.length === 0) {
    return <p className={styles.empty}>조건에 맞는 사용자를 찾지 못했어요.</p>
  }
  return (
    <div className={styles.resultSection}>
      {intro && (
        <header className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>👥 추천 후보 분석</h3>
          <p className={styles.sectionIntro}>{intro}</p>
        </header>
      )}
      <div className={styles.memberGrid}>
      {members.map(m => (
        <Link to={`/users/${m.id}`} key={m.id} className={styles.memberCard}>
          <div className={styles.memberHead}>
            <div className={styles.memberAvatar}>
              {m.profileUrl
                ? <img src={m.profileUrl} alt={m.nickname} />
                : <span>{m.nickname.charAt(0)}</span>
              }
            </div>
            <div className={styles.memberInfo}>
              <p className={styles.memberName}>{m.nickname}</p>
              <TempBadge value={m.temperature} />
            </div>
            {m.tagOverlap > 0 && (
              <span className={styles.overlapBadge}>겹치는 태그 {m.tagOverlap}개</span>
            )}
          </div>
          {m.introduction && <p className={styles.memberBio}>{m.introduction}</p>}
          {m.reason && (
            <p className={styles.reason}>
              <span className={styles.reasonIcon}>✨</span>{m.reason}
            </p>
          )}
          <div className={styles.cardTags}>
            {m.tags?.slice(0, 5).map(t => <TagChip key={t.id} tag={t} size="sm" />)}
          </div>
        </Link>
      ))}
      </div>
    </div>
  )
}
