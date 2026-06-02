-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 실시간 검색어 자정 초기화 (pg_cron)
--   매일 00:00 KST (15:00 UTC) 에 search_terms 테이블을 truncate.
--   사용자 검색 누적이 매일 0 부터 다시 쌓이도록.
-- ─────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;

-- 1) 초기화 함수
create or replace function public.reset_trending_searches()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.search_terms restart identity;
end;
$$;

revoke all on function public.reset_trending_searches() from public;

-- 2) 기존 스케줄 제거 후 재등록 (idempotent)
do $$
begin
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'reset-trending-searches';
exception when others then
  -- pg_cron 미설치 또는 권한 부족 시 무시
  null;
end $$;

select cron.schedule(
  'reset-trending-searches',
  '0 15 * * *',                              -- 매일 15:00 UTC = 00:00 KST
  $$ select public.reset_trending_searches(); $$
);

-- 3) trending_searches RPC 재정의 — 윈도우 필터 제거
--    매일 자정에 데이터가 truncate 되므로 남아있는 모든 행이 곧 "오늘 검색".
--    p_window_hours 파라미터는 호환성 유지용 (값은 무시).
drop function if exists public.trending_searches(int, int);

create or replace function public.trending_searches(
  p_limit int default 10,
  p_window_hours int default 24
)
returns table (term text, count int)
language sql
stable
security invoker
set search_path = public
as $$
  select term, count
  from public.search_terms
  order by count desc, last_searched_at desc
  limit p_limit;
$$;

grant execute on function public.trending_searches(int, int) to anon, authenticated;
