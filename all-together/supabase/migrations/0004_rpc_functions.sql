-- ─────────────────────────────────────────────────────────────────
-- AllTogether — RPC 함수
-- src/api/index.ts 에서 supabase.rpc(...) 호출하는 함수들
-- ─────────────────────────────────────────────────────────────────

-- Phase 1: 태그 매칭 기반 게시글 추천 (현재 로그인 사용자 기준)
create or replace function public.recommend_posts_for_user(p_limit int default 6)
returns setof public.posts
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return query
      select * from public.posts
      where status = 'RECRUITING'
      order by created_at desc
      limit p_limit;
    return;
  end if;

  return query
    select p.*
    from public.posts p
    left join public.post_tags pt on pt.post_id = p.id
    left join public.user_tags ut
           on ut.tag_id = pt.tag_id and ut.user_id = uid
    where p.status = 'RECRUITING' and p.author_id <> uid
    group by p.id
    order by count(ut.tag_id) desc, p.created_at desc
    limit p_limit;
end;
$$;

-- Phase 1: 게시글 작성자(리더)에게 — 태그 겹치는 후보 사용자 추천
create or replace function public.recommend_members_for_post(p_post_id bigint, p_limit int default 5)
returns setof public.users
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return query
    select u.*
    from public.users u
    join public.user_tags ut on ut.user_id = u.id
    where ut.tag_id in (select tag_id from public.post_tags where post_id = p_post_id)
      and u.id not in (select user_id from public.post_members where post_id = p_post_id)
      and u.id <> (select author_id from public.posts where id = p_post_id)
    group by u.id
    order by count(ut.tag_id) desc, u.temperature desc
    limit p_limit;
end;
$$;

-- Phase 4 임시 stub: pgvector 미도입 상태에선 ILIKE 키워드 매칭으로 폴백
create or replace function public.search_posts_semantic(p_query text, p_limit int default 20)
returns setof public.posts
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.posts
  where title ilike '%' || p_query || '%' or content ilike '%' || p_query || '%'
  order by created_at desc
  limit p_limit;
$$;

-- 사용자 리뷰 요약 (ReviewSummary)
create or replace function public.review_summary_for_user(p_user_id uuid)
returns json
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'userId', p_user_id,
    'totalReviews', (select count(*) from public.reviews where target_id = p_user_id),
    'averageOverall', coalesce((
      select avg(rs.score)::float
      from public.reviews r
      join public.review_scores rs on rs.review_id = r.id
      where r.target_id = p_user_id
    ), 0),
    'itemAverages', coalesce((
      select json_agg(json_build_object('itemName', ri.item_name, 'average', g.avg_score))
      from (
        select rs.item_id, avg(rs.score)::float as avg_score
        from public.reviews r
        join public.review_scores rs on rs.review_id = r.id
        where r.target_id = p_user_id
        group by rs.item_id
      ) g
      join public.review_items ri on ri.id = g.item_id
    ), '[]'::json),
    'recentComment', (
      select comment from public.reviews
      where target_id = p_user_id and comment is not null
      order by created_at desc
      limit 1
    )
  ) into result;
  return result;
end;
$$;
