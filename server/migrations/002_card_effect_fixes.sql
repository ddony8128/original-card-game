-- 002: 카드 effect_json 을 설명/패치 의도에 맞게 정정한다.
-- (런타임은 cards.json 리소스를 읽지만, DB 가 원본이므로 함께 동기화한다.)
--
-- 두 카드는 DB 에서 설명↔효과가 어긋나 있었다:
--   c01-011 고통 동기화: 설명은 "5 피해"인데 effect 는 4 였다 → 효과를 5 로.
--   c01-020 지맥        : 효과 install range 1 인데 설명은 "거리 2" 였다 → 효과를 2 로.
-- 사용자 확정값: 고통 동기화 = 5 피해, 지맥 = 설치 거리 2.

UPDATE cards
SET effect_json = '{"type":"instant","triggers":[{"effects":[{"type":"damage","value":5,"target":"enemy"},{"type":"damage","value":5,"target":"self"}],"trigger":"onCast"}]}'::jsonb
WHERE id = 'c01-011';

UPDATE cards
SET effect_json = '{"type":"ritual","install":{"range":2},"triggers":[{"effects":[{"type":"mana_gain","value":1,"target":"self"}],"trigger":"onTurnStart"}]}'::jsonb
WHERE id = 'c01-020';
