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
  let cookie2: string;
  let createdDeckIdUser1: string | undefined;
  let createdDeckIdUser2: string | undefined;

  beforeAll(async () => {
    app = await setupApp();
    cookie = await loginCookie(app);
    cookie2 = await loginCookie(app);
  });

  it("invalid shape -> 400", async () => {
    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", cookie)
      .send({ name: "Bad", main_cards: "str", cata_cards: [] });
    expect(res.status).toBe(400);
  });

  it("missing name -> 400", async () => {
    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", cookie)
      .send({ main_cards: [], cata_cards: [] });
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

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.main_cards)).toBe(true);
    expect(Array.isArray(res.body.cata_cards)).toBe(true);
    const first = res.body.main_cards[0];
    expect(first).toHaveProperty("name_dev");
    expect(first).toHaveProperty("name_ko");
    expect(first).toHaveProperty("type");
    expect(first).toHaveProperty("mana");
    createdDeckIdUser1 = res.body.id as string;
  });

  it("GET /api/decks -> returns user's decks", async () => {
    const res = await request(app).get("/api/decks").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((d: any) => d.id === createdDeckIdUser1)).toBeTruthy();
  });

  it("POST internal error mapping -> 500 when unexpected thrown", async () => {
    // spy on service to throw non-Error value once
    const mod = await import("../services/decks.js");
    const spy = (mod as any).decksService.validateAndHydrate as any;
    const orig = spy;
    (mod as any).decksService.validateAndHydrate = vi.fn().mockRejectedValueOnce(123 as any);
    const res = await request(app)
      .post("/api/decks")
      .set("Cookie", cookie)
      .send({ name: "Err", main_cards: [], cata_cards: [] });
    // restore
    (mod as any).decksService.validateAndHydrate = orig;
    expect(res.status).toBe(500);
  });

  it("PUT name missing -> 400", async () => {
    const id = createdDeckIdUser1!;
    const res = await request(app)
      .put(`/api/decks/${id}`)
      .set("Cookie", cookie)
      .send({ main_cards: [], cata_cards: [] });
    expect(res.status).toBe(400);
  });

  it("PUT deck not found -> 404", async () => {
    const res = await request(app)
      .put(`/api/decks/no-such-id`)
      .set("Cookie", cookie)
      .send({ name: "X", main_cards: [], cata_cards: [] });
    expect(res.status).toBe(404);
  });

  it("prepare another user's deck", async () => {
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
      .set("Cookie", cookie2)
      .send({ name: "Other", main_cards, cata_cards });
    expect(res.status).toBe(201);
    createdDeckIdUser2 = res.body.id as string;
  });

  it("PUT forbidden -> 403", async () => {
    const res = await request(app)
      .put(`/api/decks/${createdDeckIdUser2}`)
      .set("Cookie", cookie)
      .send({ name: "TryHack", main_cards: [], cata_cards: [] });
    expect(res.status).toBe(403);
  });

  it("PUT success -> 200 and updated fields", async () => {
    const id = createdDeckIdUser1!;
    const res = await request(app)
      .put(`/api/decks/${id}`)
      .set("Cookie", cookie)
      .send({
        name: "Updated",
        main_cards: [{ id: "c01-001", count: 2 }, { id: "c01-002", count: 2 }, { id: "c01-003", count: 2 }, { id: "c01-004", count: 2 }, { id: "c01-005", count: 2 }, { id: "c01-006", count: 2 }, { id: "c01-002", count: 2 }, { id: "c01-003", count: 2 }],
        cata_cards: [{ id: "c99-001", count: 1 }, { id: "c99-002", count: 1 }, { id: "c99-003", count: 1 }, { id: "c99-004", count: 1 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated");
  });

  it("DELETE not found -> 404", async () => {
    const res = await request(app)
      .delete(`/api/decks/nope`)
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
  });

  it("DELETE forbidden -> 403", async () => {
    const res = await request(app)
      .delete(`/api/decks/${createdDeckIdUser2}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("DELETE success -> 204", async () => {
    const id = createdDeckIdUser1!;
    const res = await request(app)
      .delete(`/api/decks/${id}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(204);
  });
});


