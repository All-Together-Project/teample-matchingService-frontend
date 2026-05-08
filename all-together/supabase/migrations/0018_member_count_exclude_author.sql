-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 모집 인원 카운트 정합성 수정
--   * current_member_count 는 "모집된 인원" — 작성자(리더/스터디장/모임장) 제외
--   * 작성자는 post_members 에 그대로 남음 (리뷰/멤버 권한 유지)
--   * 역할별 카운트(post_roles_with_count.filled_count)와 합계가 일치
--
-- 적용 후:
--   - capacity=10 인 게시글에서 작성자 외 0명 합류 → 0/10
--   - 10명 합류 시 → 10/10 + 자동 COMPLETE 전환
-- ─────────────────────────────────────────────────────────────────

-- 1) 승인 트리거: 멤버 카운트에서 작성자 제외
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
  author       uuid;
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

  -- 게시글 정보 + 작성자 ID
  select capacity, status, author_id into cap, cur_status, author
  from public.posts where id = new.post_id;

  -- 작성자를 제외한 멤버 수 = 실제 모집 인원
  select count(*) into member_count
  from public.post_members
  where post_id = new.post_id
    and user_id <> author;

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

-- 2) 멤버 INSERT/DELETE 동기화 트리거: 동일하게 작성자 제외
create or replace function public.sync_post_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid    bigint := coalesce(new.post_id, old.post_id);
  author uuid;
  cnt    int;
begin
  select author_id into author from public.posts where id = pid;

  select count(*) into cnt
  from public.post_members
  where post_id = pid
    and user_id <> author;

  update public.posts set current_member_count = cnt where id = pid;
  return coalesce(new, old);
end;
$$;

-- 트리거는 그대로 사용 (함수만 갱신)

-- 3) 일회성 정합성 보정: 모든 게시글의 current_member_count 재계산
update public.posts p
set
  current_member_count = c.cnt,
  status = case
             when p.capacity is not null
              and c.cnt >= p.capacity
              and p.status = 'RECRUITING'
             then 'COMPLETE'
             when p.capacity is not null
              and c.cnt < p.capacity
              and p.status = 'COMPLETE'
              and not exists (
                -- 멤버가 빠진 경우 RECRUITING 으로 되돌리지는 않음 (수동 운영)
                select 1
              )
             then p.status
             else p.status
           end
from (
  select
    pm.post_id,
    count(*) filter (where pm.user_id <> p2.author_id) as cnt
  from public.post_members pm
  join public.posts p2 on p2.id = pm.post_id
  group by pm.post_id
) c
where p.id = c.post_id;

-- 4) 멤버가 한 명도 없는 (작성자 제외) 게시글은 0 으로 명시 보정
update public.posts p
set current_member_count = 0
where not exists (
  select 1 from public.post_members pm
  where pm.post_id = p.id and pm.user_id <> p.author_id
);
