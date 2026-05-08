-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 프로젝트 자체 리뷰
--   FINISHED 상태 게시글에 멤버(작성자 제외)가 1번씩 프로젝트 리뷰 작성
--   카테고리(STUDY/PROJECT/MEETUP)별 평가 항목 다름
-- ─────────────────────────────────────────────────────────────────

-- ─── 1) 평가 항목 템플릿 ──────────────────────────────────────────
create table if not exists public.project_review_items (
  id bigserial primary key,
  category text not null check (category in ('STUDY','PROJECT','MEETUP')),
  item_name text not null,
  sort_order int not null default 0,
  unique (category, item_name)
);

-- ─── 2) 프로젝트 리뷰 본체 ───────────────────────────────────────
create table if not exists public.project_reviews (
  id bigserial primary key,
  post_id      bigint not null references public.posts(id) on delete cascade,
  evaluator_id uuid   not null references public.users(id) on delete cascade,
  comment text,
  created_at timestamptz not null default now(),
  unique (post_id, evaluator_id)        -- 1인 1리뷰
);
create index if not exists project_reviews_post_idx       on public.project_reviews(post_id);
create index if not exists project_reviews_evaluator_idx  on public.project_reviews(evaluator_id);

create table if not exists public.project_review_scores (
  id bigserial primary key,
  review_id bigint not null references public.project_reviews(id) on delete cascade,
  item_id   bigint not null references public.project_review_items(id) on delete restrict,
  score int not null check (score between 1 and 5),
  unique (review_id, item_id)
);

-- ─── 3) Seed (카테고리별 5개 항목) ───────────────────────────────
insert into public.project_review_items (category, item_name, sort_order) values
  -- PROJECT
  ('PROJECT', '진행도/완성도',     1),
  ('PROJECT', '의사소통/분위기',   2),
  ('PROJECT', '일정 준수',         3),
  ('PROJECT', '목표 달성도',       4),
  ('PROJECT', '재참여 의향',       5),
  -- STUDY
  ('STUDY',   '학습 효과',         1),
  ('STUDY',   '분위기/소통',       2),
  ('STUDY',   '일정 준수',         3),
  ('STUDY',   '진행 방식 만족도',  4),
  ('STUDY',   '재참여 의향',       5),
  -- MEETUP
  ('MEETUP',  '분위기/소통',       1),
  ('MEETUP',  '시간 약속',         2),
  ('MEETUP',  '운영의 매끄러움',   3),
  ('MEETUP',  '만남의 가치',       4),
  ('MEETUP',  '재참여 의향',       5)
on conflict (category, item_name) do update set sort_order = excluded.sort_order;

-- ─── 4) RLS ───────────────────────────────────────────────────────
alter table public.project_review_items   enable row level security;
alter table public.project_reviews        enable row level security;
alter table public.project_review_scores  enable row level security;

drop policy if exists project_review_items_select on public.project_review_items;
create policy project_review_items_select on public.project_review_items for select using (true);

drop policy if exists project_reviews_select_all      on public.project_reviews;
drop policy if exists project_reviews_insert_member   on public.project_reviews;
create policy project_reviews_select_all on public.project_reviews for select using (true);

-- 멤버만 작성 가능, 작성자(리더) 본인은 자기 프로젝트에 리뷰 불가, FINISHED 상태에서만
create policy project_reviews_insert_member on public.project_reviews for insert
  with check (
    evaluator_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = project_reviews.post_id
        and p.status = 'FINISHED'
        and p.author_id <> auth.uid()
    )
    and exists (
      select 1 from public.post_members pm
      where pm.post_id = project_reviews.post_id
        and pm.user_id = auth.uid()
    )
  );

drop policy if exists project_review_scores_select on public.project_review_scores;
drop policy if exists project_review_scores_insert on public.project_review_scores;
create policy project_review_scores_select on public.project_review_scores for select using (true);
create policy project_review_scores_insert on public.project_review_scores for insert
  with check (
    exists (
      select 1 from public.project_reviews r
      where r.id = review_id and r.evaluator_id = auth.uid()
    )
  );

-- ─── 5) RPC: 게시글 단위 요약 (디테일 페이지용) ──────────────────
create or replace function public.project_review_summary_for_post(p_post_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with avg_per_review as (
    select r.id as review_id, avg(rs.score)::numeric as avg_score
    from public.project_reviews r
    join public.project_review_scores rs on rs.review_id = r.id
    where r.post_id = p_post_id
    group by r.id
  ),
  item_avgs as (
    select pri.item_name, pri.sort_order, round(avg(rs.score)::numeric, 2) as avg
    from public.project_reviews r
    join public.project_review_scores rs on rs.review_id = r.id
    join public.project_review_items pri on pri.id = rs.item_id
    where r.post_id = p_post_id
    group by pri.item_name, pri.sort_order
  )
  select jsonb_build_object(
    'totalReviews',    (select count(*)::int from public.project_reviews where post_id = p_post_id),
    'averageOverall',  (select coalesce(round(avg(avg_score)::numeric, 2), 0) from avg_per_review),
    'itemAverages',    (
      select coalesce(
        jsonb_agg(jsonb_build_object('itemName', item_name, 'average', avg) order by sort_order),
        '[]'::jsonb
      ) from item_avgs
    )
  );
$$;

grant execute on function public.project_review_summary_for_post(bigint) to authenticated, anon;

-- ─── 6) RPC: 리더 단위 요약 (마이페이지/프로필용) ────────────────
-- 특정 유저가 작성한 (FINISHED) 프로젝트들의 리뷰 합계
create or replace function public.leader_project_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with hosted as (
    select id, status from public.posts
    where author_id = p_user_id
      and category in ('STUDY','PROJECT','MEETUP')
  ),
  finished as (
    select id from hosted where status = 'FINISHED'
  ),
  reviews_all as (
    select r.id, rs.score, pri.item_name, pri.sort_order
    from public.project_reviews r
    join public.project_review_scores rs on rs.review_id = r.id
    join public.project_review_items pri on pri.id = rs.item_id
    where r.post_id in (select id from finished)
  ),
  per_review as (
    select id, avg(score)::numeric as avg_score
    from reviews_all
    group by id
  ),
  item_avgs as (
    select item_name, sort_order, round(avg(score)::numeric, 2) as avg
    from reviews_all
    group by item_name, sort_order
  )
  select jsonb_build_object(
    'hostedCount',     (select count(*)::int from hosted),
    'finishedCount',   (select count(*)::int from finished),
    'reviewCount',     (select count(*)::int from per_review),
    'averageOverall',  (select coalesce(round(avg(avg_score)::numeric, 2), 0) from per_review),
    'itemAverages',    (
      select coalesce(
        jsonb_agg(jsonb_build_object('itemName', item_name, 'average', avg) order by sort_order),
        '[]'::jsonb
      ) from item_avgs
    )
  );
$$;

grant execute on function public.leader_project_summary(uuid) to authenticated, anon;
