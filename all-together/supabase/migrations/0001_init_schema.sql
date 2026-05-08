-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 초기 스키마 (Phase 2)
-- 적용: Supabase Dashboard → SQL Editor → 이 파일 전체를 붙여넣고 Run
-- ─────────────────────────────────────────────────────────────────

-- 1) users — auth.users 와 1:1 연동
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nickname text not null,
  major text,
  profile_url text,
  introduction text,
  temperature double precision not null default 36.5,
  created_at timestamptz not null default now()
);

-- 2) tags & 매핑
create table if not exists public.tags (
  id bigserial primary key,
  name text not null,
  category text not null check (category in ('STUDY','PROJECT','MEETUP','GENERAL')),
  unique (name, category)
);

create table if not exists public.user_tags (
  user_id uuid references public.users(id) on delete cascade,
  tag_id  bigint references public.tags(id)  on delete cascade,
  primary key (user_id, tag_id)
);

-- 3) posts (통합 게시글)
create table if not exists public.posts (
  id bigserial primary key,
  category text not null check (category in ('STUDY','PROJECT','MEETUP','COMMUNITY')),
  sub_category text not null,
  title text not null,
  content text not null,
  capacity int,
  current_member_count int not null default 0,
  status text not null check (status in ('RECRUITING','COMPLETE','FINISHED','GENERAL')),
  period text,
  deadline timestamptz,
  author_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
  -- embedding vector(768)  ← Phase 4 (pgvector) 도입 시 추가
);

create index if not exists posts_category_status_idx on public.posts (category, status, created_at desc);
create index if not exists posts_author_idx          on public.posts (author_id);

create table if not exists public.post_tags (
  post_id bigint references public.posts(id) on delete cascade,
  tag_id  bigint references public.tags(id)  on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.post_members (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid   not null references public.users(id) on delete cascade,
  role text not null,
  unique (post_id, user_id)
);

create table if not exists public.applications (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid   not null references public.users(id) on delete cascade,
  introduction text not null,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.comments (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid   not null references public.users(id) on delete cascade,
  content text not null,
  parent_id bigint references public.comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 4) 리뷰 시스템
create table if not exists public.review_items (
  id bigserial primary key,
  category text not null check (category in ('STUDY','PROJECT','MEETUP')),
  item_name text not null,
  sort_order int not null default 0
);

create table if not exists public.reviews (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  evaluator_id uuid not null references public.users(id) on delete cascade,
  target_id    uuid not null references public.users(id) on delete cascade,
  comment text,
  created_at timestamptz not null default now(),
  unique (post_id, evaluator_id, target_id)
);

create table if not exists public.review_scores (
  id bigserial primary key,
  review_id bigint not null references public.reviews(id) on delete cascade,
  item_id   bigint not null references public.review_items(id) on delete restrict,
  score int not null check (score between 1 and 5),
  unique (review_id, item_id)
);

-- 5) 쪽지
create table if not exists public.messages (
  id bigserial primary key,
  sender_id   uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_receiver_idx on public.messages (receiver_id, created_at desc);
create index if not exists messages_sender_idx   on public.messages (sender_id, created_at desc);

-- 6) auth.users → public.users 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, nickname)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
