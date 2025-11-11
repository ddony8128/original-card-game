export type CardEffect = {
  kind: "damage" | "heal" | "shield";
  value: number;
  range?: number;
  target: "self" | "ally" | "enemy" | "area";
};

export type CardData = {
  id: string;
  name: string;
  type: "instant" | "spell" | "summon";
  mana: number;
  effects: CardEffect[];
};

export const CARDS: CardData[] = [
  {
    id: "fireball",
    name: "화염구",
    type: "instant",
    mana: 3,
    effects: [{ kind: "damage", value: 6, range: 3, target: "enemy" }],
  },
  {
    id: "magic_missile",
    name: "매직 미사일",
    type: "instant",
    mana: 2,
    effects: [{ kind: "damage", value: 3, range: 2, target: "enemy" }],
  },
  {
    id: "mana_battery",
    name: "마나 배터리",
    type: "spell",
    mana: 1,
    effects: [{ kind: "heal", value: 1, target: "self" }],
  },
];


