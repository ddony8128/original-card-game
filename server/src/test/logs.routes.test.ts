import request from "supertest";
import { describe, it, expect, beforeAll, vi } from "vitest";
import { __getTables } from "./__mocks__/supabase.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET || "in-secret";
vi.mock("../lib/supabase", async () => await import("./__mocks__/supabase.js"));

let app: any;

async function registerAndLogin(suffix: string) {
  const username = `u_${Date.now()}_${suffix}`;
  await request(app).post("/api/auth/register").send({ username, password: "pw" });
  const res = await request(app).post("/api/auth/login").send({ username, password: "pw" });
  const cookie = res.headers["set-cookie"]?.[0] as string;
  const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
  return { cookie, userId: me.body.id as string, username };
}

function seedDeck(userId: string, deckId: string) {
  const tables = __getTables();
  tables.decks.push({
    id: deckId,
    user_id: userId,
    name: `deck-${deckId}`,
    main_cards: [],
    cata_cards: [],
    deleted: false,
    created_at: new Date().toISOString(),
  });
}

describe("Game logs/results routes", () => {
  let host: { cookie: string; userId: string; username: string };
  let guest: { cookie: string; userId: string; username: string };
  const INTERNAL = { "x-internal-secret": process.env.INTERNAL_SECRET as string };

  beforeAll(async () => {
    const mod = await import("../app.js");
    app = mod.app;
    host = await registerAndLogin("host");
    guest = await registerAndLogin("guest");
  });

  it("create result (internal) -> 201 and get result (403 if not finished)", async () => {
    // create room and join
    const created = await request(app).post("/api/match/create").set("Cookie", host.cookie);
    const roomId = created.body.roomId as string;
    await request(app).post("/api/match/join").set("Cookie", guest.cookie).send({ roomId });
    // submit decks
    seedDeck(host.userId, "deck-hx");
    seedDeck(guest.userId, "deck-gx");
    await request(app).patch("/api/match/deck").set("Cookie", host.cookie).send({ roomId, deckId: "deck-hx" });
    await request(app).patch("/api/match/deck").set("Cookie", guest.cookie).send({ roomId, deckId: "deck-gx" });
    // create result
    const start = new Date().toISOString();
    const createdRes = await request(app).post("/api/game/result").set(INTERNAL).send({ roomId, startedAt: start });
    expect(createdRes.status).toBe(201);
    expect(createdRes.body).toHaveProperty("resultId");
    // get result before finished -> 403
    const getBefore = await request(app).get(`/api/game/result/${roomId}`).set("Cookie", host.cookie);
    expect(getBefore.status).toBe(403);
  });

  it("patch result to finished (internal) -> 200, then get result -> 200 with fields", async () => {
    const created = await request(app).post("/api/match/create").set("Cookie", host.cookie);
    const roomId = created.body.roomId as string;
    await request(app).post("/api/match/join").set("Cookie", guest.cookie).send({ roomId });
    seedDeck(host.userId, "deck-h2");
    seedDeck(guest.userId, "deck-g2");
    await request(app).patch("/api/match/deck").set("Cookie", host.cookie).send({ roomId, deckId: "deck-h2" });
    await request(app).patch("/api/match/deck").set("Cookie", guest.cookie).send({ roomId, deckId: "deck-g2" });
    const start = new Date().toISOString();
    const createdRes = await request(app).post("/api/game/result").set(INTERNAL).send({ roomId, startedAt: start });
    const endedAt = new Date().toISOString();
    const patched = await request(app)
      .patch(`/api/game/result/${roomId}`)
      .set(INTERNAL)
      .send({ result: "p1", endedAt });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ roomId, result: "p1", status: "finished" });
    const getAfter = await request(app).get(`/api/game/result/${roomId}`).set("Cookie", host.cookie);
    expect(getAfter.status).toBe(200);
    expect(getAfter.body).toHaveProperty("player1Id");
    expect(getAfter.body).toHaveProperty("player2Id");
    expect(getAfter.body).toHaveProperty("player1Deck");
    expect(getAfter.body).toHaveProperty("player2Deck");
  });

  it("turn logs: post internal -> ok, get as client -> 200 logs", async () => {
    const created = await request(app).post("/api/match/create").set("Cookie", host.cookie);
    const roomId = created.body.roomId as string;
    await request(app).post("/api/match/join").set("Cookie", guest.cookie).send({ roomId });
    const start = new Date().toISOString();
    const createdRes = await request(app).post("/api/game/result").set(INTERNAL).send({ roomId, startedAt: start });
    const resultId = createdRes.body.resultId as string;
    await request(app).post("/api/game/log").set(INTERNAL).send({ resultId, turn: 1, text: "t1" });
    await request(app).post("/api/game/log").set(INTERNAL).send({ resultId, turn: 2, text: "t2" });
    const got = await request(app).get(`/api/game/log/${roomId}`).set("Cookie", host.cookie);
    expect(got.status).toBe(200);
    expect(Array.isArray(got.body.logs)).toBe(true);
    expect(got.body.logs.length).toBe(2);
  });

  it("logs: 204 when no logs; 404 when room not found", async () => {
    // existing room, no logs
    const created = await request(app).post("/api/match/create").set("Cookie", host.cookie);
    const roomId = created.body.roomId as string;
    const res204 = await request(app).get(`/api/game/log/${roomId}`).set("Cookie", host.cookie);
    expect(res204.status).toBe(204);
    // not found
    const res404 = await request(app).get(`/api/game/log/NO_SUCH_ROOM`).set("Cookie", host.cookie);
    expect(res404.status).toBe(404);
  });
});


