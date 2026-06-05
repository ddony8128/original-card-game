-- 005: 어그로 버프 원복 (과교정 되돌림). c01-002 damage 2, c01-011 self 5, c01-017 1/2/3, c01-012 무작위 1장 버리기. stage-1 덱은 pveStages.json 에서 원복.
-- (런타임은 cards.json 리소스를 읽지만, DB 가 원본이므로 함께 동기화한다.)
-- (DB cards 테이블에는 영어 컬럼이 없어 description_en 은 제외; 영어는 cards.json/클라에서 처리)

-- c01-002 마나가 담긴 찌르기
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"damage","range":1,"value":2,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '거리 1 내에 피해를 2 줍니다.'
WHERE id = 'c01-002';

-- c01-011 고통 동기화
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"damage","value":5,"target":"enemy"},{"type":"damage","value":5,"target":"self"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '상대 마법사에게 5 피해를 주고, 자신도 5 피해를 입습니다.'
WHERE id = 'c01-011';

-- c01-012 카드 날리기 (무작위 1장 버리기)
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"discard","value":1,"method":"hand_random","target":"self"},{"type":"damage","range":2,"value":6,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '카드 1장을 무작위로 버리고, 거리 2 내에 6 피해를 줍니다.'
WHERE id = 'c01-012';

-- c01-017 전광석화
UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"move","value":1,"target":"self","direction":"choose"},{"type":"damage","range":1,"value":1,"target":"near_enemy"},{"type":"move","value":1,"target":"self","direction":"choose"},{"type":"damage","range":2,"value":2,"target":"near_enemy"},{"type":"move","value":1,"target":"self","direction":"choose"},{"type":"damage","range":3,"value":3,"target":"near_enemy"}],"trigger":"onCast"}]}'::jsonb,
    description_ko = '이동과 공격을 세 번 반복합니다. (1칸 이동 후 거리 1 이내 피해 1, 1칸 이동 후 거리 2 이내 피해 2, 1칸 이동 후 거리 3 이내 피해 3)'
WHERE id = 'c01-017';
