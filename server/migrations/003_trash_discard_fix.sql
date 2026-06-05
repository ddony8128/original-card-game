-- 003: 쓰레기! 버려욧!(c01-904) effect_json 정정.
-- 설명("손패에서 1장 버림 / 빈손이면 덱 위 3장 버림")과 효과가 뒤바뀌어 있어,
-- 손패가 있을 때 3장을 버리는 버그가 있었다. 설명에 맞게 값을 교환한다:
--   if_self_hand_empty(빈손)     → 덱 위 3장 (deck_top, value 3)
--   if_self_hand_empty_not(손패) → 손패 1장 (hand_random, value 1)

UPDATE cards
SET effect_json = '{"type":"catastrophe","triggers":[{"effects":[{"type":"discard","value":3,"method":"deck_top","target":"self","condition":"if_self_hand_empty"},{"type":"discard","value":1,"method":"hand_random","target":"self","condition":"if_self_hand_empty_not"}],"trigger":"onDrawn"}]}'::jsonb
WHERE id = 'c01-904';
