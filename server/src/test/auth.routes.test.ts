import { describe, it, expect, beforeAll, vi } from "vitest";

// Ensure env before importing app/routers
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Mock supabase with in-memory implementation
vi.mock("../lib/supabase", async () => await import("./__mocks__/supabase.js"));

import request from "supertest";

describe("Auth routes", () => {
  let app: any;
  const username = `u_${Date.now()}`;
  const password = "pw1234";
  const badUsername = "bad-username";
  const badPassword = "bad-password";

  beforeAll(async () => {
    const mod = await import("../app.js");
    app = mod.app;
  });

  it("register -> 201", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username, password });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("username", username);
  });

  it("login -> httpOnly cookie set", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password });
    expect(res.status).toBe(200);
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toMatch(/auth_token=/);
  });

  it("login with bad credentials -> 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: badUsername, password: badPassword });
    expect(res.status).toBe(401);
  });

  it("me -> 200 with cookie", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ username, password });
    const cookie = login.headers["set-cookie"]?.[0];
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("username", username);
  });
});

