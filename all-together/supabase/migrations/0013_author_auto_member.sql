-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 작성자를 자동으로 게시글 멤버로 등록
--   • 새 글 INSERT 시 트리거로 자동
--   • 기존 글 백필
--   • current_member_count 일괄 재동기화
-- ─────────────────────────────────────────────────────────────────

-- 1) 트리거 함수: 새 글 만들면 작성자를 첫 멤버로 등록
create or replace function public.add_author_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category <> 'COMMUNITY' and new.author_id is not null then
    insert into public.post_members (post_id, user_id, role)
    values (
      new.id, new.author_id,
      case new.category
        when 'STUDY'   then '스터디장'
        when 'PROJECT' then '리더'
        when 'MEETUP'  then '모임장'
        else '작성자'
      end
    )
    on conflict (post_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_add_author on public.posts;
create trigger posts_add_author
  after insert on public.posts
  for each row execute function public.add_author_as_member();

-- 2) 백필: 작성자가 빠진 기존 글에 작성자 추가
insert into public.post_members (post_id, user_id, role)
select
  p.id, p.author_id,
  case p.category
    when 'STUDY'   then '스터디장'
    when 'PROJECT' then '리더'
    when 'MEETUP'  then '모임장'
    else '작성자'
  end
from public.posts p
where p.category <> 'COMMUNITY'
  and p.author_id is not null
  and not exists (
    select 1 from public.post_members pm
    where pm.post_id = p.id and pm.user_id = p.author_id
  );

-- 3) current_member_count 일괄 재동기화 + 정원 다 찬 RECRUITING 자동 COMPLETE
update public.posts p
set
  current_member_count = c.cnt,
  status = case
             when p.capacity is not null
              and c.cnt >= p.capacity
              and p.status = 'RECRUITING'
             then 'COMPLETE'
             else p.status
           end
from (
  select pm.post_id, count(*) as cnt
  from public.post_members pm
  group by pm.post_id
) c
where p.id = c.post_id;
