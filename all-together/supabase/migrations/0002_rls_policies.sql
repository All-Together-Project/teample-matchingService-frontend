-- ─────────────────────────────────────────────────────────────────
-- AllTogether — RLS (Row Level Security) 정책
-- 모든 테이블에 RLS 활성화 + 정책 정의
-- ─────────────────────────────────────────────────────────────────

alter table public.users          enable row level security;
alter table public.tags           enable row level security;
alter table public.user_tags      enable row level security;
alter table public.posts          enable row level security;
alter table public.post_tags      enable row level security;
alter table public.post_members   enable row level security;
alter table public.applications   enable row level security;
alter table public.comments       enable row level security;
alter table public.review_items   enable row level security;
alter table public.reviews        enable row level security;
alter table public.review_scores  enable row level security;
alter table public.messages       enable row level security;

-- users: 누구나 프로필 조회 / 본인만 수정
drop policy if exists users_select_all   on public.users;
drop policy if exists users_insert_self  on public.users;
drop policy if exists users_update_self  on public.users;
create policy users_select_all  on public.users for select using (true);
create policy users_insert_self on public.users for insert with check (id = auth.uid());
create policy users_update_self on public.users for update using (id = auth.uid());

-- tags: 누구나 조회 (관리자만 추가 — 클라이언트는 insert 불가)
drop policy if exists tags_select_all on public.tags;
create policy tags_select_all on public.tags for select using (true);

-- user_tags: 누구나 조회 / 본인만 변경
drop policy if exists user_tags_select_all  on public.user_tags;
drop policy if exists user_tags_modify_self on public.user_tags;
create policy user_tags_select_all  on public.user_tags for select using (true);
create policy user_tags_modify_self on public.user_tags for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- posts: 누구나 조회 / 작성자만 변경
drop policy if exists posts_select_all      on public.posts;
drop policy if exists posts_insert_self     on public.posts;
drop policy if exists posts_update_author   on public.posts;
drop policy if exists posts_delete_author   on public.posts;
create policy posts_select_all    on public.posts for select using (true);
create policy posts_insert_self   on public.posts for insert with check (author_id = auth.uid());
create policy posts_update_author on public.posts for update using (author_id = auth.uid());
create policy posts_delete_author on public.posts for delete using (author_id = auth.uid());

-- post_tags: 누구나 조회 / 게시글 작성자만 변경
drop policy if exists post_tags_select_all     on public.post_tags;
drop policy if exists post_tags_modify_author  on public.post_tags;
create policy post_tags_select_all    on public.post_tags for select using (true);
create policy post_tags_modify_author on public.post_tags for all
  using      (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- post_members: 누구나 조회 / 게시글 작성자만 변경
drop policy if exists post_members_select_all    on public.post_members;
drop policy if exists post_members_modify_author on public.post_members;
create policy post_members_select_all    on public.post_members for select using (true);
create policy post_members_modify_author on public.post_members for all
  using      (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- applications: 지원자 + 게시글 작성자만 조회 / 지원자가 insert / 작성자가 status 업데이트
drop policy if exists applications_select         on public.applications;
drop policy if exists applications_insert_self    on public.applications;
drop policy if exists applications_update_author  on public.applications;
create policy applications_select on public.applications for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );
create policy applications_insert_self on public.applications for insert
  with check (user_id = auth.uid());
create policy applications_update_author on public.applications for update
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- comments: 누구나 조회 / 본인만 변경
drop policy if exists comments_select_all   on public.comments;
drop policy if exists comments_insert_self  on public.comments;
drop policy if exists comments_update_self  on public.comments;
drop policy if exists comments_delete_self  on public.comments;
create policy comments_select_all  on public.comments for select using (true);
create policy comments_insert_self on public.comments for insert with check (user_id = auth.uid());
create policy comments_update_self on public.comments for update using (user_id = auth.uid());
create policy comments_delete_self on public.comments for delete using (user_id = auth.uid());

-- review_items: 누구나 조회만
drop policy if exists review_items_select on public.review_items;
create policy review_items_select on public.review_items for select using (true);

-- reviews: 누구나 조회 / 본인이 평가자일 때만 insert
drop policy if exists reviews_select_all  on public.reviews;
drop policy if exists reviews_insert_self on public.reviews;
create policy reviews_select_all  on public.reviews for select using (true);
create policy reviews_insert_self on public.reviews for insert with check (evaluator_id = auth.uid());

-- review_scores: 누구나 조회 / 평가자 본인만 insert
drop policy if exists review_scores_select_all on public.review_scores;
drop policy if exists review_scores_insert     on public.review_scores;
create policy review_scores_select_all on public.review_scores for select using (true);
create policy review_scores_insert     on public.review_scores for insert
  with check (exists (select 1 from public.reviews r where r.id = review_id and r.evaluator_id = auth.uid()));

-- messages: 송수신 당사자만 조회 / 본인만 발송 / 수신자만 read 처리
drop policy if exists messages_select          on public.messages;
drop policy if exists messages_insert_self     on public.messages;
drop policy if exists messages_update_receiver on public.messages;
create policy messages_select on public.messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy messages_insert_self on public.messages for insert with check (sender_id = auth.uid());
create policy messages_update_receiver on public.messages for update using (receiver_id = auth.uid());
