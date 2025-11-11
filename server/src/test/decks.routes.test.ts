import { describe, it, expect, beforeAll, vi } from "vitest";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
vi.mock("../lib/supabase", async () => await import("./__mocks__/supabase.js"));
import request from "supertest";

async function setupApp() {
  const mod = await import("../app.js");
  return mod.app as any;
}

async function loginCookie(app: any) {
  const username = `u_${Date.now()}`;
  await request(app).post("/api/auth/register").send({ username, password: "pw" });
  const res = await request(app).post("/api/auth/login").send({ username, password: "pw" });
  return res.headers["set-cookie"]?.[0] as string;
}

describe("Decks routes", () => {
  let app: any;
  let cookie: string;

  beforeAll(async () => {
    app = await setupApp();
    cookie = await loginCookie(app);
  });

  it("invalid shape -> 400", async () => {
    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", cookie)
      .send({ name: "Bad", main_cards: "str", cata_cards: [] });
    expect(res.status).toBe(400);
  });

  it("wrong counts -> 400", async () => {
    const main_cards = Array(8).fill({ id: "c01-001", count: 2 }); // sum 16 OK
    const cata_cards = [{ id: "c99-001", count: 1 }, { id: "c99-002", count: 1 }, { id: "c99-003", count: 1 }]; // sum 3 -> invalid
    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", cookie)
      .send({ name: "Wrong", main_cards, cata_cards });
    expect(res.status).toBe(400);
  });

  it("token in main -> 400", async () => {
    const main_cards = [
      { id: "c01-001", count: 2 },
      { id: "c01-002", count: 2 },
      { id: "c01-003", count: 2 },
      { id: "c01-004", count: 2 },
      { id: "c01-005", count: 2 },
      { id: "c01-006", count: 2 },
      { id: "c01-007", count: 2 }, // token=true
      { id: "c01-002", count: 2 },
    ];
    // Adjust to exactly 16 if needed, but validation should fail earlier due to token
    const cata_cards = [
      { id: "c99-001", count: 1 },
      { id: "c99-002", count: 1 },
      { id: "c99-003", count: 1 },
      { id: "c99-004", count: 1 },
    ];
    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", cookie)
      .send({ name: "TokenMain", main_cards, cata_cards });
    expect(res.status).toBe(400);
  });

  it("catastrophe in main -> 400", async () => {
    const main_cards = [
      { id: "c01-001", count: 2 },
      { id: "c01-002", count: 2 },
      { id: "c01-003", count: 2 },
      { id: "c01-004", count: 2 },
      { id: "c01-005", count: 2 },
      { id: "c01-006", count: 2 },
      { id: "c99-001", count: 2 }, // catastrophe -> invalid
      { id: "c01-002", count: 2 },
    ];
    const cata_cards = [
      { id: "c99-001", count: 1 },
      { id: "c99-002", count: 1 },
      { id: "c99-003", count: 1 },
      { id: "c99-004", count: 1 },
    ];
    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", cookie)
      .send({ name: "CataMain", main_cards, cata_cards });
    expect(res.status).toBe(400);
  });

  it("success -> 201 and hydrated fields present", async () => {
    // Build 16 main counts (sum 16) without token/catastrophe
    const main_cards = [
      { id: "c01-001", count: 2 },
      { id: "c01-002", count: 2 },
      { id: "c01-003", count: 2 },
      { id: "c01-004", count: 2 },
      { id: "c01-005", count: 2 },
      { id: "c01-006", count: 2 },
      { id: "c01-002", count: 2 },
      { id: "c01-003", count: 2 },
    ];
    const cata_cards = [
      { id: "c99-001", count: 1 },
      { id: "c99-002", count: 1 },
      { id: "c99-003", count: 1 },
      { id: "c99-004", count: 1 },
    ];

    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", cookie)
      .send({ name: "Starter", main_cards, cata_cards });
    if (res.status !== 201) {
      // help diagnose
      // eslint-disable-next-line no-console
      console.log("/api/decks create failed:", res.status, res.body);
    }
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.main_cards)).toBe(true);
    expect(Array.isArray(res.body.cata_cards)).toBe(true);
    const first = res.body.main_cards[0];
    expect(first).toHaveProperty("name_dev");
    expect(first).toHaveProperty("name_ko");
    expect(first).toHaveProperty("type");
    expect(first).toHaveProperty("mana");
  });
});


