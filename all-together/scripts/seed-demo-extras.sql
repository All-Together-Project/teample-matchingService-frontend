-- ═════════════════════════════════════════════════════════════════════
-- AllTogether — 추가 시드 (조리학과 신규 + 음악 보강)
--
-- 본 파일은 seed-demo-data.sql 다음에 실행하는 추가 시드입니다.
-- 단독 실행도 가능 (필요 태그/임시 테이블을 자체 생성).
--
-- 추가 내용:
--   * 조리학과 신규 카테고리 — 학과별 페르소나에 1개 더 추가
--   * 요리 관련 신규 태그 (한식/양식/일식/중식/베이킹 등)
--   * 조리학과 학생들의 STUDY/PROJECT/MEETUP/COMMUNITY 게시글
--   * 음악 보강 — 취미 음악, 음악 감상, 인디 활동 등 비-학과 관점
--   * 요리/음악 관련 풍부한 정보 게시글 (자취 요리, 인디 음악 활동 등)
--
-- 사용법:
--   Supabase Dashboard → SQL Editor → 본 파일 전체 붙여넣고 RUN
--   끝나면 backfill-embeddings.mjs 다시 한 번 실행
-- ═════════════════════════════════════════════════════════════════════

begin;

-- ─── 1) 추가 태그 (있으면 skip) ──────────────────────────────────────
insert into public.tags (name, category) values
  -- 조리학과
  ('한식', 'STUDY'), ('양식', 'STUDY'), ('일식', 'STUDY'), ('중식', 'STUDY'),
  ('베이킹', 'STUDY'), ('디저트', 'STUDY'), ('바리스타', 'STUDY'),
  ('메뉴 개발', 'PROJECT'), ('케이터링', 'PROJECT'), ('푸드 스타일링', 'PROJECT'),
  ('쿠킹 클래스', 'MEETUP'), ('맛집 탐방', 'MEETUP'), ('와인 클래스', 'MEETUP'),
  -- 음악 보강 (학과 외 취미/감상)
  ('인디 음악', 'STUDY'), ('음향 엔지니어링', 'STUDY'),
  ('버스킹', 'PROJECT'), ('앨범 발매', 'PROJECT'),
  ('라이브 공연 관람', 'MEETUP'), ('음악 페스티벌', 'MEETUP'),
  -- 공통
  ('자취 요리', 'GENERAL'), ('식단 관리', 'GENERAL'), ('홈카페', 'GENERAL')
on conflict (name, category) do nothing;

-- ─── 2) 사용자 풀 재구성 (이전 시드 _demo_users 가 COMMIT 시 DROP 됐으므로) ──
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
  -- 9개로 분배 (기존 8 + 조리학과)
  (array[
    '무용과','디자인과','컴퓨터공학과','뷰티과',
    '경영학과','영상과','음악과','패션디자인과','조리학과'
  ])[(abs(hashtext(u.id::text || 'cook')) % 9) + 1]
from public.users u
where u.id not in (select id from showcase_ids);

create index on _demo_users(dept);
create index on _demo_users(is_ghost);

-- ─── 2-1) 조리학과 학생들에게 user_tags 부여 ────────────────────────
do $$
declare
  u           record;
  v_tag_id    bigint;
  v_target    int;
  v_dept_tags text[];
begin
  -- 조리학과
  v_dept_tags := array['한식','양식','일식','중식','베이킹','디저트','바리스타','메뉴 개발','케이터링','쿠킹 클래스','맛집 탐방','자취 요리','대학생'];
  for u in select user_id from _demo_users where dept = '조리학과' loop
    v_target := 3 + floor(random()*3)::int;
    for v_tag_id in
      select t.id from public.tags t
      where t.name = any(v_dept_tags)
      order by random() limit v_target
    loop
      insert into public.user_tags (user_id, tag_id) values (u.user_id, v_tag_id)
      on conflict (user_id, tag_id) do nothing;
    end loop;
  end loop;

  -- 일반 사용자 중 20% 에게 '자취 요리' 관심 추가 (학과 무관 공통 관심사)
  for u in
    select user_id from _demo_users
    where dept <> '조리학과' and random() < 0.2
  loop
    select id into v_tag_id from public.tags
    where name = '자취 요리' and category = 'GENERAL' limit 1;
    if v_tag_id is not null then
      insert into public.user_tags (user_id, tag_id) values (u.user_id, v_tag_id)
      on conflict (user_id, tag_id) do nothing;
    end if;
  end loop;
end $$;

-- ─── 3) 게시글 템플릿 (조리학과 + 음악 보강) ──────────────────────
create temp table _demo_templates (
  dept text,
  category text,
  sub_category text,
  title_base text,
  content_base text,
  tag_names text[]
) on commit drop;

insert into _demo_templates values
  -- ── 조리학과 (신규) ───────────────────────────────────────────────
  ('조리학과','STUDY','자격증/시험','한식조리기능사 스터디',
   '필기 + 실기 같이 준비하실 분 모집. 매주 1회 실습, 시험 직전 모의 실기.', array['한식']),
  ('조리학과','STUDY','기타 학습','베이킹 기초 클래스',
   '홈베이킹 4주 코스. 빵/쿠키/케이크/타르트 매주 1가지. 재료비 1/N.', array['베이킹','디저트']),
  ('조리학과','STUDY','기타 학습','커피 추출 스터디',
   '에스프레소 + 드립 추출법 같이 익혀요. 학교 카페 머신 사용 가능.', array['바리스타','홈카페']),
  ('조리학과','PROJECT','기타 협업','학과 발표회 케이터링 팀',
   '발표회 당일 핑거푸드 + 음료 준비. 메뉴 기획부터 당일 운영까지.', array['케이터링','메뉴 개발','학과 연합','발표 준비']),
  ('조리학과','PROJECT','창업/사이드','학생 식당 신메뉴 개발',
   '학교 식당 협업 - 학생 의견 반영 신메뉴 1가지 개발 + 실제 운영 테스트.', array['메뉴 개발','대학생']),
  ('조리학과','PROJECT','디자인','푸드 화보 촬영',
   '뷰티/영상과 협업 푸드 화보. 메뉴 개발 + 플레이팅 + 촬영 1세트.', array['푸드 스타일링','케이터링','학과 연합']),
  ('조리학과','MEETUP','취미/문화','신메뉴 시식 모임',
   '매월 마지막 토요일, 각자 만든 신메뉴 1가지 가져와서 시식 + 피드백.', array['쿠킹 클래스','맛집 탐방']),
  ('조리학과','MEETUP','밥약/번개','학교 근처 맛집 탐방',
   '격주 금요일 저녁, 학교 주변 신상 + 숨은 맛집 같이 탐방. 5명 정도.', array['맛집 탐방','대학생']),
  ('조리학과','COMMUNITY','후기','졸업작품 양식 코스 회고',
   '졸업작품으로 양식 7코스 메뉴 짠 후기. 재료 단가 + 시간 + 실패 정리.', array['양식','메뉴 개발']),
  ('조리학과','COMMUNITY','Q&A','조리 자격증 순서 추천?',
   '한식/양식/일식/중식 어떤 순서로 따는 게 좋을지 선배님들 조언 부탁드려요.', array['한식','양식','일식','중식']),
  -- ── 음악 보강 (취미/인디 활동, 비-학과 관점) ─────────────────────
  ('음악과','STUDY','기타 학습','음향 엔지니어링 입문 스터디',
   'DAW + 마이킹 + 믹싱 기초. 학생 공연/영상 작업에 바로 쓸 만큼만.', array['음향 엔지니어링','작곡']),
  ('음악과','PROJECT','창업/사이드','인디 EP 공동 제작',
   '학과 무관, 인디 음악 좋아하는 사람들 모여서 EP 4곡 공동 작/편곡. 발매까지.', array['인디 음악','앨범 발매','작곡']),
  ('음악과','PROJECT','기타 협업','정기 버스킹 팀',
   '주말 홍대/신촌 버스킹 정기 팀. 보컬/기타/카혼/베이스 모집.', array['버스킹','보컬','합주']),
  ('음악과','MEETUP','취미/문화','인디 공연 같이 보러 가요',
   '월 1~2회 인디 공연/라이브 같이 관람. 공연 후 카페에서 잡담.', array['라이브 공연 관람','인디 음악']),
  ('음악과','MEETUP','취미/문화','음악 페스티벌 동행',
   '여름 펜타포트/잔다리/지산 같이 갈 사람. 텐트 + 차량 1/N.', array['음악 페스티벌']);

-- ─── 4) 게시글 인서트 (템플릿당 5변주) ───────────────────────────
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
  regions text[] := array['강남','홍대','신촌','성수','잠실','안암','광화문','여의도','서면','학교 근처','캠퍼스','온라인'];
  seasons text[] := array['이번 학기','여름방학','겨울방학','상반기','하반기','시즌2','발표회 시즌'];
  periods text[] := array['1개월','2개월','3개월','6개월','단기','시즌제','상시','학기 말까지'];
  tones   text[] := array['주 1회','주 2회','평일 저녁','주말','온라인 위주','오프라인 중심'];
begin
  for t in select * from _demo_templates loop
    for v_variant in 1..5 loop
      -- 작성자: 80% 같은 학과 유령계정 우선, 없으면 일반 풀
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
        v_capacity := null;
        v_period := null;
        v_deadline := null;
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
        || format('학과: %s 위주, 타과생도 환영합니다.', t.dept) || chr(10)
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

-- ─── 5) 요리/음악 정보공유 게시글 ────────────────────────────────────
create temp table _demo_info_posts (
  dept text,
  title text,
  content text,
  tag_names text[]
) on commit drop;

insert into _demo_info_posts values
  ('조리학과',
   '자취생 일주일 5만원 식단 짜는 법',
   E'4학기째 자취 중인 조리과 학생이 짠 실전 식단표.\n\n' ||
   E'[원칙]\n' ||
   E'• 단백질 1 + 탄수화물 1 + 채소 1 = 한 끼\n' ||
   E'• 주말 미리 손질 → 평일 5분 조리\n' ||
   E'• 냉동 보관 가능한 메뉴 위주 (소분 후 밀폐)\n\n' ||
   E'[장보기 (주 1회, 약 2.5만원)]\n' ||
   E'• 닭가슴살 1kg, 두부 2모, 계란 10구\n' ||
   E'• 양파/당근/대파/시금치 (1주분)\n' ||
   E'• 쌀 + 잡곡, 김, 김치\n\n' ||
   E'[추천 메뉴]\n' ||
   E'• 월: 계란말이 + 시금치무침 + 김밥\n' ||
   E'• 화: 닭가슴살 데리야끼 + 야채볶음\n' ||
   E'• 수: 두부조림 + 콩나물국\n' ||
   E'• 목: 계란김치볶음밥\n' ||
   E'• 금: 닭가슴살 샐러드 (남은 야채 활용)\n\n' ||
   E'기숙사 인덕션만 있어도 가능. 전자레인지 활용 팁은 댓글로.',
   array['자취 요리','식단 관리','대학생']),
  ('조리학과',
   '학교 근처 도매 식자재 마트 정리',
   E'전공 실습 + 동아리 케이터링 할 때 단가 줄이는 도매 매장 정리.\n\n' ||
   E'[권역별]\n' ||
   E'• 노량진 수산시장 — 회/생선 최저가, 아침 7~9시 가장 쌈\n' ||
   E'• 마장동 축산물시장 — 정육 도매, 5kg 단위면 마트 50% 가격\n' ||
   E'• 양재 농수산물도매시장 — 채소/과일, 박스 단위 구매\n' ||
   E'• 방산시장 — 베이킹 재료 + 포장재, 동아리 단가 작업에 결정적\n\n' ||
   E'[팁]\n' ||
   E'• 학생증 보여주면 디씨 주는 매장 의외로 많음\n' ||
   E'• 새벽 시장은 5~8시가 신선도 + 가격 모두 베스트\n' ||
   E'• 결제: 현금이 카드보다 약 3% 싸게 매김 (관행)\n\n' ||
   E'졸업 작품 + 케이터링 팀은 방산시장이 가장 가성비 좋음. 단체 구매 시 50%까지 가능.',
   array['메뉴 개발','케이터링','대학생']),
  ('조리학과',
   '조리 자격증 따는 순서 추천 (현직 셰프 조언 정리)',
   E'2년차 호텔 셰프 사촌형한테 들은 자격증 따는 순서 정리.\n\n' ||
   E'[추천 순서]\n' ||
   E'1) 한식조리기능사 — 가장 기본, 칼질 + 기초 다지기\n' ||
   E'2) 양식조리기능사 — 한식 후 바로. 동작 패턴 비슷해서 효율적\n' ||
   E'3) 제과/제빵기능사 — 디저트 라인 가고 싶으면 필수\n' ||
   E'4) 일식 or 중식조리기능사 — 진로에 따라 선택\n' ||
   E'5) 조리산업기사 (2년 경력 후) — 호텔/대형 매장 가려면 필수\n\n' ||
   E'[실기 팁]\n' ||
   E'• 실기는 시간이 전부 — 25분 내 1메뉴 완성\n' ||
   E'• 학원보다 학과 실습실 + 친구끼리 모의 시험이 더 효과적\n' ||
   E'• 칼은 본인 것만 쓰기 — 손에 익으면 시간 5분 단축\n\n' ||
   E'호텔/레스토랑 가려면 자격증 4개 + 실무경험 2년 정도가 면접 합격선.',
   array['한식','양식','일식','중식','취업 준비']),
  ('음악과',
   '인디 뮤지션이 알아야 할 음원 발매 플랫폼 정리',
   E'학생 신분으로 EP 발매하면서 비교해본 플랫폼 정리.\n\n' ||
   E'[총정리 — 추천 순]\n' ||
   E'• DistroKid — 연 22달러, 음원 무제한 등록. 가장 저렴\n' ||
   E'• TuneCore — 곡당 9.99달러/년, 100% 수익 정산\n' ||
   E'• CD Baby — 곡당 9.95달러 1회 결제, 평생 등록\n' ||
   E'• 멜론 직접 등록 — 한국 한정, 수수료 약간 + 정산 빠름\n\n' ||
   E'[유통 범위]\n' ||
   E'• 멜론/지니/벅스/플로 → 한국\n' ||
   E'• 스포티파이/애플뮤직/유튜브뮤직 → 글로벌\n' ||
   E'• 위 4곳 다 가려면 DistroKid가 가장 편함\n\n' ||
   E'[메타데이터]\n' ||
   E'• ISRC 코드 = 음원 고유 식별자. 플랫폼이 자동 발급\n' ||
   E'• 작사/작곡 크레딧 정확히 입력 — 후속 수익 정산에 결정적\n\n' ||
   E'학생 첫 발매라면 DistroKid 추천. 다음 해 갱신 안 하면 음원 내려가는 거 주의.',
   array['앨범 발매','인디 음악','작곡']),
  ('음악과',
   '학생 밴드/공연 팀 음향 장비 대여 정리',
   E'학생 공연 + 버스킹 + 합주실 운영 경험에서 정리한 장비 대여처.\n\n' ||
   E'[학교 내]\n' ||
   E'• 음악관 합주실 — 예약제 무료, 드럼 + 앰프 + PA 기본\n' ||
   E'• 학생회관 무대 — 학생 공연 시 무료 대여, 1주 전 신청\n\n' ||
   E'[외부 대여]\n' ||
   E'• 낙원상가 — 마이크 + 케이블 일 단위 대여, 학생증 디씨\n' ||
   E'• 백화점음향 (홍대) — 버스킹용 휴대 PA 일 1.5만원\n' ||
   E'• KT&G 상상마당 — 무대 셋업 통째로 대여 가능, 학생 50% 할인\n\n' ||
   E'[구매 추천 (가성비)]\n' ||
   E'• Bose S1 Pro — 버스킹 만능, 100만원대\n' ||
   E'• Shure SM58 — 보컬 마이크 표준, 중고 5만원대\n' ||
   E'• 휴대용 미니 믹서 (Behringer Q502USB) — 8만원대\n\n' ||
   E'합주실 운영하려면 PA 1세트 + 마이크 3~4개 + 케이블 5개면 시작 가능. 약 200만원.',
   array['버스킹','합주','공연 프로젝트']),
  ('음악과',
   '학생도 갈 만한 음악 페스티벌 + 무료/할인 정보',
   E'4년간 다닌 페스티벌 + 학생 할인 정리.\n\n' ||
   E'[봄/여름]\n' ||
   E'• 그린플러그드 — 5월, 학생 할인 15%, 라인업 인디 강세\n' ||
   E'• 펜타포트 — 7월 인천, 1일권 학생 20% 할인\n' ||
   E'• 부산국제록페스티벌 — 9월, 무료 (지자체 지원)\n\n' ||
   E'[가을/겨울]\n' ||
   E'• 잔다리페스타 — 10월 홍대, 학생증 50% 할인\n' ||
   E'• DMC 페스티벌 — 11월 마포, 무료 야외 공연\n\n' ||
   E'[팁]\n' ||
   E'• 얼리버드 2개월 전 — 정가의 40%까지 저렴\n' ||
   E'• 단체 (4인 이상) 추가 할인 가능한 페스티벌 다수\n' ||
   E'• 캠핑 가능 페스티벌은 텐트/타프 학교 동아리 대여 가능\n\n' ||
   E'페스티벌 같이 가실 분 자유게시판에 글 올라오니 거기서 매칭 추천.',
   array['음악 페스티벌','라이브 공연 관람','대학생']);

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

-- ─── 6) 지원 + 멤버 (요리/음악 새 게시글 한정) ──────────────────────
do $$
declare
  p          record;
  v_n        int;
  v_member   uuid;
  v_status   text;
begin
  -- 본 시드에서 새로 생성된 게시글: created_at 90일 이내 + 본 시드 태그 보유 글
  for p in
    select distinct po.id as post_id, po.category, po.status, po.author_id
    from public.posts po
    join public.post_tags pt on pt.post_id = po.id
    join public.tags tg on tg.id = pt.tag_id
    where po.category <> 'COMMUNITY'
      and po.created_at > now() - interval '120 days'
      and tg.name in (
        '한식','양식','일식','중식','베이킹','디저트','바리스타',
        '메뉴 개발','케이터링','푸드 스타일링','쿠킹 클래스','맛집 탐방',
        '음향 엔지니어링','버스킹','앨범 발매','인디 음악',
        '라이브 공연 관람','음악 페스티벌'
      )
  loop
    v_n := 1 + floor(random()*6)::int;
    for v_i in 1..v_n loop
      select user_id into v_member from _demo_users
        where user_id <> p.author_id order by random() limit 1;
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
            '안녕하세요! 관심 있어서 지원합니다.',
            '관련 경험은 적지만 진심으로 임할게요.',
            '꾸준히 참여 가능합니다.',
            '학과는 다른데 함께 하고 싶어요.',
            '시간 약속 잘 지키고 책임감 있게 할게요.'
          ])[1+floor(random()*5)::int],
          v_status,
          now() - (floor(random()*60)::int) * interval '1 day'
        );
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

-- ─── 7) FINISHED 게시글 리뷰 (조리/음악 보강) ──────────────────────
do $$
declare
  p             record;
  v_review_id   bigint;
  v_item        record;
  v_score       int;
  v_member_arr  uuid[];
  v_i           int;
  v_j           int;
begin
  for p in
    select distinct po.id as post_id, po.category, po.author_id
    from public.posts po
    join public.post_tags pt on pt.post_id = po.id
    join public.tags tg on tg.id = pt.tag_id
    where po.status = 'FINISHED'
      and po.category in ('STUDY','PROJECT','MEETUP')
      and tg.name in (
        '한식','양식','베이킹','메뉴 개발','케이터링',
        '버스킹','앨범 발매','인디 음악','음향 엔지니어링'
      )
  loop
    select array_agg(user_id) into v_member_arr
    from public.post_members where post_id = p.post_id;
    if v_member_arr is null or array_length(v_member_arr,1) < 2 then continue; end if;

    for v_i in 1..array_length(v_member_arr,1) loop
      for v_j in 1..array_length(v_member_arr,1) loop
        if v_i = v_j or random() > 0.45 then continue; end if;

        begin
          insert into public.reviews (post_id, evaluator_id, target_id, comment, created_at)
          values (
            p.post_id, v_member_arr[v_i], v_member_arr[v_j],
            (array[
              '협업 잘 되고 손이 빨라서 큰 도움 됐어요.',
              '아이디어 적극적으로 내주셔서 메뉴/곡 풍부해졌습니다.',
              '시간 약속 잘 지키시고 위생/장비 챙김 좋습니다.',
              '맡은 부분 책임감 있게 잘 해주셨습니다.',
              '함께 작업하면서 많이 배웠어요.'
            ])[1+floor(random()*5)::int],
            now() - (floor(random()*30)::int) * interval '1 day'
          ) returning id into v_review_id;
        exception when unique_violation then continue;
        end;

        for v_item in
          select id from public.review_items where category = p.category order by sort_order
        loop
          v_score := 3 + (case
            when random() < 0.05 then 0
            when random() < 0.55 then 1
            when random() < 0.95 then 2
            else -1
          end);
          v_score := greatest(1, least(5, v_score));
          insert into public.review_scores (review_id, item_id, score)
          values (v_review_id, v_item.id, v_score);
        end loop;

        perform public.apply_review_temperature(v_review_id);
      end loop;
    end loop;
  end loop;
end $$;

-- ─── 8) 댓글 (새 게시글에 한정) ─────────────────────────────────────
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
    where po.created_at > now() - interval '90 days'
      and tg.name in (
        '한식','양식','일식','중식','베이킹','디저트','바리스타',
        '메뉴 개발','케이터링','쿠킹 클래스','맛집 탐방','자취 요리',
        '음향 엔지니어링','버스킹','앨범 발매','인디 음악',
        '라이브 공연 관람','음악 페스티벌'
      )
  loop
    v_n := floor(random()*5)::int;
    for v_i in 1..v_n loop
      select user_id into v_commenter from _demo_users order by random() limit 1;
      if v_commenter is null then continue; end if;

      v_text := case p.category
        when 'COMMUNITY' then (array[
          '오 이거 진짜 유용한데요? 저장합니다.',
          '저도 비슷한 경험 있는데 추가로 ㅇㅇ 도 추천드려요.',
          '학생 입장에서 진짜 도움 되는 글이에요. 감사합니다.',
          '혹시 댓글로 더 추천 메뉴/곡 공유 가능할까요?',
          '저는 다른 방법으로 했는데 이게 더 효율적이네요.'
        ])[1+floor(random()*5)::int]
        else (array[
          '관심 있는데 자리 남았나요?',
          '학과 다른데 참여 가능할까요?',
          '시간 약속 잘 지킬 수 있습니다, 지원하고 싶어요.',
          '초보자도 가능한지 궁금합니다.',
          '재료비/회비는 1/N 인가요?',
          '진행 장소 한 번 더 알려주실 수 있나요?'
        ])[1+floor(random()*6)::int]
      end;

      insert into public.comments (post_id, user_id, content, created_at)
      values (p.post_id, v_commenter, v_text, now() - (floor(random()*30)::int) * interval '1 day')
      returning id into v_root_id;

      if random() < 0.3 then
        insert into public.comments (post_id, user_id, parent_id, content, created_at)
        values (
          p.post_id, p.author_id, v_root_id,
          (array[
            '네 자리 남았어요! 지원 폼 부탁드려요.',
            '학과 무관하게 환영합니다 :)',
            '초보자도 OK 입니다, 부담 없이 오세요.',
            '회비는 1/N 이고 재료비만 별도예요.',
            '자세한 위치는 메시지로 안내드릴게요.'
          ])[1+floor(random()*5)::int],
          now() - (floor(random()*15)::int) * interval '1 day'
        );
      end if;
    end loop;
  end loop;
end $$;

-- ─── 9) 실시간 검색어 보강 (요리/음악 키워드) ──────────────────────
do $$
declare
  v_hot_terms text[] := array[
    '베이킹','자취 요리','맛집 탐방','한식조리기능사','케이터링',
    '바리스타','메뉴 개발','음향 엔지니어링','버스킹','인디 음악',
    '앨범 발매','음악 페스티벌','홈카페','디저트'
  ];
  v_term      text;
begin
  for v_i in 1..200 loop
    if random() < 0.75 then
      v_term := v_hot_terms[1 + floor(random()*array_length(v_hot_terms,1))::int];
    else
      select name into v_term from public.tags
      where name = any(v_hot_terms) order by random() limit 1;
    end if;
    if v_term is null then continue; end if;
    perform public.record_search(v_term);
  end loop;

  -- 최근 1시간 윈도우에 잡히도록 절반 정도는 last_searched_at 당김
  update public.search_terms
     set last_searched_at = now() - (floor(random()*45)::int) * interval '1 minute'
   where term = any(v_hot_terms)
     and random() < 0.6;
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════
-- 끝나면 임베딩 백필 다시 실행:
--   node --env-file=.env.local scripts/backfill-embeddings.mjs
-- ═══════════════════════════════════════════════════════════════════
