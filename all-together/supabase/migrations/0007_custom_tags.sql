-- ─────────────────────────────────────────────────────────────────
-- 사용자 정의 태그 — 로그인한 유저가 직접 태그를 추가할 수 있게 INSERT 정책 부여
-- (이전엔 SELECT 만 허용, INSERT 불가였음)
-- ─────────────────────────────────────────────────────────────────

drop policy if exists tags_insert_authenticated on public.tags;
create policy tags_insert_authenticated on public.tags
  for insert to authenticated
  with check (true);
