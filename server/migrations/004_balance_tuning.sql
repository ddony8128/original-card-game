-- 004: 밸런스 조정 (1단계 어그로 강화 / 3단계 컨트롤 약화 / 엔드게임 데이터 4/4/4 정합)
-- (런타임은 cards.json 리소스를 읽지만, DB 가 원본이므로 함께 동기화한다.)
-- (DB cards 테이블에는 영어 컬럼이 없어 description_en 은 제외; 영어는 cards.json/클라에서 처리)
--
-- 변경 요약:
--   c01-002 마나가 담긴 찌르기 : damage 2 → 3
--   c01-011 고통 동기화        : self damage 5 → 3 (enemy 5 유지)
--   c01-012 카드 날리기        : discard 2 → 1 (damage 6 유지)
--   c01-015 지력흡수           : heal 3 → 2
--   c01-017 전광석화           : damage 1/2/3 → 2/3/4 (range 1/2/3 유지)
--   c01-026 운석 떨구기        : damage 10 → 8
--   c01-028 엔드게임           : damage 4/5/5 → 4/4/4 (draw_cata 유지, 설명 변경 없음)

-- c01-002 마나가 담긴 찌르기
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"damage","range":1,"value":3,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '거리 1 내에 피해를 3 줍니다.'
WHERE id = 'c01-002';

-- c01-011 고통 동기화
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"damage","value":5,"target":"enemy"},{"type":"damage","value":3,"target":"self"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '상대 마법사에게 5 피해를 주고, 자신도 3 피해를 입습니다.'
WHERE id = 'c01-011';

-- c01-012 카드 날리기
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"discard","value":1,"method":"hand_choose","target":"self"},{"type":"damage","range":2,"value":6,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '카드 1장을 선택해 버리고, 거리 2 내에 6 피해를 줍니다.'
WHERE id = 'c01-012';

-- c01-015 지력흡수
UPDATE cards
SET effect_json = '{"type":"ritual","install":{"range":0},"triggers":[{"effects":[{"type":"heal","value":2,"target":"self"}],"trigger":"onUsePerTurn"}]}'::jsonb,
    description_ko = '거리 0 내에 설치. 매 턴 사용 시 피해를 2 회복합니다.'
WHERE id = 'c01-015';

-- c01-017 전광석화
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"move","value":1,"target":"self","direction":"choose"},{"type":"damage","range":1,"value":2,"target":"near_enemy"},{"type":"move","value":1,"target":"self","direction":"choose"},{"type":"damage","range":2,"value":3,"target":"near_enemy"},{"type":"move","value":1,"target":"self","direction":"choose"},{"type":"damage","range":3,"value":4,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '이동과 공격을 세 번 반복합니다. (1칸 이동 후 거리 1 이내 피해 2, 1칸 이동 후 거리 2 이내 피해 3, 1칸 이동 후 거리 3 이내 피해 4)'
WHERE id = 'c01-017';

-- c01-026 운석 떨구기
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"damage","range":4,"value":8,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '거리 4 내에 8 피해를 줍니다.'
WHERE id = 'c01-026';

-- c01-028 엔드게임 (설명 변경 없음: effect_json 만 4/4/4 로 정합)
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"damage","range":3,"value":4,"target":"near_enemy"},{"type":"draw_cata","value":1,"target":"self"},{"type":"damage","range":3,"value":4,"target":"near_enemy"},{"type":"draw_cata","value":1,"target":"self"},{"type":"damage","range":3,"value":4,"target":"near_enemy"},{"type":"draw_cata","value":1,"target":"self"}],"trigger":"onCast"}]}'::jsonb
WHERE id = 'c01-028';
