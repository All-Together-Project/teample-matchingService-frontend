-- ═════════════════════════════════════════════════════════════════════
-- AllTogether — 발표 시연용 대량 데모 시드 (학과별 페르소나 기반)
--
-- 무엇을 생성하나:
--   * 8개 학과 (무용과/디자인과/컴퓨터공학과/뷰티과/경영학과/영상과/음악과/패션디자인과) 페르소나
--   * 학과별로 STUDY/PROJECT/MEETUP/COMMUNITY 게시글 다수
--   * 모집중(RECRUITING) + 완료(COMPLETE) + 종료(FINISHED) 자연 분포
--   * 게시글에 학과별 태그 매핑
--   * 다른 학과 학생도 일부 지원 (협업 시뮬레이션)
--   * FINISHED 게시글에 리뷰 + review_scores → 매너온도 자동 반영
--   * 일부 게시글에 댓글/Q&A
--   * 실시간 검색어 (search_terms) 백필
--
-- 무엇을 안 하나:
--   * embedding(vector(768))은 채우지 않음 — 의미 있는 임베딩은 Gemini 모델이 만들어야 함
--     끝나고 다음을 한 번만 실행:
--       node --env-file=.env.local scripts/backfill-embeddings.mjs
--   * auth.users 신규 생성 안 함 — 기존 users 풀을 학과로 분배해서 사용
--
-- 사용법:
--   1) Supabase Dashboard → SQL Editor → New query
--   2) 본 파일 전체 붙여넣기 → RUN
--   3) 끝나면 위 backfill 스크립트 1회 실행 → AI 검색 동작
--
-- 멱등성:
--   * 재실행하면 같은 형식 게시글이 또 추가됨 (의도). 한 번에 원하는 양 정하고 실행.
--   * 단, 리뷰는 (post,evaluator,target) UNIQUE 라 중복은 자동 skip.
-- ═════════════════════════════════════════════════════════════════════

begin;

-- ─── 1) 학과별 태그 인서트 (있으면 skip) ─────────────────────────────
insert into public.tags (name, category) values
  -- 무용과
  ('발레', 'STUDY'), ('컨템포러리', 'STUDY'), ('한국무용', 'STUDY'), ('재즈댄스', 'STUDY'),
  ('안무 창작', 'PROJECT'), ('공연 기획', 'PROJECT'), ('무용 워크숍', 'MEETUP'),
  -- 디자인과
  ('UI/UX', 'STUDY'), ('그래픽 디자인', 'STUDY'), ('타이포그래피', 'STUDY'),
  ('브랜딩', 'PROJECT'), ('일러스트', 'PROJECT'), ('포트폴리오', 'GENERAL'),
  ('디자인 크리틱', 'MEETUP'),
  -- 컴퓨터공학과
  ('알고리즘', 'STUDY'), ('백엔드', 'STUDY'), ('프론트엔드', 'STUDY'), ('AI/ML', 'STUDY'),
  ('웹 개발', 'PROJECT'), ('앱 개발', 'PROJECT'), ('해커톤', 'PROJECT'),
  ('개발자 네트워킹', 'MEETUP'),
  -- 뷰티과
  ('메이크업', 'STUDY'), ('헤어 스타일링', 'STUDY'), ('네일아트', 'STUDY'), ('스킨케어', 'STUDY'),
  ('뷰티 화보', 'PROJECT'), ('메이크업 시연', 'MEETUP'),
  -- 경영학과
  ('마케팅', 'STUDY'), ('재무회계', 'STUDY'), ('컨설팅 케이스', 'STUDY'),
  ('스타트업', 'PROJECT'), ('비즈니스 공모전', 'PROJECT'), ('창업 네트워킹', 'MEETUP'),
  -- 영상과
  ('영상 편집', 'STUDY'), ('촬영 기법', 'STUDY'), ('시나리오', 'STUDY'),
  ('단편 영화', 'PROJECT'), ('유튜브 콘텐츠', 'PROJECT'), ('영상 크리틱', 'MEETUP'),
  -- 음악과
  ('작곡', 'STUDY'), ('보컬', 'STUDY'), ('합주', 'STUDY'),
  ('밴드 결성', 'PROJECT'), ('공연 프로젝트', 'PROJECT'), ('음악 감상 모임', 'MEETUP'),
  -- 패션디자인과
  ('패턴 제작', 'STUDY'), ('패션 일러스트', 'STUDY'), ('소재 연구', 'STUDY'),
  ('패션쇼', 'PROJECT'), ('의상 제작', 'PROJECT'), ('스타일링 모임', 'MEETUP'),
  -- 공통
  ('발표 준비', 'GENERAL'), ('포트폴리오 점검', 'GENERAL'), ('취업 준비', 'GENERAL'),
  ('대학생', 'GENERAL'), ('학과 연합', 'GENERAL')
on conflict (name, category) do nothing;

-- ─── 2) 작성자 풀 — 유령계정(게시글 없는 사용자) 우선 + 학과 분배 ──
-- 시연용 16명(showcase) 은 backstory 용이므로 제외.
-- '유령계정'(post를 한 번도 작성하지 않은 사용자) 을 우선적으로 작성자 풀로 사용.
-- 나머지 사용자를 8개 학과에 해시 기반 균등 분배.
create temp table _demo_users on commit drop as
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
select
  u.id as user_id,
  u.nickname,
  -- 게시글 작성 이력이 없으면 유령계정 (작성자로 우선 채용)
  not exists (select 1 from public.posts p where p.author_id = u.id) as is_ghost,
  (array[
    '무용과','디자인과','컴퓨터공학과','뷰티과',
    '경영학과','영상과','음악과','패션디자인과'
  ])[(abs(hashtext(u.id::text)) % 8) + 1] as dept
from public.users u
where u.id not in (select id from showcase_ids);

create index on _demo_users(dept);
create index on _demo_users(is_ghost);

-- ─── 2-1) 사용자별 관심 태그(user_tags) 부여 ────────────────────────
-- 각 사용자에게 학과 관련 태그 3~5개 부여 (이미 있으면 skip).
-- 학과별 태그 풀: 학과 시드한 태그 + GENERAL 일부
do $$
declare
  u             record;
  v_tag_id      bigint;
  v_count       int;
  v_target      int;
  v_dept_tags   text[];
begin
  for u in select user_id, dept from _demo_users loop
    -- 학과별 관련 태그 풀 정의
    v_dept_tags := case u.dept
      when '무용과'         then array['발레','컨템포러리','한국무용','재즈댄스','안무 창작','공연 기획','무용 워크숍','발표 준비','대학생']
      when '디자인과'       then array['UI/UX','그래픽 디자인','타이포그래피','브랜딩','일러스트','포트폴리오','디자인 크리틱','발표 준비','대학생']
      when '컴퓨터공학과'   then array['알고리즘','백엔드','프론트엔드','AI/ML','웹 개발','앱 개발','해커톤','개발자 네트워킹','취업 준비','대학생']
      when '뷰티과'         then array['메이크업','헤어 스타일링','네일아트','스킨케어','뷰티 화보','메이크업 시연','포트폴리오','대학생']
      when '경영학과'       then array['마케팅','재무회계','컨설팅 케이스','스타트업','비즈니스 공모전','창업 네트워킹','취업 준비','대학생']
      when '영상과'         then array['영상 편집','촬영 기법','시나리오','단편 영화','유튜브 콘텐츠','영상 크리틱','포트폴리오','대학생']
      when '음악과'         then array['작곡','보컬','합주','밴드 결성','공연 프로젝트','음악 감상 모임','발표 준비','대학생']
      when '패션디자인과'   then array['패턴 제작','패션 일러스트','소재 연구','패션쇼','의상 제작','스타일링 모임','포트폴리오','대학생']
      else array['대학생']
    end;

    v_target := 3 + floor(random()*3)::int;  -- 3~5개
    v_count := 0;
    -- 풀에서 랜덤 v_target 개 뽑아 user_tags 에 추가 (학과 연합 1개 보너스 확률)
    for v_tag_id in
      select t.id from public.tags t
      where t.name = any(v_dept_tags)
      order by random()
      limit v_target
    loop
      insert into public.user_tags (user_id, tag_id)
      values (u.user_id, v_tag_id)
      on conflict (user_id, tag_id) do nothing;
      v_count := v_count + 1;
    end loop;

    -- 30% 확률로 '학과 연합' 태그 추가 (협업 의지 표현)
    if random() < 0.3 then
      select id into v_tag_id from public.tags where name = '학과 연합' and category = 'GENERAL' limit 1;
      if v_tag_id is not null then
        insert into public.user_tags (user_id, tag_id) values (u.user_id, v_tag_id)
        on conflict (user_id, tag_id) do nothing;
      end if;
    end if;
  end loop;
end $$;

-- ─── 3) 학과별 게시글 템플릿 (DO 블록에서 사용) ────────────────────
create temp table _demo_templates (
  dept text,
  category text,
  sub_category text,
  title_base text,
  content_base text,
  tag_names text[]
) on commit drop;

insert into _demo_templates values
  -- 무용과
  ('무용과','STUDY','기타 학습','발레 기초반 함께해요','발레 입문 동작부터 차근차근 함께 익혀보고 싶습니다. 무용과 학생 환영, 타과생도 OK.', array['발레','대학생']),
  ('무용과','STUDY','기타 학습','컨템포러리 즉흥 스터디','매주 컨템포러리 즉흥 작업을 함께 해봐요. 신체 자각과 호흡 위주.', array['컨템포러리','발레']),
  ('무용과','PROJECT','기타 협업','발표회 안무 창작 팀','학과 발표회 공연용 안무 창작 프로젝트. 무용수 + 음악 + 영상 협업.', array['안무 창작','공연 기획','학과 연합']),
  ('무용과','PROJECT','기타 협업','한국무용 융합 작품','전통 + 현대 융합 안무 작품을 함께 만들어요. 의상은 패션과와 협업 예정.', array['한국무용','안무 창작']),
  ('무용과','MEETUP','취미/문화','신체 워크업 모임','매주 토요일 오전, 같이 몸 풀고 스트레칭. 무용과 외 환영.', array['무용 워크숍']),
  ('무용과','COMMUNITY','후기','발표회 끝나고 회고','발표회 마치고 든 생각들. 다음 시즌엔 어떻게 갈지 같이 얘기해요.', array['발표 준비']),
  -- 디자인과
  ('디자인과','STUDY','코딩/개발','Figma 컴포넌트 시스템 스터디','디자인 시스템을 코드 컴포넌트로 변환하는 흐름. 디자이너+개발자 환영.', array['UI/UX','학과 연합']),
  ('디자인과','STUDY','독서','디자인 이론서 같이 읽기','매주 한 챕터씩. 시각 언어, 타이포 위주 이론서 발제 + 토론.', array['타이포그래피','그래픽 디자인']),
  ('디자인과','PROJECT','디자인','학과 발표회 비주얼 디렉팅','발표회 키 비주얼 + 포스터 + 영상 그래픽 통합 디자인.', array['브랜딩','일러스트','발표 준비']),
  ('디자인과','PROJECT','디자인','학교 카페 브랜딩 리뉴얼','캠퍼스 안 학생 카페 브랜딩 무료 리뉴얼 프로젝트.', array['브랜딩','UI/UX']),
  ('디자인과','MEETUP','네트워킹','디자인 크리틱 나잇','격주 금요일 저녁, 서로 포트폴리오 까는 자리. 솔직한 피드백 환영.', array['디자인 크리틱','포트폴리오']),
  ('디자인과','COMMUNITY','Q&A','포트폴리오 리뷰 부탁드려요','졸업 전 포트폴리오 마무리 중인데 한 번 봐주실 분 계실까요?', array['포트폴리오']),
  -- 컴퓨터공학과
  ('컴퓨터공학과','STUDY','코딩/개발','알고리즘 매일 1문제','매일 백준/LeetCode 1문제. 단톡방 인증, 주말 코드 리뷰.', array['알고리즘','대학생']),
  ('컴퓨터공학과','STUDY','코딩/개발','풀스택 로드맵 스터디','React + Node 풀스택 12주 로드맵 함께. 발표 + 사이드 프로젝트.', array['프론트엔드','백엔드']),
  ('컴퓨터공학과','PROJECT','개발','학과 발표회 매칭 플랫폼','학과 발표회용 학생 매칭 웹 서비스. 풀스택 인원 모집.', array['웹 개발','발표 준비']),
  ('컴퓨터공학과','PROJECT','개발','AI 무용 동작 분석 앱','무용과와 협업 — 영상 입력 → 자세 분석 → 피드백 앱. ML 경험자 우대.', array['AI/ML','앱 개발','학과 연합']),
  ('컴퓨터공학과','PROJECT','공모전','대학생 해커톤 팀 결성','이번 분기 대학생 해커톤 출전 팀. 프론트/백/디자인 1명씩.', array['해커톤','학과 연합']),
  ('컴퓨터공학과','MEETUP','네트워킹','개발자 점심 모임','격주 수요일 점심, 서로 사이드 프로젝트 공유 + 잡담.', array['개발자 네트워킹']),
  ('컴퓨터공학과','COMMUNITY','정보공유','무료 개발 강의 모음','학생증으로 받을 수 있는 무료 강의/자격증/도구 모음.', array['취업 준비']),
  -- 뷰티과
  ('뷰티과','STUDY','기타 학습','메이크업 기초 스터디','매주 한 가지 룩 따라잡기. 모델/메이크업 둘 다 환영.', array['메이크업']),
  ('뷰티과','STUDY','기타 학습','네일아트 디자인 워크북','매주 신상 네일 디자인 따라 그리기. 도구 공유.', array['네일아트']),
  ('뷰티과','PROJECT','디자인','학과 발표회 메이크업 디렉팅','무용/패션 발표회 모델 메이크업 디렉팅. 6명 모집.', array['메이크업','뷰티 화보','학과 연합']),
  ('뷰티과','PROJECT','디자인','뷰티 화보 촬영','콘셉트 화보 1세트 제작 — 메이크업/스타일링/모델/촬영.', array['뷰티 화보','메이크업']),
  ('뷰티과','MEETUP','취미/문화','메이크업 시연 데이','격주 토요일 오전, 서로 풀메 시연 + 후기 공유.', array['메이크업 시연']),
  ('뷰티과','COMMUNITY','후기','학교 화장품 매장 후기','학교 근처 화장품 매장 솔직 후기. 학생 할인 정보도 공유.', array['대학생']),
  -- 경영학과
  ('경영학과','STUDY','자격증/시험','회계관리 1급 스터디','이번 회차 회계관리 1급 같이 준비. 주 2회 문제풀이.', array['재무회계']),
  ('경영학과','STUDY','독서','경영서 1주 1권','매주 경영/마케팅 서적 한 권. 토요일 발제 모임.', array['마케팅']),
  ('경영학과','PROJECT','창업/사이드','대학생 창업 동아리','캠퍼스 발 스타트업 아이디어 검증 + MVP. 6주 사이클.', array['스타트업','학과 연합']),
  ('경영학과','PROJECT','공모전','전국 대학생 마케팅 공모전','이번 분기 마케팅 공모전 출전 팀 모집. 4인 1팀.', array['마케팅','비즈니스 공모전']),
  ('경영학과','MEETUP','네트워킹','창업가 점심 모임','월 1회 학교 근처 창업 선배 초청 + 멘토링.', array['창업 네트워킹']),
  ('경영학과','COMMUNITY','Q&A','학과 진로 고민','경영학과 졸업 후 진로 다양한데 다들 어디로 가시나요?', array['취업 준비']),
  -- 영상과
  ('영상과','STUDY','코딩/개발','프리미어 + 다빈치 스터디','매주 한 가지 효과/색보정 기법 같이 익히기.', array['영상 편집']),
  ('영상과','STUDY','기타 학습','시나리오 합평회','각자 단편 시나리오 들고 와서 합평. 격주 일요일.', array['시나리오']),
  ('영상과','PROJECT','개발','학과 발표회 메이킹 영상','발표회 전 과정 다큐멘터리 형식 메이킹 영상 제작. 촬영팀.', array['영상 편집','촬영 기법','발표 준비']),
  ('영상과','PROJECT','공모전','단편 영화 제작 프로젝트','학기말 단편 영화 1편 제작. 연출/촬영/편집/배우 모집.', array['단편 영화','시나리오']),
  ('영상과','PROJECT','창업/사이드','학과 유튜브 채널 운영','학과 일상 + 작품 소개 유튜브 채널 운영. 편집/기획.', array['유튜브 콘텐츠']),
  ('영상과','MEETUP','취미/문화','영화 보고 합평 모임','매주 영화 1편 시청 후 카페에서 합평.', array['영상 크리틱']),
  -- 음악과
  ('음악과','STUDY','기타 학습','코드 진행 분석 스터디','팝 + 재즈 코드 진행 분석. 매주 1곡씩.', array['작곡']),
  ('음악과','STUDY','기타 학습','합주 정기 모임','피아노/베이스/드럼/보컬 매주 합주. 발표회 무대 준비 겸.', array['합주','보컬']),
  ('음악과','PROJECT','개발','학과 발표회 무대 음악 작곡','무용/패션 발표회 무대 음악 작곡 + 편곡. 작곡과 모집.', array['작곡','공연 프로젝트','학과 연합']),
  ('음악과','PROJECT','창업/사이드','오리지널 EP 제작','학생 밴드 오리지널 EP 4곡 제작. 작/편곡 가능자.', array['작곡','밴드 결성']),
  ('음악과','MEETUP','취미/문화','음악 감상 모임','격주 토요일, 각자 추천 앨범 1장 가져와서 들으며 잡담.', array['음악 감상 모임']),
  ('음악과','COMMUNITY','후기','발표회 무대 후기','이번 무대 끝났는데 솔직 후기와 다음 무대 준비 얘기.', array['발표 준비']),
  -- 패션디자인과
  ('패션디자인과','STUDY','기타 학습','패턴 입문 스터디','패턴 캐드 입문. 매주 1개 패턴 직접 떠보기.', array['패턴 제작']),
  ('패션디자인과','STUDY','독서','패션 이론서 같이 읽기','매주 패션사/이론서 1챕터 발제.', array['소재 연구']),
  ('패션디자인과','PROJECT','디자인','학과 발표회 패션쇼','학생 디자이너 8명 컬렉션 미니 패션쇼. 모델 + 헤어 + 음악 협업.', array['패션쇼','의상 제작','학과 연합']),
  ('패션디자인과','PROJECT','디자인','업사이클 의상 컬렉션','폐자원 활용 의상 1컬렉션 제작. 4인 1팀.', array['의상 제작','소재 연구']),
  ('패션디자인과','MEETUP','취미/문화','스타일링 모임','매월 1회 빈티지샵 투어 + 스타일링 챌린지.', array['스타일링 모임']),
  ('패션디자인과','COMMUNITY','정보공유','학생 할인 원단샵 리스트','동대문 원단상가 학생 할인 + 추천 매장 정리.', array['대학생']);

-- ─── 4) 게시글 인서트 (템플릿당 5개 변주) ──────────────────────────
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
  regions text[] := array['강남','홍대','신촌','성수','잠실','안암','광화문','여의도','서면','동성로','온라인','학교 근처','캠퍼스'];
  seasons text[] := array['이번 학기','여름방학','겨울방학','4분기','상반기','하반기','시즌2','발표회 시즌'];
  periods text[] := array['1개월','2개월','3개월','6개월','단기','시즌제','상시','학기 말까지'];
  tones   text[] := array['주 1회','주 2회','평일 저녁','주말','온라인 위주','오프라인 중심'];
begin
  for t in select * from _demo_templates loop
    for v_variant in 1..5 loop
      -- 작성자: 80% 유령계정 우선, 없으면 일반 풀에서
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

      -- 상태 분포: RECRUITING 50% / COMPLETE 25% / FINISHED 25% (COMMUNITY 는 GENERAL)
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

      -- 변주 제목 (지역/시즌/톤 조합)
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

      -- 태그 매핑 (템플릿이 명시한 태그 + 학과 연합 일부 랜덤)
      foreach v_tag_name in array t.tag_names loop
        select id into v_tag_id from public.tags
          where name = v_tag_name limit 1;
        if v_tag_id is not null then
          insert into public.post_tags (post_id, tag_id) values (v_post_id, v_tag_id)
          on conflict do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- ─── 4-1) 정보공유 게시글 — 실제 도움 되는 콘텐츠 다수 ──────────────
-- COMMUNITY/정보공유 카테고리에 손으로 만든 풍부한 정보성 글들.
-- 각 글마다 본문 5~10줄 분량, 학과 다양성 + 실제 학생들이 검색할 만한 주제.
create temp table _demo_info_posts (
  dept text,
  title text,
  content text,
  tag_names text[]
) on commit drop;

insert into _demo_info_posts values
  -- 발표회/포트폴리오 운영
  ('디자인과',
   '학과 발표회 포스터 디자인 무료 템플릿 모음',
   E'발표회 시즌인데 포스터 디자이너 구하기 힘드신 분들을 위해 정리해봤어요.\n\n' ||
   E'1) Canva for Education — .edu 메일로 무료, 발표회 포스터/리플렛/SNS 카드 템플릿 풍부\n' ||
   E'2) Figma Community — "exhibition poster", "graduation showcase" 검색하면 무료 파일 다수\n' ||
   E'3) Behance Mockups — 인쇄용 mockup 무료 다운, 발표회 굿즈에 활용 가능\n' ||
   E'4) 미리캔버스 — 한글 폰트 풍부, 학교 인쇄소 호환 PDF로 바로 출력 가능\n\n' ||
   E'학교 인쇄소(중앙기념관 지하) 가격: A2 컬러 1,500원, 비닐 코팅 추가 500원. 학생증 필수.',
   array['포트폴리오','발표 준비','대학생']),
  ('컴퓨터공학과',
   '학생증으로 받을 수 있는 무료 개발 도구 정리',
   E'재학생이면 무료로 쓸 수 있는 거 정리했어요. 졸업 전에 챙기세요.\n\n' ||
   E'• GitHub Student Pack — Copilot Free, Codespaces, DigitalOcean $200 크레딧 등 80+ 혜택\n' ||
   E'• JetBrains 전 제품 무료 (IntelliJ, PyCharm, WebStorm) — 매년 .edu 메일 인증 필요\n' ||
   E'• Figma Education — 모든 유료 기능 무료, 팀 무제한\n' ||
   E'• Notion Education — Plus 플랜 무료, AI는 별도\n' ||
   E'• Adobe Creative Cloud — 학생 할인 월 23,100원 (전 제품)\n' ||
   E'• Microsoft 365 — 학교 메일로 Word/Excel/PowerPoint/1TB OneDrive 무료\n\n' ||
   E'팁: GitHub Student Pack은 신청 후 승인까지 1~3일. 일찍 신청하세요.',
   array['취업 준비','웹 개발','대학생']),
  ('컴퓨터공학과',
   '신입 개발자 포트폴리오에 꼭 들어가야 할 것들',
   E'1년 동안 취준하면서 면접관들이 공통으로 본 거 정리합니다.\n\n' ||
   E'1) GitHub 잔디 — 매일 안 해도 됨, 의미 있는 커밋이 더 중요\n' ||
   E'2) 프로젝트 README — 기술 스택 / 본인 기여 / 트러블슈팅 1개 이상 명시\n' ||
   E'3) 배포 링크 — Vercel/Netlify/Render 무료로 충분, 죽어있는 링크는 마이너스\n' ||
   E'4) 기술 블로그 1편 이상 — Velog/티스토리 OK, 깊이 있는 1편이 얕은 10편보다 나음\n' ||
   E'5) 알고리즘 — 코딩테스트 통과 기준이지 포트폴리오는 아님. 백준 골드 정도면 충분.\n\n' ||
   E'면접 단골 질문: "이 프로젝트에서 가장 어려웠던 문제는?" — 답변 준비 필수.',
   array['포트폴리오','취업 준비','웹 개발']),
  ('경영학과',
   '대학생이 신청할 수 있는 장학금 통합 정리',
   E'한국장학재단 외에 잘 알려진 장학금 + 기업/재단 장학금 정리.\n\n' ||
   E'[국가/공공]\n' ||
   E'• 국가장학금 1·2유형 — 학기마다 신청, 소득분위 8 이하 추천\n' ||
   E'• 대통령과학장학금 — 이공계 한정, 학기당 250만원 + 등록금\n' ||
   E'• 우수학생국가장학금 — 4.0 이상 추천\n\n' ||
   E'[기업]\n' ||
   E'• 삼성드림클래스 — 멘토링 활동 + 장학금\n' ||
   E'• LG연암 — 학기당 300만원, 학점 3.5 이상\n' ||
   E'• 현대차정몽구재단 — 사회기여형, 면접 있음\n\n' ||
   E'팁: 학교 장학팀 게시판이 가장 최신. 매월 한 번씩 들러서 확인.',
   array['취업 준비','대학생']),
  ('영상과',
   '단편 영화 제작비 절약하는 방법 정리',
   E'단편 1편 찍을 때 평균 50~100만원 깨지는데, 절반 이하로 줄인 경험담입니다.\n\n' ||
   E'1) 장비 대여 — 학교 기자재실 우선 (보통 무료), 부족하면 KT&G 상상마당 대여 (학생 50% 할인)\n' ||
   E'2) 로케이션 — 학교 시설, 친척 가게, 친구 자취방. 카페는 비영업 시간 협찬 받기.\n' ||
   E'3) 사운드 — RØDE VideoMicro 8만원대 / Boom 마이크는 학교 대여\n' ||
   E'4) 색보정 — DaVinci Resolve 무료, 학생 LUT 팩 무료 배포 많음\n' ||
   E'5) 음악 — Artlist/Epidemic Sound 학생 할인 / YouTube Audio Library 완전 무료\n\n' ||
   E'주의: 무료 라이선스도 영화제 출품 시 상업 라이선스 필요한 경우 있음. 출품 전 재확인.',
   array['영상 편집','단편 영화','대학생']),
  ('패션디자인과',
   '동대문 원단상가 학생용 가이드 (최신)',
   E'졸업 작품 + 패션쇼 의상 만들 때 가는 동대문 원단상가 정리.\n\n' ||
   E'[추천 매장]\n' ||
   E'• A동 1층 — 합성/혼방 위주, 가격 저렴. 학생 말하면 야드당 200~500원 디씨\n' ||
   E'• B동 2층 — 천연 소재 (린넨/면), 품질 좋음. 학기말은 재고 세일\n' ||
   E'• C동 지하 — 부자재 (지퍼/단추/심) 전부 있음, 1m 단위 구매 가능\n\n' ||
   E'[팁]\n' ||
   E'• 평일 오전 10시 ~ 12시가 한가함, 가격 흥정 잘 됨\n' ||
   E'• 학생증 + 학교 작품 사진 보여주면 샘플 무료 제공 매장 많음\n' ||
   E'• 결제는 현금이 유리 (카드 수수료 별도 청구하는 곳 다수)\n\n' ||
   E'주차는 동대문역사문화공원 공영주차장이 제일 쌈.',
   array['소재 연구','의상 제작','대학생']),
  ('무용과',
   '무용수가 알아두면 좋은 학교 시설 + 외부 연습실',
   E'졸업 공연 + 외부 작업 준비할 때 쓰는 연습실 리스트.\n\n' ||
   E'[교내]\n' ||
   E'• 무용관 B102 ~ B105 — 거울+마룻바닥, 예약제 (시스템에서 1주일 단위)\n' ||
   E'• 대강당 무대 — 발표회 직전 1주만 개방. 조명 콘솔 사용 가능\n' ||
   E'• 체육관 보조경기장 — 큰 동선 작업 가능, 평일 저녁 시간대 비어있음\n\n' ||
   E'[외부]\n' ||
   E'• 강남 ㅇㅇ 댄스 스튜디오 — 시간당 1.5만원, 학생 30% 할인\n' ||
   E'• 홍대 ㅁㅁ 연습실 — 거울+조명, 평일 오전 1만원\n' ||
   E'• 한남동 컨템포러리 전용 스튜디오 — 시간당 2만원, 공연 직전 추천\n\n' ||
   E'단톡방 들어와 있는 분들은 공동 대관도 가능. 비용 1/N 가능.',
   array['컨템포러리','발표 준비','대학생']),
  ('뷰티과',
   '학생 메이크업 키트 가성비 추천 (실사용 리스트)',
   E'4학기 동안 써본 메이크업 도구 중 학생 가성비 좋은 것만 추려봤어요.\n\n' ||
   E'[브러시]\n' ||
   E'• 아리울 베이스 브러시 세트 — 3만원대, 발표회 + 화보 둘 다 OK\n' ||
   E'• 영서 디테일 브러시 — 1.5만원, 아이라인 + 컨실러 필수템\n\n' ||
   E'[베이스]\n' ||
   E'• MAC Studio Fix Fluid — 학생 할인 시 4만원대, 영상 촬영용으로 결정적\n' ||
   E'• 에뛰드 픽싱 미스트 — 1만원대, 발표회 8시간 버팀\n\n' ||
   E'[아이/립]\n' ||
   E'• 클리오 프리즘 에어 — 발색 좋고 무난, 어떤 모델한테도 OK\n' ||
   E'• 페리페라 잉크 무드드 — 화보용 매트 립, 7천원\n\n' ||
   E'팁: 명동 코스메틱 로드샵에서 학생증 보여주면 추가 샘플 줘요.',
   array['메이크업','뷰티 화보','대학생']),
  ('음악과',
   '학생 작곡가가 쓸 만한 가성비 DAW + 플러그인 정리',
   E'졸업 작품 + 학과 발표회 음악 작업할 때 쓰는 거 정리.\n\n' ||
   E'[DAW]\n' ||
   E'• Logic Pro — 맥 한정, 30일 무료 후 36만원 1회 결제 (학생 할인 X)\n' ||
   E'• FL Studio — 학생 50% 할인, 평생 무료 업데이트\n' ||
   E'• Ableton Live Intro — 학생 30% 할인, 라이브 연주에 강함\n' ||
   E'• Reaper — 60일 무료, 학생 라이선스 8만원대\n\n' ||
   E'[무료 플러그인]\n' ||
   E'• Spitfire LABS — 무료 어쿠스틱 라이브러리, 발표회 영상 음악에 결정적\n' ||
   E'• Vital — 무료 신스, 유료 Serum 대체 가능\n' ||
   E'• TDR Nova — 무료 EQ, 학생 데모 음원 마스터링에 충분\n\n' ||
   E'학교 음악관 컴퓨터실에 Pro Tools 깔려있음 — 학교 라이선스로 무료.',
   array['작곡','대학생']),
  ('컴퓨터공학과',
   '재학생 무료/할인 받을 수 있는 강의 사이트 정리',
   E'유료 강의 학생 할인 + 무료 강의 정리. 매학기 갱신.\n\n' ||
   E'[유료 — 학생 할인]\n' ||
   E'• Coursera — 일부 .edu 인증 시 무료 (Financial Aid 신청)\n' ||
   E'• Udemy — 정가 X, 1만원대 세일 거의 매주. 와이파이만 좋으면 OK\n' ||
   E'• 인프런 — 학생 할인 코드 (매학기 발급) + 강의 50% 정도 무료\n\n' ||
   E'[완전 무료]\n' ||
   E'• freeCodeCamp — 풀스택 커리큘럼 전체 무료, 자격증 발급도 무료\n' ||
   E'• CS50 (Harvard) — edX 무료 청강, 자격증만 유료\n' ||
   E'• Boostcourse — 네이버 무료, 한국어 강의\n' ||
   E'• MDN Web Docs — 학습 + 레퍼런스 둘 다 가능\n\n' ||
   E'팁: 학교 도서관 디지털 자료에 Pluralsight/LinkedIn Learning 무료 등록되어 있음. 도서관 사이트 확인.',
   array['취업 준비','웹 개발','AI/ML','대학생']),
  ('경영학과',
   '학생 무료로 쓸 수 있는 비즈니스 도구 모음',
   E'창업 동아리 + 공모전 준비할 때 도움 됐던 도구들.\n\n' ||
   E'• Notion Education — 무료 Plus 플랜, 팀 무제한\n' ||
   E'• Slack — 학교 도메인으로 무료 워크스페이스 (메시지 90일 제한 있음)\n' ||
   E'• Trello — 무료 기본 플랜으로 충분\n' ||
   E'• Canva Pro for Education — 발표 PPT/로고/SNS 카드 무료\n' ||
   E'• Mailchimp — 월 500명까지 무료, 사이드 프로젝트 충분\n' ||
   E'• Stripe — 결제 시스템 테스트 환경 완전 무료, 실거래만 수수료\n' ||
   E'• Lovable / v0 — 노코드 웹 빌더, 무료 한도로 MVP 만들기 가능\n\n' ||
   E'팁: 창업 동아리 등록 후 학교 산학협력단 가면 추가 도구 라이선스 받을 수 있음.',
   array['스타트업','마케팅','대학생']),
  ('디자인과',
   '취업 포트폴리오 사이트 만들 때 추천 플랫폼 비교',
   E'졸업 직전에 만들어본 포트폴리오 사이트 플랫폼 비교.\n\n' ||
   E'• Notion — 무료, 빠름, 정적. 디자이너에겐 약간 정적인 인상\n' ||
   E'• Behance — 무료, 발견 가능성 높음. 디자인 회사 채용 담당자가 봄\n' ||
   E'• Cargo / Semplice — 디자이너 표준, 월 1만원대. 커스텀 자유도 높음\n' ||
   E'• Framer — 무료부터, 인터랙션 데모에 강함\n' ||
   E'• 직접 개발 (Next.js + Vercel) — 무료, 코드 가능자만\n\n' ||
   E'추천 조합: Behance (포트폴리오 등록) + Notion (이력서 + 작품 모음) — 무료로 둘 다 가능.\n' ||
   E'면접 시 Behance 링크보다 본인 도메인 가진 사이트가 인상 좋음. .design 도메인 학생 50% 할인.',
   array['포트폴리오','UI/UX','대학생']),
  ('영상과',
   '학생 영화제/공모전 마감일 모음 (이번 학기)',
   E'2026년 상반기 학생 출품 가능한 영화제/영상 공모전 정리.\n\n' ||
   E'[학생 영화제 — 무료 출품]\n' ||
   E'• 미장센 단편영화제 — 매년 3월 마감\n' ||
   E'• 정동진독립영화제 — 7월 마감, 합숙 워크숍 동반\n' ||
   E'• 대단원 단편영화제 — 학생 전용, 9월 마감\n\n' ||
   E'[광고/콘텐츠 공모전]\n' ||
   E'• 대학생광고제 — 1년 2회, 상금 500만원\n' ||
   E'• 한국방송광고진흥공사 공모 — 봄/가을\n' ||
   E'• 부산국제영화제 학생부문 — 8월 마감\n\n' ||
   E'팁: 한 번 만든 단편으로 여러 영화제 동시 출품 가능. 라이선스 조건만 확인.',
   array['단편 영화','시나리오','대학생']),
  ('패션디자인과',
   '학생 패션쇼 모델 섭외 방법 정리',
   E'졸업 작품 패션쇼 + 학과 발표회 모델 구할 때 시도해본 방법들.\n\n' ||
   E'1) 학교 게시판 + 인스타 학교 계정 — 무료, 의외로 지원 많음. 무용/연극과 연계가 가장 잘됨\n' ||
   E'2) 모델 매칭 앱 (모델닷컴, 더모델) — 학생 의뢰 무료, 단 사례비 협의 필수\n' ||
   E'3) 다른 학교 패션쇼 끝나고 SNS 컨택 — 경험 있는 학생 모델 풀\n' ||
   E'4) 친구/지인 — 가장 빠르지만 사이즈 제약\n\n' ||
   E'사례비 시세: 학교 행사 3~5만원, 외부 룩북 10만원~, 명문 패션쇼 20만원~.\n' ||
   E'무용/연극과 학생은 워킹 + 표정까지 잘해서 추천. 발표회 시즌엔 협업으로 부탁 가능.',
   array['패션쇼','의상 제작','학과 연합','대학생']),
  ('컴퓨터공학과',
   '대학생 코딩테스트 합격 후기 — 1년간 220문제',
   E'1년 동안 백준 220문제 풀고 4개 회사 코테 통과한 후기. 사기 아니고 실제 기록.\n\n' ||
   E'[월별]\n' ||
   E'• 1~3월 — 브론즈 ~ 실버. 그리디 + 구현. 하루 1문제\n' ||
   E'• 4~6월 — 골드 진입. BFS/DFS 본격. 주말 4문제 추가\n' ||
   E'• 7~9월 — DP + 다익스트라. 카카오/네이버 기출\n' ||
   E'• 10~12월 — 플래티넘 도전, 세그먼트 트리 + 트라이\n\n' ||
   E'[교훈]\n' ||
   E'• 매일 1문제 > 주말 몰아치기. 휴학생도 매일 권장.\n' ||
   E'• "풀이 보고 이해" 도 학습. 부끄러워하지 말 것\n' ||
   E'• 기업 코테는 골드 II ~ I 정도 + 자료구조 익숙하면 충분. 플래티넘은 과잉.\n\n' ||
   E'코테 통과 후 면접 분위기에 대해 궁금하면 댓글 주세요.',
   array['알고리즘','취업 준비','대학생']),
  ('컴퓨터공학과',
   '재학중 인턴 구하는 현실적인 경로 정리',
   E'학교 채용 게시판은 1% 만 의미 있고 나머지는 직접 발품. 효율 좋았던 순서대로.\n\n' ||
   E'1) 원티드 / 점핏 — 인턴 필터 + "신입/주니어" 필터. 매주 새로고침\n' ||
   E'2) 오픈채팅 — "프론트엔드 취준방", "백엔드 취준방" 등. 1차 컨택은 여기가 빠름\n' ||
   E'3) GitHub 사이드 프로젝트 공개 — 의외로 헤드헌터/CTO 가 DM 보냄\n' ||
   E'4) 학과 선배 LinkedIn — 가장 효율 좋지만 부담 있는 경로. 짧게 정중하게\n' ||
   E'5) 학교 진로지원센터 — 보안업체/SI 위주. 스타트업 거의 없음\n\n' ||
   E'경험상 정규공고(원티드) 합격률은 1~5%, 추천/오픈챗 경로 합격률은 20~30%. 후자가 훨씬 효율적.',
   array['취업 준비','웹 개발','대학생']),
  ('음악과',
   '학생 공연 음향/조명 셋업 가이드',
   E'학과 발표회 + 외부 무대 음향 셋업할 때 자주 빠뜨리는 것들.\n\n' ||
   E'[음향]\n' ||
   E'• 마이크 — 보컬 SM58, 악기 SM57 / e609. 학교에 있는 거 우선\n' ||
   E'• 인터페이스 — Focusrite Scarlett 2i2 (가성비), 학교 대여 가능\n' ||
   E'• 모니터 스피커 — 무대 위 인이어 없으면 무대 앞 모니터 필수\n' ||
   E'• 케이블 — 항상 여유분. 무대 위에서 끊기면 끝\n\n' ||
   E'[조명]\n' ||
   E'• 학교 대강당 — 콘솔 직접 조작 불가, 기술팀 협의 필수 (1주 전)\n' ||
   E'• 외부 무대 — 무드등 + 백라이트 정도면 학생 공연 OK\n\n' ||
   E'팁: 리허설은 최소 2회 — 하나는 음향만, 하나는 조명만. 둘 다 같이 보면 정신없음.',
   array['공연 프로젝트','합주','발표 준비']),
  ('뷰티과',
   '졸업 후 진로별 자격증 정리 (뷰티학과)',
   E'4학년 선배들 진로 보고 정리한 자격증 + 추가 공부 리스트.\n\n' ||
   E'[메이크업 아티스트]\n' ||
   E'• 메이크업 국가자격증 (필기 + 실기)\n' ||
   E'• 미용사(메이크업) 자격증 — 산업기사도 있음\n' ||
   E'• 추가: 컬러리스트 산업기사 — 영상/광고 메이크업 시 유리\n\n' ||
   E'[헤어 디자이너]\n' ||
   E'• 미용사(일반) — 필수\n' ||
   E'• 미용장 (5년 경력 후 도전)\n\n' ||
   E'[네일 아티스트]\n' ||
   E'• 미용사(네일) — 필수\n' ||
   E'• 네일 디자이너 민간자격증\n\n' ||
   E'[방송/광고 메이크업]\n' ||
   E'• 일반 자격증 + 영상 매체 메이크업 워크숍 이수 권장\n' ||
   E'• 포트폴리오: 화보 1~2세트, 단편 영상 메이크업 참여 1~2회면 인상 좋음',
   array['메이크업','취업 준비','포트폴리오']),
  ('경영학과',
   '대학생 공모전 합격하는 PPT 패턴 정리',
   E'공모전 3년 동안 본선 5회 / 입상 2회 한 사람의 PPT 패턴 정리.\n\n' ||
   E'[구조]\n' ||
   E'1. 한 줄 헤드라인 (10초 안에 핵심 전달)\n' ||
   E'2. 시장 + 문제 정의 (데이터 1~2개 인용)\n' ||
   E'3. 솔루션 (한 슬라이드에 핵심만)\n' ||
   E'4. 차별점 (경쟁 비교 표)\n' ||
   E'5. 비즈니스 모델 (수익 흐름 도식화)\n' ||
   E'6. 실행 계획 (3~6개월 마일스톤)\n' ||
   E'7. 팀 소개 (왜 우리가 적임자인지)\n\n' ||
   E'[디자인]\n' ||
   E'• Sans-serif + 다크 그레이 텍스트 + 1~2 accent 컬러\n' ||
   E'• 한 슬라이드 한 메시지\n' ||
   E'• 데이터는 막대그래프 우선, 파이차트는 비추\n\n' ||
   E'심사위원 시간은 7분. 7분 안에 안 끝나면 다음 슬라이드 안 봄.',
   array['비즈니스 공모전','마케팅','발표 준비']),
  ('디자인과',
   '학생 디자이너가 자주 빠뜨리는 파일 관리 팁',
   E'학과 발표회 + 졸업 작품 제출 때 사고 막는 파일 관리법.\n\n' ||
   E'1) 파일명 규칙 — YYMMDD_프로젝트명_버전.확장자 (예: 260530_pammyshow_v3.ai)\n' ||
   E'2) 버전 관리 — _v1, _v2, _final, _final2, _진짜final 금지. 숫자만 올리기\n' ||
   E'3) 인쇄 파일 — CMYK + 3mm 도련 + 아웃라인 처리한 후 PDF/X-1a 출력\n' ||
   E'4) 폰트 — 인쇄소 보낼 때 폰트 임베드 또는 아웃라인. 잊으면 폰트 깨짐\n' ||
   E'5) 컬러 — RGB 작업 후 인쇄 직전 CMYK 변환 (브랜드 컬러는 별색 지정)\n' ||
   E'6) 백업 — 학교 NAS + 본인 드라이브 + 외장하드 3중 백업. 졸업전 작품 잃으면 끝.\n\n' ||
   E'무료 클라우드 백업: Google Drive 15GB + Notion 무제한 (이미지는 압축됨).',
   array['포트폴리오','발표 준비','UI/UX']);

-- 정보 게시글 인서트 (각 글마다 1~2번씩 변주 — 작성 시기만 다르게)
do $$
declare
  ip          _demo_info_posts%rowtype;
  v_author    uuid;
  v_post_id   bigint;
  v_tag_id    bigint;
  v_tag_name  text;
  v_n_copies  int;
  v_created   timestamptz;
begin
  for ip in select * from _demo_info_posts loop
    -- 같은 글을 1~2회 시점 달리하여 인서트 (자연스러운 검색 풍부도)
    v_n_copies := 1 + (case when random() < 0.3 then 1 else 0 end);
    for v_i in 1..v_n_copies loop
      -- 작성자: 80% 같은 학과 유령계정, 20% 같은 학과 일반
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
        'COMMUNITY', '정보공유',
        ip.title || case when v_i > 1 then format(' (%s판)', v_i) else '' end,
        ip.content,
        null, 'GENERAL', null, null, v_author, v_created
      ) returning id into v_post_id;

      foreach v_tag_name in array ip.tag_names loop
        select id into v_tag_id from public.tags where name = v_tag_name limit 1;
        if v_tag_id is not null then
          insert into public.post_tags (post_id, tag_id)
          values (v_post_id, v_tag_id)
          on conflict do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- ─── 5) 지원 + 멤버 (다른 학과 학생 일부 합류) ─────────────────────
-- RECRUITING/COMPLETE/FINISHED 게시글 중 본 시드에서 만든 것에 대해서만 지원 생성
-- (식별: 90일 이내 + 작성자가 _demo_users 에 속함)
do $$
declare
  p          record;
  v_app      record;
  v_n        int;
  v_member   uuid;
  v_status   text;
begin
  for p in
    select po.id as post_id, po.category, po.status, po.capacity, po.author_id
    from public.posts po
    join _demo_users du on du.user_id = po.author_id
    where po.category <> 'COMMUNITY'
      and po.created_at > now() - interval '120 days'
  loop
    -- 게시글당 1~6명 지원 생성
    v_n := 1 + floor(random()*6)::int;
    for v_i in 1..v_n loop
      -- 다른 학과 포함 랜덤 사용자 (작성자 본인 제외)
      select user_id into v_member
        from _demo_users
        where user_id <> p.author_id
        order by random() limit 1;
      if v_member is null then continue; end if;

      -- COMPLETE/FINISHED 는 ACCEPTED 비중↑, RECRUITING 은 PENDING↑
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
            '학과 발표회 준비 중인데 함께하고 싶어요.',
            '꾸준히 참여할 수 있습니다. 잘 부탁드려요.',
            '관련 경험은 적지만 진심으로 임할게요.',
            '시간 약속 잘 지키고 책임감 있게 할게요.',
            '비슷한 활동 경험 있습니다. 자세한 얘기 나누고 싶어요.'
          ])[1+floor(random()*6)::int],
          v_status,
          now() - (floor(random()*60)::int) * interval '1 day'
        );
      exception when unique_violation then
        -- 같은 사용자가 같은 게시글에 중복 지원 — skip
        null;
      end;
    end loop;
  end loop;
end $$;

-- ─── 6) 리뷰 + review_scores (FINISHED 게시글만) ─────────────────────
-- 작성자가 본 시드에서 만든 FINISHED 게시글에 대해, 멤버들끼리 서로 리뷰.
-- review_scores 5개 항목 1~5점 랜덤(평균 3.6~4.4). 후 apply_review_temperature 호출.
do $$
declare
  p             record;
  evaluator     uuid;
  target        uuid;
  v_review_id   bigint;
  v_item        record;
  v_score       int;
  v_n_reviews   int;
  v_member_arr  uuid[];
  v_i           int;
  v_j           int;
begin
  for p in
    select po.id as post_id, po.category, po.author_id
    from public.posts po
    join _demo_users du on du.user_id = po.author_id
    where po.status = 'FINISHED'
      and po.category in ('STUDY','PROJECT','MEETUP')
  loop
    -- 해당 게시글 멤버 (작성자 포함) 수집
    select array_agg(user_id) into v_member_arr
    from public.post_members where post_id = p.post_id;

    if v_member_arr is null or array_length(v_member_arr,1) < 2 then continue; end if;

    -- 멤버 수만큼 N×(N-1) 의 일부 — 30~70% 만 리뷰 작성
    for v_i in 1..array_length(v_member_arr,1) loop
      for v_j in 1..array_length(v_member_arr,1) loop
        if v_i = v_j then continue; end if;
        if random() > 0.45 then continue; end if;

        evaluator := v_member_arr[v_i];
        target    := v_member_arr[v_j];

        begin
          insert into public.reviews (post_id, evaluator_id, target_id, comment, created_at)
          values (
            p.post_id, evaluator, target,
            (array[
              '약속 잘 지키고 분위기 좋게 이끌어주셨어요.',
              '맡은 부분 책임감 있게 잘 해주셨습니다.',
              '소통 잘 되고 함께해서 좋았어요!',
              '꼼꼼하게 챙겨주셔서 큰 도움이 됐어요.',
              '의견 적극적으로 내주셔서 프로젝트 풍부해졌습니다.',
              '시간 약속 잘 지키시고 매너 좋으십니다.'
            ])[1+floor(random()*6)::int],
            now() - (floor(random()*30)::int) * interval '1 day'
          ) returning id into v_review_id;
        exception when unique_violation then
          continue; -- (post,evaluator,target) 중복 skip
        end;

        -- 카테고리별 항목 5개에 1~5점 (평균 3.6~4.4 분포)
        for v_item in
          select id from public.review_items where category = p.category order by sort_order
        loop
          v_score := 3 + (case
            when random() < 0.05 then 0  -- 3
            when random() < 0.55 then 1  -- 4
            when random() < 0.95 then 2  -- 5
            else -1                       -- 2
          end);
          v_score := greatest(1, least(5, v_score));
          insert into public.review_scores (review_id, item_id, score)
          values (v_review_id, v_item.id, v_score);
        end loop;

        -- 온도 반영
        perform public.apply_review_temperature(v_review_id);
      end loop;
    end loop;
  end loop;
end $$;

-- ─── 7) 댓글 + Q&A (게시글 일부) ────────────────────────────────────
do $$
declare
  p           record;
  v_n         int;
  v_commenter uuid;
  v_text      text;
  v_root_id   bigint;
begin
  for p in
    select po.id as post_id, po.category
    from public.posts po
    join _demo_users du on du.user_id = po.author_id
    where po.created_at > now() - interval '90 days'
  loop
    -- 게시글당 0~5개 댓글
    v_n := floor(random()*6)::int;
    for v_i in 1..v_n loop
      select user_id into v_commenter from _demo_users order by random() limit 1;
      if v_commenter is null then continue; end if;

      v_text := case p.category
        when 'COMMUNITY' then (array[
          '저도 같은 생각이에요. 공감합니다.',
          '좋은 정보 감사합니다!',
          '저는 다른 관점인데... 한번 얘기해보고 싶네요.',
          '와 이거 진짜 도움 많이 됐어요.',
          '혹시 더 자세한 자료 있을까요?'
        ])[1+floor(random()*5)::int]
        else (array[
          '아직 자리 남았을까요? 관심 있습니다!',
          '모임 위치는 어디서 진행되나요?',
          '초보자도 가능한가요?',
          '시간 약속 잘 지킬 자신 있습니다. 지원하고 싶어요.',
          '이번 학기 중간고사 끝나고 합류 가능할까요?',
          '학과가 다른데 함께 해도 괜찮을까요?'
        ])[1+floor(random()*6)::int]
      end;

      insert into public.comments (post_id, user_id, content, created_at)
      values (p.post_id, v_commenter, v_text, now() - (floor(random()*30)::int) * interval '1 day')
      returning id into v_root_id;

      -- 30% 확률로 작성자가 답글
      if random() < 0.3 then
        insert into public.comments (post_id, user_id, parent_id, content, created_at)
        select p.post_id, po.author_id, v_root_id,
               (array[
                 '네! 자리 있습니다. 지원 폼 작성해 주세요.',
                 '학과 무관하게 환영합니다 :)',
                 '초보자 환영이에요! 부담 갖지 마세요.',
                 '좋은 의견 감사합니다.',
                 '자세한 건 메시지로 안내드릴게요.'
               ])[1+floor(random()*5)::int],
               now() - (floor(random()*15)::int) * interval '1 day'
        from public.posts po where po.id = p.post_id;
      end if;
    end loop;
  end loop;
end $$;

-- ─── 8) 실시간 검색어 백필 ─────────────────────────────────────────
-- 게시글 제목/태그명에서 키워드 뽑아 record_search 다회 호출.
-- 일부 단어가 자연스럽게 더 많이 카운트되도록 가중 랜덤.
do $$
declare
  v_term      text;
  v_calls     int := 800;
  v_hot_terms text[] := array[
    '발표회','학과 연합','발표 준비','포트폴리오','메이크업','패션쇼',
    '해커톤','단편 영화','합주','컨템포러리','브랜딩','알고리즘',
    '창업','공모전','UI/UX','AI/ML'
  ];
  -- 풀: hot_terms 8할 + 태그명 2할 → 인기 검색어 분포 시뮬레이션
begin
  for v_i in 1..v_calls loop
    if random() < 0.7 then
      v_term := v_hot_terms[1 + floor(random()*array_length(v_hot_terms,1))::int];
    else
      select name into v_term from public.tags order by random() limit 1;
    end if;
    if v_term is null then continue; end if;
    perform public.record_search(v_term);
  end loop;

  -- 최근 1시간 윈도우용: 절반은 last_searched_at 을 최근 30분으로 당김
  update public.search_terms
     set last_searched_at = now() - (floor(random()*30)::int) * interval '1 minute'
   where term in (select unnest(v_hot_terms));
end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════
-- 다음 단계 (별도 실행):
--   임베딩 백필 (AI 검색 동작에 필수):
--     node --env-file=.env.local scripts/backfill-embeddings.mjs
--
--   (선택) Gemini 로 태그/하위카테고리 재분류:
--     node --env-file=.env.local scripts/retag-posts.mjs
-- ═══════════════════════════════════════════════════════════════════
