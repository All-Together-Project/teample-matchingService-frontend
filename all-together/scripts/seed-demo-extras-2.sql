-- ═════════════════════════════════════════════════════════════════════
-- AllTogether — 추가 시드 #2 (cross-dept AI 추천 보강 + 직장인 콘텐츠)
--
-- 목적:
--   1) AI 팀원/프로젝트 추천이 cross-dept 로 잘 동작하도록 — 일부 사용자에게
--      다른 학과 관심 태그를 추가 부여 (현실 반영: 컴공 학생이 디자인에도 관심 등)
--   2) 직장인 대상 게시글 추가 — 졸업 후 동일 분야 직장인이 쓸 만한 글
--      (이직/부업/사이드 프로젝트/평일 저녁 스터디/직무별 네트워킹)
--   3) cross-dept 협업 게시글 추가 (디자인+개발, 영상+무용, 패션+뷰티 등)
--
-- 본 파일은 seed-demo-data.sql + seed-demo-extras.sql 다음에 실행.
-- 단독 실행도 가능.
-- 끝나면 backfill-embeddings.mjs 다시 실행 → 새 게시글 임베딩.
-- ═════════════════════════════════════════════════════════════════════

begin;

-- ─── 1) 직장인/cross-dept 관련 신규 태그 ────────────────────────────
insert into public.tags (name, category) values
  -- 직장인 자기계발
  ('직장인 스터디', 'STUDY'), ('영어 회화', 'STUDY'), ('데이터 분석', 'STUDY'),
  ('투자/재테크', 'STUDY'), ('이직 준비', 'STUDY'),
  -- 직장인 사이드/협업
  ('사이드 프로젝트', 'PROJECT'), ('부업', 'PROJECT'), ('프리랜서 협업', 'PROJECT'),
  ('이직 포트폴리오', 'PROJECT'),
  -- 직장인 네트워킹/모임
  ('직장인 네트워킹', 'MEETUP'), ('평일 저녁 모임', 'MEETUP'),
  ('직무 멘토링', 'MEETUP'), ('주말 클래스', 'MEETUP'),
  -- 공통
  ('직장인', 'GENERAL'), ('주니어 직장인', 'GENERAL'), ('이직', 'GENERAL'),
  ('커리어', 'GENERAL'), ('재택 근무', 'GENERAL')
on conflict (name, category) do nothing;

-- ─── 2) 사용자 풀 + 학과 라벨 재구성 ────────────────────────────────
-- (이전 시드의 _demo_users 가 COMMIT 시 DROP 됐으므로 9학과 분배 재현)
create temp table _demo_users (
  user_id  uuid primary key,
  nickname text,
  is_ghost boolean,
  dept     text
) on commit drop;

with showcase_ids(id) as (values
  ('fbcc0a35-ad96-4d0f-89c4-9c61252d387d'::uuid),
  ('343e572f-40a8-4ff8-8f4d-8ff53fd16c9a'::uuid),
  ('e4f0c895-b4ae-45b9-b65f-37de570e1103'::uuid),
  ('e2d01f55-ab31-46e4-b1c2-d2896037ac6e'::uuid),
  ('7e43df2f-136f-4b9b-b9e6-a8cbfaa43d9b'::uuid),
  ('d911914f-5b6b-45e4-8e03-689770dd416d'::uuid),
  ('df6b13a0-11b5-46f5-9130-87c99531b071'::uuid),
  ('7d381b59-a201-42ba-bf9b-efd20fac828c'::uuid),
  ('6f4664ac-1a68-4b2e-980b-9fd180bbff40'::uuid),
  ('a18a7e2e-5388-4bb5-825e-2f5a62fcb9a3'::uuid),
  ('fc6d6497-91f7-4f4b-931e-b61f29433bb2'::uuid),
  ('b28b35c3-438d-4bfe-830a-5407d442c234'::uuid),
  ('99acdb50-afe2-4ca4-9080-82e1cf81c58c'::uuid),
  ('8e9cd35d-1412-4d01-bc9b-f63e0f473acb'::uuid),
  ('351d040e-3a7a-476c-a505-c0e6865714f7'::uuid),
  ('b7a1687b-5fe2-4849-87dc-7bbedbcd0605'::uuid)
)
insert into _demo_users
select
  u.id,
  u.nickname,
  not exists (select 1 from public.posts p where p.author_id = u.id),
  (array[
    '무용과','디자인과','컴퓨터공학과','뷰티과',
    '경영학과','영상과','음악과','패션디자인과','조리학과'
  ])[(abs(hashtext(u.id::text || 'cook')) % 9) + 1]
from public.users u
where u.id not in (select id from showcase_ids);

create index on _demo_users(dept);
create index on _demo_users(is_ghost);

-- ─── 3) cross-interest user_tags 보강 ────────────────────────────────
-- 각 사용자에게 "다른 학과 관심 태그" 1~2개를 30~50% 확률로 추가.
-- 현실에서 컴공 학생이 디자인/창업도 관심 있는 식의 cross-interest 시뮬레이션.
-- AI 멤버 추천 + 프로젝트 추천에서 cross-dept 매칭이 활성화됨.
do $$
declare
  u                  record;
  v_tag_id           bigint;
  v_other_dept       text;
  v_other_dept_tags  text[];
  v_pick             int;
  v_depts text[] := array[
    '무용과','디자인과','컴퓨터공학과','뷰티과',
    '경영학과','영상과','음악과','패션디자인과','조리학과'
  ];
begin
  for u in select user_id, dept from _demo_users loop
    -- 40% 확률로 다른 학과 관심 태그 1~2개 추가
    if random() > 0.4 then continue; end if;

    -- 본인 학과를 제외한 학과 1개 선택
    loop
      v_other_dept := v_depts[1 + floor(random()*array_length(v_depts,1))::int];
      exit when v_other_dept <> u.dept;
    end loop;

    v_other_dept_tags := case v_other_dept
      when '무용과'         then array['발레','컨템포러리','한국무용','안무 창작','공연 기획']
      when '디자인과'       then array['UI/UX','그래픽 디자인','브랜딩','일러스트','포트폴리오']
      when '컴퓨터공학과'   then array['알고리즘','웹 개발','앱 개발','AI/ML','해커톤']
      when '뷰티과'         then array['메이크업','네일아트','뷰티 화보','스킨케어']
      when '경영학과'       then array['마케팅','스타트업','비즈니스 공모전','이직 준비']
      when '영상과'         then array['영상 편집','단편 영화','유튜브 콘텐츠','시나리오']
      when '음악과'         then array['작곡','합주','버스킹','인디 음악']
      when '패션디자인과'   then array['패션쇼','의상 제작','패션 일러스트','스타일링 모임']
      when '조리학과'       then array['베이킹','메뉴 개발','한식','맛집 탐방','바리스타']
      else array['대학생']
    end;

    -- 1~2개 추가
    v_pick := 1 + floor(random()*2)::int;
    for v_tag_id in
      select t.id from public.tags t
      where t.name = any(v_other_dept_tags)
      order by random() limit v_pick
    loop
      insert into public.user_tags (user_id, tag_id) values (u.user_id, v_tag_id)
      on conflict (user_id, tag_id) do nothing;
    end loop;
  end loop;

  -- 추가로 직장인/커리어 관련 태그를 25% 사용자에게 부여
  -- (졸업 예정 + 이직 + 사이드 프로젝트 등 cross-life-stage)
  for u in select user_id from _demo_users where random() < 0.25 loop
    for v_tag_id in
      select t.id from public.tags t
      where t.name in ('이직 준비','커리어','사이드 프로젝트','직장인 네트워킹','이직')
      order by random() limit (1 + floor(random()*2)::int)
    loop
      insert into public.user_tags (user_id, tag_id) values (u.user_id, v_tag_id)
      on conflict (user_id, tag_id) do nothing;
    end loop;
  end loop;
end $$;

-- ─── 4) 게시글 템플릿 — 직장인 대상 + cross-dept 협업 ──────────────
create temp table _demo_templates (
  dept text,
  category text,
  sub_category text,
  title_base text,
  content_base text,
  tag_names text[]
) on commit drop;

insert into _demo_templates values
  -- ── 직장인 자기계발 (학과 무관 / dept 는 작성자 풀 선택용) ────────
  ('컴퓨터공학과','STUDY','어학','직장인 영어 회화 스터디 — 평일 저녁',
   '퇴근 후 8~9시 화상 영어. 1:1 페어로 진행, 매주 다른 주제.', array['영어 회화','직장인 스터디','평일 저녁 모임','직장인']),
  ('경영학과','STUDY','자격증/시험','직장인 데이터 분석 부트캠프',
   'SQL + Tableau 12주. 평일 1회 + 주말 1회. 실제 회사 데이터 케이스 풀이.', array['데이터 분석','직장인 스터디','이직 준비','커리어']),
  ('경영학과','STUDY','독서','직장인 투자/재테크 독서모임',
   '월 1권. 직장인 자산 운용 + 부동산 + 미국 주식 위주. 평일 저녁.', array['투자/재테크','직장인 스터디','직장인']),
  ('컴퓨터공학과','STUDY','코딩/개발','이직 준비 코딩 인터뷰 스터디',
   '경력 2~5년차 모임. 시스템 디자인 + 알고리즘. 카카오/네이버/토스 기출.', array['알고리즘','이직 준비','커리어','직장인']),
  ('디자인과','STUDY','독서','UX 직장인 리서치 스터디',
   '월 1권 + 실제 회사 사례 발제. 디자이너/PM/리서처 환영.', array['UI/UX','직장인 스터디','이직 준비']),
  -- ── 직장인 사이드/협업 프로젝트 ──────────────────────────────────
  ('컴퓨터공학과','PROJECT','창업/사이드','퇴근 후 사이드 SaaS 만들기',
   '직장인 4명, 평일 저녁 + 주말. MVP 출시 목표. 디자인/개발/기획 1명씩.', array['사이드 프로젝트','웹 개발','부업','직장인']),
  ('디자인과','PROJECT','디자인','이직 포트폴리오 사이드 협업',
   '디자이너 + 개발자 1:1 페어. 6주 안에 사이드 1건 완성, 이직 포트폴리오 활용.', array['이직 포트폴리오','UI/UX','웹 개발','커리어']),
  ('영상과','PROJECT','창업/사이드','프리랜서 영상 협업 풀',
   '주말 영상 외주 같이 받을 사람. 촬영/편집/그래픽 분담.', array['프리랜서 협업','영상 편집','부업','직장인']),
  ('컴퓨터공학과','PROJECT','개발','직장인 AI 사이드 — 생산성 도구',
   'GPT/Claude API 활용 업무 자동화 도구 사이드. 백엔드 + 프론트 + 디자인.', array['AI/ML','사이드 프로젝트','웹 개발','직장인']),
  ('경영학과','PROJECT','창업/사이드','직장인 N잡 부업 정보 교환',
   '주말/평일 저녁 가능한 부업 정리 + 실제 수익 사례 공유. 정기 모임.', array['부업','직장인 네트워킹','직장인']),
  -- ── 직장인 네트워킹/모임 ─────────────────────────────────────────
  ('컴퓨터공학과','MEETUP','네트워킹','주니어 개발자 점심 모임',
   '월 1회 강남/판교 지역, 2~5년차 개발자 점심. 이직 + 커리어 잡담.', array['직장인 네트워킹','커리어','주니어 직장인']),
  ('디자인과','MEETUP','네트워킹','UX 디자이너 직무 모임',
   '격주 평일 저녁, 디자이너 직무 한정. 회사 사례 + 도구 공유.', array['직장인 네트워킹','UI/UX','평일 저녁 모임']),
  ('경영학과','MEETUP','네트워킹','직장인 스타트업/이직 모임',
   '월 1회, 스타트업 직장인 + 이직 준비자. 멘토 1명 동석 가능.', array['직장인 네트워킹','이직','스타트업']),
  ('음악과','MEETUP','취미/문화','직장인 합주 동호회',
   '주말 오후 합주. 학교 졸업 후에도 음악 놓치기 싫은 직장인 모임.', array['합주','평일 저녁 모임','직장인']),
  ('조리학과','MEETUP','취미/문화','직장인 주말 쿠킹 클래스',
   '격주 토요일, 한식/양식 번갈아. 학교 동문이 아니어도 OK.', array['쿠킹 클래스','주말 클래스','직장인']),
  -- ── cross-dept 협업 프로젝트 (학과 융합) ─────────────────────────
  ('디자인과','PROJECT','디자인','디자인 + 개발 학과 연합 발표회 앱',
   '디자인과 + 컴공과 학생 + 일부 직장인 멘토. 발표회용 매칭 앱 1주 안에.', array['UI/UX','웹 개발','학과 연합','발표 준비']),
  ('영상과','PROJECT','개발','무용+영상 콜라보 작품',
   '무용과의 컨템포러리 작품을 영상과가 미디어 아트로 확장. 학과 융합 작품.', array['컨템포러리','영상 편집','학과 연합']),
  ('패션디자인과','PROJECT','디자인','패션 + 뷰티 + 음악 학과 연합 패션쇼',
   '패션과 의상 + 뷰티과 메이크업 + 음악과 무대음악. 학과 연합 미니쇼.', array['패션쇼','메이크업','공연 프로젝트','학과 연합']),
  ('컴퓨터공학과','PROJECT','개발','경영 + 컴공 학과 연합 — 학생 창업 사이드',
   '경영과 비즈니스 모델 + 컴공 MVP 구현. 6주 1사이클로 학생 창업 검증.', array['스타트업','웹 개발','학과 연합','사이드 프로젝트']),
  ('조리학과','PROJECT','기타 협업','조리 + 영상 협업 — 푸드 콘텐츠 채널',
   '조리과 메뉴 + 영상과 촬영/편집. 유튜브 푸드 채널 학생 운영.', array['메뉴 개발','유튜브 콘텐츠','학과 연합']);

-- ─── 5) 게시글 인서트 (템플릿당 4변주 — 직장인은 약간 적게) ───────
do $$
declare
  t                _demo_templates%rowtype;
  v_variant        int;
  v_author         uuid;
  v_status         text;
  v_capacity       int;
  v_period         text;
  v_deadline       timestamptz;
  v_created_at     timestamptz;
  v_title          text;
  v_content        text;
  v_post_id        bigint;
  v_tag_id         bigint;
  v_tag_name       text;
  regions text[] := array['강남','판교','홍대','신촌','성수','잠실','광화문','여의도','서면','온라인','재택','평촌'];
  seasons text[] := array['이번 분기','내년 상반기','내년 하반기','이번 학기','연말','연초'];
  periods text[] := array['1개월','2개월','3개월','6개월','상시','시즌제','분기','12주'];
  tones   text[] := array['주 1회','주 2회','평일 저녁','주말','온라인 위주','오프라인 중심','격주 진행'];
begin
  for t in select * from _demo_templates loop
    for v_variant in 1..4 loop
      v_author := null;
      if random() < 0.8 then
        select user_id into v_author
          from _demo_users where dept = t.dept and is_ghost
          order by random() limit 1;
      end if;
      if v_author is null then
        select user_id into v_author
          from _demo_users where dept = t.dept
          order by random() limit 1;
      end if;
      if v_author is null then continue; end if;

      if t.category = 'COMMUNITY' then
        v_status := 'GENERAL';
        v_capacity := null; v_period := null; v_deadline := null;
      else
        v_status := (array['RECRUITING','RECRUITING','RECRUITING','RECRUITING','COMPLETE','COMPLETE','FINISHED','FINISHED'])[1 + floor(random()*8)::int];
        v_capacity := 3 + floor(random()*10)::int;
        v_period := periods[1 + floor(random()*array_length(periods,1))::int];
        v_deadline := now() + (7 + floor(random()*60)::int) * interval '1 day';
      end if;

      v_created_at := now() - (floor(random()*90)::int) * interval '1 day';

      v_title := case (v_variant % 4)
        when 0 then format('[%s] %s — %s', regions[1+floor(random()*array_length(regions,1))::int], t.title_base, seasons[1+floor(random()*array_length(seasons,1))::int])
        when 1 then format('%s (%s)', t.title_base, tones[1+floor(random()*array_length(tones,1))::int])
        when 2 then format('%s %s 모집', seasons[1+floor(random()*array_length(seasons,1))::int], t.title_base)
        else        format('%s — %s 진행', t.title_base, tones[1+floor(random()*array_length(tones,1))::int])
      end;

      v_content := t.content_base || chr(10) || chr(10)
        || format('진행 지역/방식: %s · %s', regions[1+floor(random()*array_length(regions,1))::int], tones[1+floor(random()*array_length(tones,1))::int]) || chr(10)
        || '학생 + 직장인 모두 환영합니다. 학과나 직무 다양해도 좋습니다.' || chr(10)
        || case when t.category <> 'COMMUNITY'
             then format('진행 기간: %s, 정원 %s명', v_period, v_capacity)
             else '편하게 댓글 남겨주세요.'
           end;

      insert into public.posts (
        category, sub_category, title, content,
        capacity, status, period, deadline, author_id, created_at
      ) values (
        t.category, t.sub_category, v_title, v_content,
        v_capacity, v_status, v_period, v_deadline, v_author, v_created_at
      ) returning id into v_post_id;

      foreach v_tag_name in array t.tag_names loop
        select id into v_tag_id from public.tags where name = v_tag_name limit 1;
        if v_tag_id is not null then
          insert into public.post_tags (post_id, tag_id) values (v_post_id, v_tag_id)
          on conflict do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- ─── 6) 직장인 시각 정보공유 게시글 ─────────────────────────────────
create temp table _demo_info_posts (
  dept text,
  title text,
  content text,
  tag_names text[]
) on commit drop;

insert into _demo_info_posts values
  ('컴퓨터공학과',
   '주니어 개발자 이직 — 1~3년차 현실 정리',
   E'주니어 개발자(1~3년차) 이직 시 회사들이 실제로 보는 것 정리.\n\n' ||
   E'[기술 면접]\n' ||
   E'• 알고리즘 — 골드 ~ 플래티넘 수준 1문제 30분 안에\n' ||
   E'• CS — OS/DB/네트워크 기본 + 본인 스택 깊이 있게\n' ||
   E'• 시스템 디자인 — 1~2년차도 가볍게 묻기 시작함 (URL 단축기 정도)\n\n' ||
   E'[경험 어필]\n' ||
   E'• "기능 만들었다" 보다 "어떤 문제를 어떻게 풀었다" 가 결정적\n' ||
   E'• 트래픽/장애/협업 경험 1개씩은 준비\n' ||
   E'• GitHub > 블로그 > 사이드 프로젝트 순으로 평가받음\n\n' ||
   E'[연봉]\n' ||
   E'• 신입 3.5~5천 / 1~2년 4.5~6천 / 3년 5.5~7천 (스타트업~중견 기준)\n' ||
   E'• 대기업/유니콘은 +1~1.5천 가능\n\n' ||
   E'평일 저녁 코딩 인터뷰 스터디 글도 올라와 있으니 참고하세요.',
   array['이직 준비','이직','커리어','주니어 직장인','직장인']),
  ('디자인과',
   '디자이너 이직 포트폴리오 — 회사가 보는 포인트',
   E'디자이너 1~3년차 이직 인터뷰 본 회사들 평가 포인트 정리.\n\n' ||
   E'[필수]\n' ||
   E'• 케이스 스터디 3~5개 (1프로젝트당 1슬라이드는 안됨)\n' ||
   E'• 본인 기여 명시 — "디자인 시스템 구축" 보다 "OO 컴포넌트 8개 본인 작업"\n' ||
   E'• 의사결정 근거 — 왜 이 색/레이아웃/인터랙션을 선택했는지\n\n' ||
   E'[가산점]\n' ||
   E'• 측정 — "이 변경으로 클릭률 20% 상승" 같은 지표\n' ||
   E'• 협업 — PM/개발자와의 협업 흔적 (코멘트, 핸드오프 도큐)\n' ||
   E'• 결과 → 회고 — 끝났을 때 뭘 배웠는지\n\n' ||
   E'[탈락 요인]\n' ||
   E'• 비핸스만 던지는 것 (개별 페이지/PDF 필수)\n' ||
   E'• 단순 화면 캡처 + 짧은 설명\n' ||
   E'• 회사 시켜서 한 일 / 본인 의사결정 부족\n\n' ||
   E'평균 면접 시 포트폴리오 발표 20~30분. 슬라이드 15장 안에 마무리.',
   array['이직 포트폴리오','UI/UX','이직','커리어']),
  ('경영학과',
   '직장인 부업 — 합법 + 실수익 가능한 N잡 정리',
   E'직장인 N잡 3가지 실제 해본 결과 정리. 합법성 + 시간 효율 위주.\n\n' ||
   E'[추천 — 시간 대비 수익 좋음]\n' ||
   E'• 강의 제작 — 인프런/클래스101. 한 번 만들면 수동 수익. 본업 직무 활용\n' ||
   E'• 컨설팅 (시간제) — 본업 도메인 살려서 주말 1회 3시간 단가 30~50만원\n' ||
   E'• 사이드 SaaS 운영 — 초기 셋업 6개월, 이후 월 50~300만원 가능\n\n' ||
   E'[조심]\n' ||
   E'• 본업과 직접 경쟁 X — 근로계약서 + 취업규칙 확인 (대부분 동종 업계 금지 조항)\n' ||
   E'• 종합소득세 — 부업 매출 연 300만원 넘으면 5월 신고 필수\n' ||
   E'• 4대보험 — 본업이 주업이라 부업은 사업소득으로 처리 (간이사업자 등록)\n\n' ||
   E'[안 추천]\n' ||
   E'• 단순 알바형 부업 (배달/물류) — 시간 효율 매우 나쁨\n' ||
   E'• 코인 거래 — 부업 아닌 도박. 본업 집중 추천.',
   array['부업','직장인','커리어']),
  ('컴퓨터공학과',
   '재택 근무 1년차 — 실제 도구/루틴 정리',
   E'풀 재택 1년 근무하면서 정착한 도구/루틴 정리.\n\n' ||
   E'[필수 셋업]\n' ||
   E'• 모니터 듀얼 (24인치 + 27인치) — 30~50만원 정도\n' ||
   E'• 의자 — 시디즈 T50 / 허먼밀러 중고 (10~30만원). 진짜 안 아끼는 게 정답\n' ||
   E'• 키보드/마우스 — 무선 + 손목 보호. 로지텍 MX 시리즈 추천\n' ||
   E'• 헤드셋 — 노이즈 캔슬링 (소니/보스/에어팟맥스)\n\n' ||
   E'[도구]\n' ||
   E'• Slack/Discord — 회사용\n' ||
   E'• Notion — 개인 + 팀 문서\n' ||
   E'• Linear/Jira — 이슈 관리\n' ||
   E'• Loom — 화면 녹화 비동기 공유 (글 길어질 때 대체)\n\n' ||
   E'[루틴]\n' ||
   E'• 출근 시간 = 옷 갈아입기 (잠옷 X)\n' ||
   E'• 점심 산책 30분 — 운동 부족 보완\n' ||
   E'• 퇴근 시간 = 노트북 닫기 + 의자에서 일어나기 (의지력으로 분리)\n\n' ||
   E'재택 단점: 동료와의 잡담 결핍. 격주 오프 모임 추천.',
   array['재택 근무','직장인','커리어']),
  ('디자인과',
   '디자이너 + 개발자 협업 시 안 까이는 핸드오프 방법',
   E'디자이너 5년 + 개발자랑 협업하면서 정착한 핸드오프 규칙.\n\n' ||
   E'[Figma 셋업]\n' ||
   E'• Auto Layout 적극 사용 — 개발자가 CSS Flex/Grid 그대로 구현 가능\n' ||
   E'• 컬러는 변수로 — Tokens Studio 플러그인으로 코드 토큰 export\n' ||
   E'• 타이포그래피도 변수 — h1/h2/body/caption 으로 통일\n\n' ||
   E'[명세]\n' ||
   E'• 상태 (default/hover/active/disabled) 전부 제공\n' ||
   E'• 빈 상태 + 로딩 상태 + 에러 상태 빠뜨리지 말기\n' ||
   E'• 반응형 breakpoint 명시 (mobile/tablet/desktop)\n\n' ||
   E'[커뮤니케이션]\n' ||
   E'• Slack 보다 Figma 코멘트 — 컨텍스트가 화면에 붙어 있음\n' ||
   E'• 변경사항 = 새 페이지 + 변경 로그. 기존 페이지 덮어쓰지 말기\n' ||
   E'• 핸드오프 미팅 30분 — 디자이너가 설명, 개발자가 질문\n\n' ||
   E'팁: 개발자한테 "디자인 의도" 한 줄 적어두면 구현 단계 거의 안 까임.',
   array['UI/UX','직장인','커리어']),
  ('경영학과',
   '직장인 영어 회화 — 실제로 늘었던 방법 비교',
   E'토익 900 / 회화 0 였던 직장인이 1년 만에 영어 미팅 가능해진 과정.\n\n' ||
   E'[효과 좋았던 순서]\n' ||
   E'1. 화상 1:1 — 카탈리스트/링글, 월 30~50만원. 6개월 만에 자신감 큼\n' ||
   E'2. 영어 회의 시뮬레이션 스터디 — 직장인 4명, 본인 회사 케이스로 발표\n' ||
   E'3. 영어 팟캐스트 + Shadowing — 무료, 출퇴근 시간 활용\n' ||
   E'4. 영어 일기 — ChatGPT 첨삭 무료, 5분/일\n\n' ||
   E'[효과 적음]\n' ||
   E'• 단순 영드 시청 — 그냥 즐길 뿐 늘진 않음\n' ||
   E'• 학원 그룹 수업 — 인원 많아서 발화 시간 거의 없음\n' ||
   E'• 토익/토스 점수 공부 — 회화엔 거의 무관\n\n' ||
   E'직장인 영어 회화 스터디 글 자주 올라옵니다. 평일 저녁 화상 위주 추천.',
   array['영어 회화','직장인 스터디','직장인']);

do $$
declare
  ip          _demo_info_posts%rowtype;
  v_author    uuid;
  v_post_id   bigint;
  v_tag_id    bigint;
  v_tag_name  text;
  v_created   timestamptz;
begin
  for ip in select * from _demo_info_posts loop
    v_author := null;
    if random() < 0.8 then
      select user_id into v_author
        from _demo_users where dept = ip.dept and is_ghost
        order by random() limit 1;
    end if;
    if v_author is null then
      select user_id into v_author
        from _demo_users where dept = ip.dept
        order by random() limit 1;
    end if;
    if v_author is null then continue; end if;

    v_created := now() - (floor(random()*60)::int) * interval '1 day';

    insert into public.posts (
      category, sub_category, title, content,
      capacity, status, period, deadline, author_id, created_at
    ) values (
      'COMMUNITY', '정보공유', ip.title, ip.content,
      null, 'GENERAL', null, null, v_author, v_created
    ) returning id into v_post_id;

    foreach v_tag_name in array ip.tag_names loop
      select id into v_tag_id from public.tags where name = v_tag_name limit 1;
      if v_tag_id is not null then
        insert into public.post_tags (post_id, tag_id) values (v_post_id, v_tag_id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;
end $$;

-- ─── 7) 새 게시글에 지원/멤버 (cross-dept 활성화) ──────────────────
do $$
declare
  p          record;
  v_n        int;
  v_member   uuid;
  v_status   text;
begin
  for p in
    select distinct po.id as post_id, po.category, po.status, po.author_id
    from public.posts po
    join public.post_tags pt on pt.post_id = po.id
    join public.tags tg on tg.id = pt.tag_id
    where po.category <> 'COMMUNITY'
      and po.created_at > now() - interval '30 days'
      and tg.name in (
        '직장인 스터디','영어 회화','데이터 분석','투자/재테크','이직 준비',
        '사이드 프로젝트','부업','프리랜서 협업','이직 포트폴리오',
        '직장인 네트워킹','평일 저녁 모임','직무 멘토링','주말 클래스',
        '학과 연합'
      )
  loop
    v_n := 1 + floor(random()*6)::int;
    for v_i in 1..v_n loop
      -- cross-dept 매칭 의도적으로: 작성자와 다른 학과 사용자 우선
      select user_id into v_member
        from _demo_users
        where user_id <> p.author_id
        order by random() limit 1;
      if v_member is null then continue; end if;

      v_status := case
        when p.status in ('COMPLETE','FINISHED') then
          (array['ACCEPTED','ACCEPTED','ACCEPTED','REJECTED'])[1+floor(random()*4)::int]
        else
          (array['PENDING','PENDING','ACCEPTED','REJECTED'])[1+floor(random()*4)::int]
      end;

      begin
        insert into public.applications (post_id, user_id, introduction, status, created_at)
        values (
          p.post_id, v_member,
          (array[
            '직장 다니면서 평일 저녁/주말 가능합니다.',
            '학과는 다르지만 관련 경험 있어요. 함께하고 싶습니다.',
            '이직 준비 중인데 사이드로 참여하고 싶어요.',
            '직장인이라 빡빡한 일정은 어려운데 정해진 시간엔 꼭 참여 가능합니다.',
            '비슷한 경험 있어서 도움 드릴 수 있을 것 같아요.',
            '시간 약속 잘 지키고 책임감 있게 할게요.'
          ])[1+floor(random()*6)::int],
          v_status,
          now() - (floor(random()*30)::int) * interval '1 day'
        );
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

-- ─── 8) 댓글 보강 (직장인 + cross-dept 새 게시글) ──────────────────
do $$
declare
  p           record;
  v_n         int;
  v_commenter uuid;
  v_text      text;
  v_root_id   bigint;
begin
  for p in
    select distinct po.id as post_id, po.category, po.author_id
    from public.posts po
    join public.post_tags pt on pt.post_id = po.id
    join public.tags tg on tg.id = pt.tag_id
    where po.created_at > now() - interval '30 days'
      and tg.name in (
        '직장인 스터디','이직 준비','사이드 프로젝트','부업','직장인 네트워킹',
        '재택 근무','커리어','이직','학과 연합','이직 포트폴리오'
      )
  loop
    v_n := floor(random()*5)::int;
    for v_i in 1..v_n loop
      select user_id into v_commenter from _demo_users order by random() limit 1;
      if v_commenter is null then continue; end if;

      v_text := case p.category
        when 'COMMUNITY' then (array[
          '직장인이라 이런 정보 너무 감사합니다. 저장!',
          '이직 준비하고 있는데 큰 도움 됐어요.',
          '저는 다른 분야인데 비슷한 패턴이네요. 공유 감사합니다.',
          '재택 1년차인데 공감 100%입니다.',
          '본업이랑 부업 병행 고민 중인데 참고 잘 됐습니다.'
        ])[1+floor(random()*5)::int]
        else (array[
          '직장 다니는 중인데 평일 저녁만 가능해요. 참여 가능할까요?',
          '학과/직무 다른데 함께 해도 될까요?',
          '이직 준비 중인데 이 모임 잘 맞을 것 같아요. 신청합니다.',
          '온라인 비중은 어느 정도인가요?',
          '시간 약속 잘 지키는 직장인입니다, 함께하고 싶어요.',
          '회비/재료비 1/N 인가요? 진행 방식 궁금합니다.'
        ])[1+floor(random()*6)::int]
      end;

      insert into public.comments (post_id, user_id, content, created_at)
      values (p.post_id, v_commenter, v_text, now() - (floor(random()*20)::int) * interval '1 day')
      returning id into v_root_id;

      if random() < 0.3 then
        insert into public.comments (post_id, user_id, parent_id, content, created_at)
        values (
          p.post_id, p.author_id, v_root_id,
          (array[
            '직장인 환영입니다! 평일 저녁 시간 위주로 운영해요.',
            '학과/직무 무관하게 OK 입니다 :)',
            '온라인 70% / 오프라인 30% 정도로 진행 예정입니다.',
            '관심 있으시면 지원 폼 작성해 주세요!',
            '구체적인 일정은 첫 모임에서 함께 정합니다.'
          ])[1+floor(random()*5)::int],
          now() - (floor(random()*10)::int) * interval '1 day'
        );
      end if;
    end loop;
  end loop;
end $$;

-- ─── 9) 검색어 보강 (직장인 + cross-dept 키워드) ────────────────────
do $$
declare
  v_hot_terms text[] := array[
    '이직','이직 준비','직장인','사이드 프로젝트','부업','재택 근무',
    '커리어','주니어 직장인','직장인 스터디','이직 포트폴리오',
    '학과 연합','평일 저녁 모임','직무 멘토링','영어 회화','데이터 분석'
  ];
  v_term      text;
begin
  for v_i in 1..300 loop
    if random() < 0.75 then
      v_term := v_hot_terms[1 + floor(random()*array_length(v_hot_terms,1))::int];
    else
      select name into v_term from public.tags
      where name = any(v_hot_terms) order by random() limit 1;
    end if;
    if v_term is null then continue; end if;
    perform public.record_search(v_term);
  end loop;

  update public.search_terms
     set last_searched_at = now() - (floor(random()*45)::int) * interval '1 minute'
   where term = any(v_hot_terms)
     and random() < 0.7;
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════
-- 끝나면 임베딩 백필 다시 실행:
--   node --env-file=.env.local scripts/backfill-embeddings.mjs
-- ═══════════════════════════════════════════════════════════════════
