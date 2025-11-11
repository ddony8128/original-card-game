export type DeckCardType =
  "instant" |
  "ritual" |
  "catastrophe" |
  "summon" |
  "item";

export type DeckCardEntry = {
    id: string;
    count: number;
    name_dev?: string;
    name_ko?: string;
    description_ko?: string | null;
    type?: DeckCardType;
    mana?: number | null;
};

export type DeckList = DeckCardEntry[];

export function isDeckList(value: unknown): value is DeckList {
    if (!Array.isArray(value)) return false;
    for (const item of value) {
        if (typeof item !== "object" || item === null) return false;
        const rec = item as Record<string, unknown>;
        if (typeof rec.id !== "string") return false;
        if (
            typeof rec.count !== "number" ||
            !Number.isFinite(rec.count)
        ) return false;
        if (
            rec.name_dev !== undefined &&
            typeof rec.name_dev !== "string"
        ) return false;
        if (
            rec.name_ko !== undefined &&
            typeof rec.name_ko !== "string"
        ) return false;
        if (
            rec.description_ko !== undefined &&
            !(rec.description_ko === null || typeof rec.description_ko === "string")
        ) return false;
        if (
            rec.type !== undefined &&
            !["instant", "ritual", "catastrophe", "summon", "item"].includes(rec.type as string)
        ) return false;
        if (
            rec.mana !== undefined &&
            !(rec.mana === null || typeof rec.mana === "number")
        ) return false;
    }
    return true;
}

export function coerceDeckList(raw: unknown): DeckList {
    let value: unknown = raw;
    if (value === null || value === undefined) return [];
    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch {
            throw new Error("Invalid deck JSON string");
        }
    }
    if (!isDeckList(value)) throw new Error("Invalid deck structure");
    return value as DeckList;
}

