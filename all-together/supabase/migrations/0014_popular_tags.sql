-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 인기 태그 RPC (태그가 게시글에 사용된 횟수 기준)
-- ─────────────────────────────────────────────────────────────────

create or replace function public.popular_tags(p_limit int default 12)
returns table (id bigint, name text, category text, usage int)
language sql
stable
security invoker
set search_path = public
as $$
  select t.id, t.name, t.category, count(pt.post_id)::int as usage
  from public.tags t
  left join public.post_tags pt on pt.tag_id = t.id
  group by t.id, t.name, t.category
  order by usage desc, t.id
  limit p_limit;
$$;

grant execute on function public.popular_tags(int) to anon, authenticated;
