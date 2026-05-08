-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 모집 역할(post_roles) 시스템
-- 작성자가 글을 쓸 때 역할별로 정원을 정의 (예: 개발자 2명, 디자이너 1명)
-- 지원자는 지원 시 역할을 선택. 승인 시 그 역할로 멤버에 추가됨.
--
-- posts.capacity 는 그대로 유지 — post_roles 가 없으면 단일 정원으로 동작
-- ─────────────────────────────────────────────────────────────────

-- 1) post_roles 테이블
create table if not exists public.post_roles (
  id bigserial primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  name text not null,
  capacity int not null check (capacity > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, name)
);

create index if not exists post_roles_post_idx on public.post_roles (post_id, sort_order);

-- 2) applications 에 role_id (선택한 지원 역할)
alter table public.applications
  add column if not exists role_id bigint references public.post_roles(id) on delete set null;

create index if not exists applications_role_idx on public.applications (role_id);

-- 3) post_members 에 role_id (승인되어 합류한 역할)
--    기존 role text 컬럼은 유지 (post_roles 없는 게시글 호환)
alter table public.post_members
  add column if not exists role_id bigint references public.post_roles(id) on delete set null;

create index if not exists post_members_role_idx on public.post_members (role_id);

-- 4) RLS 정책
alter table public.post_roles enable row level security;

drop policy if exists post_roles_select_all   on public.post_roles;
drop policy if exists post_roles_modify_author on public.post_roles;

-- 누구나 조회 (게시글 상세에서 역할 목록 표시)
create policy post_roles_select_all on public.post_roles for select using (true);

-- 게시글 작성자만 변경 가능
create policy post_roles_modify_author on public.post_roles for all
  using      (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- 5) 헬퍼 뷰: 각 역할별 현재 합류한 인원 수
create or replace view public.post_roles_with_count as
select
  pr.id,
  pr.post_id,
  pr.name,
  pr.capacity,
  pr.sort_order,
  pr.created_at,
  coalesce((
    select count(*) from public.post_members pm
    where pm.role_id = pr.id
  ), 0)::int as filled_count
from public.post_roles pr;

-- 6) 지원 시 capacity 초과 막기 (DB 레벨 안전망)
create or replace function public.applications_check_role_capacity()
returns trigger
language plpgsql
as $$
declare
  filled int;
  cap    int;
begin
  if new.role_id is null then
    return new;
  end if;
  select capacity into cap from public.post_roles where id = new.role_id;
  -- ACCEPTED 로 전환되는 경우만 정원 체크
  if (tg_op = 'INSERT' and new.status = 'ACCEPTED')
     or (tg_op = 'UPDATE' and old.status <> 'ACCEPTED' and new.status = 'ACCEPTED')
  then
    select count(*) into filled
    from public.post_members
    where role_id = new.role_id;
    if filled >= cap then
      raise exception '역할 정원이 가득 찼습니다 (%/%)', filled, cap;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_capacity_check on public.applications;
create trigger applications_capacity_check
  before insert or update on public.applications
  for each row execute function public.applications_check_role_capacity();

-- 7) 승인되면 자동으로 post_members 에 행 삽입 + current_member_count 증가
create or replace function public.applications_on_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text;
begin
  if (tg_op = 'UPDATE' and old.status <> 'ACCEPTED' and new.status = 'ACCEPTED')
     or (tg_op = 'INSERT' and new.status = 'ACCEPTED')
  then
    -- 역할 이름 조회 (role_id 없으면 '멤버')
    if new.role_id is not null then
      select name into role_name from public.post_roles where id = new.role_id;
    end if;
    insert into public.post_members (post_id, user_id, role_id, role)
    values (new.post_id, new.user_id, new.role_id, coalesce(role_name, '멤버'))
    on conflict (post_id, user_id) do nothing;

    update public.posts
       set current_member_count = current_member_count + 1
     where id = new.post_id;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_accepted_to_member on public.applications;
create trigger applications_accepted_to_member
  after insert or update on public.applications
  for each row execute function public.applications_on_accepted();
