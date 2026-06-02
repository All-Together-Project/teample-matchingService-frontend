-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 트렌딩 검색어 윈도우 파라미터 추가
--   기본 윈도우를 7일 → 1시간으로 변경
--   호출자가 p_window_hours 를 명시하면 임의 윈도우 사용 가능 (예: 168 = 일주일)
-- ─────────────────────────────────────────────────────────────────

drop function if exists public.trending_searches(int);

create or replace function public.trending_searches(
  p_limit int default 10,
  p_window_hours int default 1
)
returns table (term text, count int)
language sql
stable
security invoker
set search_path = public
as $$
  select term, count
  from public.search_terms
  where last_searched_at > now() - make_interval(hours => greatest(p_window_hours, 1))
  order by count desc, last_searched_at desc
  limit p_limit;
$$;

grant execute on function public.trending_searches(int, int) to anon, authenticated;
