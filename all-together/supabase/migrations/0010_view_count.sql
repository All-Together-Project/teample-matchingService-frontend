-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 게시글 조회수 + 인기 정렬
-- ─────────────────────────────────────────────────────────────────

-- 1) view_count 컬럼 추가
alter table public.posts
  add column if not exists view_count int not null default 0;

create index if not exists posts_view_count_idx on public.posts (view_count desc);

-- 2) 조회수 1 증가 RPC — 클라이언트에서 게시글 상세 진입 시 호출
create or replace function public.increment_post_view(p_post_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts set view_count = view_count + 1 where id = p_post_id;
$$;

grant execute on function public.increment_post_view(bigint) to anon, authenticated;

-- 3) 인기 게시글 RPC — 조회수 + 신선도 가중치
-- 점수 = view_count * 1.0 + (created_at 최근 7일 안이면 보너스)
create or replace function public.popular_posts(p_limit int default 8)
returns setof public.posts
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.posts
  where status = 'RECRUITING'
  order by
    view_count desc,
    created_at desc
  limit p_limit;
$$;

grant execute on function public.popular_posts(int) to anon, authenticated;
