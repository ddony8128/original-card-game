-- 006: 카드 날리기(c01-012) 무작위→선택 버프, 운석 떨구기(c01-026) 8→9 피해 버프.
-- (런타임은 cards.json 리소스를 읽지만, DB 가 원본이므로 함께 동기화한다.)
-- (DB cards 테이블에는 영어 컬럼이 없어 description_en 은 제외; 영어는 cards.json/클라에서 처리)

-- c01-012 카드 날리기 (무작위 → 선택 버리기)
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"discard","value":1,"method":"hand_choose","target":"self"},{"type":"damage","range":2,"value":6,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '카드 1장을 선택해 버리고, 거리 2 내에 6 피해를 줍니다.'
WHERE id = 'c01-012';

-- c01-026 운석 떨구기 (8 → 9 피해)
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"damage","range":4,"value":9,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '거리 4 내에 9 피해를 줍니다.'
WHERE id = 'c01-026';
