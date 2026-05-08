-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 지원 승인 트리거 개선
--   • current_member_count 를 단순 +1 이 아니라 실제 멤버 수로 동기화
--   • 정원이 다 차면 RECRUITING → COMPLETE 자동 전환
-- ─────────────────────────────────────────────────────────────────

create or replace function public.applications_on_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name    text;
  member_count int;
  cap          int;
  cur_status   text;
begin
  if not (
       (tg_op = 'UPDATE' and old.status <> 'ACCEPTED' and new.status = 'ACCEPTED')
    or (tg_op = 'INSERT' and new.status = 'ACCEPTED')
  ) then
    return new;
  end if;

  -- 역할 이름 (role_id 없으면 '멤버')
  if new.role_id is not null then
    select name into role_name from public.post_roles where id = new.role_id;
  end if;

  -- 멤버 추가 (이미 있으면 skip)
  insert into public.post_members (post_id, user_id, role_id, role)
  values (new.post_id, new.user_id, new.role_id, coalesce(role_name, '멤버'))
  on conflict (post_id, user_id) do nothing;

  -- current_member_count 를 실제 멤버 수로 재동기화
  select count(*) into member_count
  from public.post_members
  where post_id = new.post_id;

  select capacity, status into cap, cur_status
  from public.posts where id = new.post_id;

  update public.posts
     set current_member_count = member_count,
         status = case
                    when cap is not null
                      and member_count >= cap
                      and cur_status = 'RECRUITING'
                    then 'COMPLETE'
                    else cur_status
                  end
   where id = new.post_id;
  return new;
end;
$$;

-- 기존 트리거 재사용 (함수만 갱신)

-- ──────────────────────────────────────────────────────────────
-- 보너스: 멤버가 빠지면(role_id 변경, 멤버 삭제 등) 카운트도 동기화
-- 추후 멤버 탈퇴 기능 도입 대비
-- ──────────────────────────────────────────────────────────────
create or replace function public.sync_post_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid bigint := coalesce(new.post_id, old.post_id);
  cnt int;
begin
  select count(*) into cnt from public.post_members where post_id = pid;
  update public.posts set current_member_count = cnt where id = pid;
  return coalesce(new, old);
end;
$$;

drop trigger if exists post_members_count_sync on public.post_members;
create trigger post_members_count_sync
  after insert or delete on public.post_members
  for each row execute function public.sync_post_member_count();

-- ──────────────────────────────────────────────────────────────
-- 일회성 정합성 보정: 기존 게시글의 current_member_count 실제값으로
-- 정원 다 찬 RECRUITING 글은 COMPLETE 로 전환
-- ──────────────────────────────────────────────────────────────
update public.posts p
set
  current_member_count = c.cnt,
  status = case
             when p.capacity is not null and c.cnt >= p.capacity and p.status = 'RECRUITING'
             then 'COMPLETE' else p.status
           end
from (
  select pm.post_id, count(*) as cnt
  from public.post_members pm
  group by pm.post_id
) c
where p.id = c.post_id;
