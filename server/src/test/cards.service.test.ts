import { describe, it, expect, vi } from "vitest";
vi.mock("../lib/supabase", async () => await import("./__mocks__/supabase.js"));
import { cardsService } from "../services/cards";

describe("cardsService", () => {
  it("list without pagination returns all", async () => {
    const { items, total, page, limit } = await cardsService.list({});
    expect(items.length).toBe(total);
    expect(page).toBe(1);
    expect(limit).toBe(total);
  });

  it("filters by token=false and type=instant", async () => {
    const { items } = await cardsService.list({ token: false, type: "instant" });
    for (const c of items) {
      expect(c.token).toBe(false);
      expect(c.type).toBe("instant");
    }
  });
});


