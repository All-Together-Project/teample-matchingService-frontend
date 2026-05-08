-- ─────────────────────────────────────────────────────────────────
-- AllTogether — pgvector 의미 검색
--   * posts.embedding 컬럼 (768차원 — Gemini text-embedding-004)
--   * match_posts(query_embedding, ...) 코사인 유사도 검색 RPC
--   * 임베딩 누락 게시글 조회 view (백필용)
--
-- 적용 후:
--   1) Supabase Edge Function 두 개 배포 (embed-post, semantic-search)
--   2) GEMINI_API_KEY 시크릿 등록
--   3) 백필 스크립트로 기존 게시글 임베딩 생성
-- ─────────────────────────────────────────────────────────────────

-- 1) pgvector 확장
create extension if not exists vector;

-- 2) embedding 컬럼 — Gemini text-embedding-004 = 768 dim
alter table public.posts
  add column if not exists embedding vector(768);

-- 3) IVFFlat 인덱스 (코사인 거리 기준)
--    데이터 100건 미만에선 큰 의미 없지만 미리 만들어둠.
--    lists는 데이터 양에 따라 sqrt(rows) 정도가 권장값.
drop index if exists posts_embedding_idx;
create index posts_embedding_idx
  on public.posts
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- 4) 의미 검색 RPC
--    필터(category, status, sub_category)를 선택적으로 적용
--    similarity = 1 - cosine_distance (1에 가까울수록 유사)
create or replace function public.match_posts(
  query_embedding vector(768),
  match_count int default 12,
  match_threshold float default 0.0,
  filter_category text default null,
  filter_status text default null,
  filter_sub_category text default null
)
returns table (
  id bigint,
  category text,
  sub_category text,
  title text,
  content text,
  capacity int,
  current_member_count int,
  status text,
  period text,
  deadline timestamptz,
  author_id uuid,
  created_at timestamptz,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.category, p.sub_category, p.title, p.content,
    p.capacity, p.current_member_count, p.status,
    p.period, p.deadline, p.author_id, p.created_at,
    (1 - (p.embedding <=> query_embedding))::float as similarity
  from public.posts p
  where p.embedding is not null
    and (filter_category is null     or p.category = filter_category)
    and (filter_status is null       or p.status = filter_status)
    and (filter_sub_category is null or p.sub_category = filter_sub_category)
    and (1 - (p.embedding <=> query_embedding)) >= match_threshold
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_posts(vector, int, float, text, text, text) to authenticated, anon;

-- 5) 백필용 — 임베딩 없는 게시글 ID 조회
create or replace view public.posts_missing_embedding as
  select id, title, content, category, sub_category
  from public.posts
  where embedding is null
  order by id;

grant select on public.posts_missing_embedding to authenticated;
