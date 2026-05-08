-- ─────────────────────────────────────────────────────────────────
-- AllTogether — 카테고리별 리뷰 항목 시드
-- ─────────────────────────────────────────────────────────────────

insert into public.review_items (category, item_name, sort_order) values
  ('PROJECT', '전문성',     1),
  ('PROJECT', '소통 능력',  2),
  ('PROJECT', '시간 약속',  3),
  ('PROJECT', '협동심',     4),
  ('PROJECT', '열정',       5),
  ('STUDY',   '성실도',     1),
  ('STUDY',   '참여도',     2),
  ('STUDY',   '소통 능력',  3),
  ('STUDY',   '지식 공유',  4),
  ('STUDY',   '시간 약속',  5),
  ('MEETUP',  '매너',         1),
  ('MEETUP',  '시간 약속',    2),
  ('MEETUP',  '분위기 기여', 3),
  ('MEETUP',  '재참여 의사', 4),
  ('MEETUP',  '소통',         5)
on conflict do nothing;
