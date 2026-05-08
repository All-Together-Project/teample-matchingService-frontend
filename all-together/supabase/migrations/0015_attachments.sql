-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 첨부파일 (Storage + DB)
--
--   * post-files (public bucket)        — 게시글 첨부 (방향성 문서, 이미지 등)
--   * application-files (private bucket) — 지원서 첨부 (자기소개서, 스펙, 이미지 등)
--
-- 적용: Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────

-- ─── 1) Storage Buckets ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('post-files',        'post-files',        true),
  ('application-files', 'application-files', false)
on conflict (id) do nothing;

-- ─── 2) Tables ─────────────────────────────────────────────────────
create table if not exists public.post_attachments (
  id bigserial primary key,
  post_id     bigint not null references public.posts(id) on delete cascade,
  uploader_id uuid   not null references public.users(id) on delete cascade,
  file_name   text   not null,
  file_path   text   not null,        -- storage 내 경로 (예: '12/abc123_doc.pdf')
  file_size   bigint,
  mime_type   text,
  created_at  timestamptz not null default now()
);
create index if not exists post_attachments_post_idx on public.post_attachments(post_id);

create table if not exists public.application_attachments (
  id bigserial primary key,
  application_id bigint not null references public.applications(id) on delete cascade,
  uploader_id    uuid   not null references public.users(id) on delete cascade,
  file_name      text   not null,
  file_path      text   not null,
  file_size      bigint,
  mime_type      text,
  created_at     timestamptz not null default now()
);
create index if not exists application_attachments_app_idx on public.application_attachments(application_id);

-- ─── 3) RLS — post_attachments ────────────────────────────────────
alter table public.post_attachments enable row level security;

drop policy if exists post_attachments_select_all     on public.post_attachments;
drop policy if exists post_attachments_insert_author  on public.post_attachments;
drop policy if exists post_attachments_delete_author  on public.post_attachments;

create policy post_attachments_select_all on public.post_attachments
  for select using (true);

create policy post_attachments_insert_author on public.post_attachments
  for insert with check (
    uploader_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy post_attachments_delete_author on public.post_attachments
  for delete using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

-- ─── 4) RLS — application_attachments ─────────────────────────────
alter table public.application_attachments enable row level security;

drop policy if exists application_attachments_select        on public.application_attachments;
drop policy if exists application_attachments_insert_self   on public.application_attachments;
drop policy if exists application_attachments_delete_self   on public.application_attachments;

-- 지원자 본인 + 해당 게시글 작성자만 조회 가능
create policy application_attachments_select on public.application_attachments
  for select using (
    uploader_id = auth.uid()
    or exists (
      select 1
      from public.applications a
      join public.posts p on p.id = a.post_id
      where a.id = application_id
        and p.author_id = auth.uid()
    )
  );

create policy application_attachments_insert_self on public.application_attachments
  for insert with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = auth.uid()
    )
  );

create policy application_attachments_delete_self on public.application_attachments
  for delete using (uploader_id = auth.uid());

-- ─── 5) Storage Policies — post-files (public) ────────────────────
drop policy if exists "post-files insert authenticated" on storage.objects;
drop policy if exists "post-files select public"        on storage.objects;
drop policy if exists "post-files delete owner"         on storage.objects;

create policy "post-files insert authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-files');

create policy "post-files select public" on storage.objects
  for select using (bucket_id = 'post-files');

create policy "post-files delete owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-files' and owner = auth.uid());

-- ─── 6) Storage Policies — application-files (private) ────────────
-- 업로더 본인 + 해당 application의 post 작성자만 조회/다운로드 가능
drop policy if exists "application-files insert authenticated" on storage.objects;
drop policy if exists "application-files select"               on storage.objects;
drop policy if exists "application-files delete owner"         on storage.objects;

create policy "application-files insert authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'application-files');

create policy "application-files select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-files'
    and (
      owner = auth.uid()
      or exists (
        select 1
        from public.application_attachments aa
        join public.applications a on a.id = aa.application_id
        join public.posts p on p.id = a.post_id
        where aa.file_path = storage.objects.name
          and p.author_id = auth.uid()
      )
    )
  );

create policy "application-files delete owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'application-files' and owner = auth.uid());
