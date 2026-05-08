-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 매너 온도 자동 갱신 RPC
-- 리뷰 생성 후 호출. 평균 점수에 따라 target.temperature 가감
--   delta = (avg_score - 3.0) * 0.5
--   범위 클램프: [0, 99.9]
-- ─────────────────────────────────────────────────────────────────

create or replace function public.apply_review_temperature(p_review_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  avg_score numeric;
  delta numeric;
begin
  select r.target_id, avg(rs.score)::numeric
    into target, avg_score
  from public.reviews r
  join public.review_scores rs on rs.review_id = r.id
  where r.id = p_review_id
  group by r.target_id;

  if target is null or avg_score is null then return; end if;

  delta := (avg_score - 3.0) * 0.5;

  update public.users
     set temperature = greatest(0, least(99.9, temperature + delta))
   where id = target;
end;
$$;

-- 누구나 자기 리뷰 작성 후 호출 가능 (RLS는 reviews/review_scores INSERT 정책에서 제어)
grant execute on function public.apply_review_temperature(bigint) to authenticated;
