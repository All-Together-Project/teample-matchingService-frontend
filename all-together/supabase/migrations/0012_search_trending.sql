-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 실시간 검색어 트렌딩
-- ─────────────────────────────────────────────────────────────────

-- 1) search_terms 테이블
create table if not exists public.search_terms (
  term text primary key,
  count int not null default 0,
  last_searched_at timestamptz not null default now()
);

create index if not exists search_terms_count_idx on public.search_terms (count desc, last_searched_at desc);

-- RLS: 누구나 조회·기록 가능 (트렌드는 공개 정보)
alter table public.search_terms enable row level security;

drop policy if exists search_terms_select on public.search_terms;
create policy search_terms_select on public.search_terms for select using (true);

-- INSERT/UPDATE 는 RPC 통해서만 — 직접 쓰기 막음 (어뷰즈 방지)

-- 2) 기록 RPC — 검색할 때마다 호출
create or replace function public.record_search(p_term text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text := lower(trim(p_term));
begin
  if norm = '' or length(norm) < 2 or length(norm) > 40 then
    return;   -- 너무 짧거나 길면 무시
  end if;

  insert into public.search_terms (term, count, last_searched_at)
  values (norm, 1, now())
  on conflict (term) do update
     set count = public.search_terms.count + 1,
         last_searched_at = now();
end;
$$;

grant execute on function public.record_search(text) to anon, authenticated;

-- 3) 트렌딩 RPC — 최근 7일 내 검색 + 카운트 가중치
create or replace function public.trending_searches(p_limit int default 10)
returns table (term text, count int)
language sql
stable
security invoker
set search_path = public
as $$
  select term, count
  from public.search_terms
  where last_searched_at > now() - interval '7 days'
  order by count desc, last_searched_at desc
  limit p_limit;
$$;

grant execute on function public.trending_searches(int) to anon, authenticated;
