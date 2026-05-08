-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 시스템 쪽지 자동 발송
-- 지원/승인/거절/게시글종료 이벤트마다 자동으로 messages 행 삽입
-- ─────────────────────────────────────────────────────────────────

-- 1) messages 에 type 컬럼 (PERSONAL / SYSTEM)
alter table public.messages
  add column if not exists type text not null default 'PERSONAL'
  check (type in ('PERSONAL','SYSTEM'));

-- sender_id 는 SYSTEM 일 때 nullable 도 허용 (기존 NOT NULL 제약 완화)
alter table public.messages
  alter column sender_id drop not null;

-- ─── 2) 지원 들어옴 → 게시글 작성자에게 알림 ─────────────────────
create or replace function public.notify_post_author_on_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
  post_title text;
  applicant_nick text;
  role_name text;
begin
  select p.author_id, p.title into author_id, post_title
  from public.posts p where p.id = new.post_id;
  if author_id is null or author_id = new.user_id then
    return new;   -- 본인 글에 본인 지원 케이스 방지
  end if;

  select nickname into applicant_nick from public.users where id = new.user_id;

  if new.role_id is not null then
    select name into role_name from public.post_roles where id = new.role_id;
  end if;

  insert into public.messages (sender_id, receiver_id, content, type)
  values (
    new.user_id,
    author_id,
    case
      when role_name is not null
        then format('[%s] "%s" 역할에 %s님이 지원했습니다.', post_title, role_name, applicant_nick)
      else format('[%s]에 %s님이 지원했습니다.', post_title, applicant_nick)
    end,
    'SYSTEM'
  );
  return new;
end;
$$;

drop trigger if exists on_application_inserted on public.applications;
create trigger on_application_inserted
  after insert on public.applications
  for each row execute function public.notify_post_author_on_application();

-- ─── 3) 승인/거절 → 지원자에게 결과 통보 ─────────────────────────
create or replace function public.notify_applicant_on_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
  post_title text;
begin
  if not (old.status = 'PENDING' and new.status in ('ACCEPTED','REJECTED')) then
    return new;
  end if;

  select p.author_id, p.title into author_id, post_title
  from public.posts p where p.id = new.post_id;

  insert into public.messages (sender_id, receiver_id, content, type)
  values (
    author_id,
    new.user_id,
    case new.status
      when 'ACCEPTED' then format('🎉 [%s] 모집에 합류하셨습니다!', post_title)
      when 'REJECTED' then format('[%s] 지원이 아쉽게도 거절되었습니다. 다음 기회에 함께해요.', post_title)
    end,
    'SYSTEM'
  );
  return new;
end;
$$;

drop trigger if exists on_application_decision on public.applications;
create trigger on_application_decision
  after update on public.applications
  for each row execute function public.notify_applicant_on_decision();

-- ─── 4) 게시글 status → FINISHED → 멤버 전원에게 리뷰 요청 ──────
create or replace function public.notify_members_on_finish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  if not (old.status <> 'FINISHED' and new.status = 'FINISHED') then
    return new;
  end if;

  for m in
    select user_id from public.post_members where post_id = new.id
  loop
    insert into public.messages (sender_id, receiver_id, content, type)
    values (
      new.author_id,
      m.user_id,
      format('[%s]이 종료되었습니다. 함께한 멤버에게 리뷰를 남겨주세요!', new.title),
      'SYSTEM'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists on_post_finished on public.posts;
create trigger on_post_finished
  after update on public.posts
  for each row execute function public.notify_members_on_finish();
