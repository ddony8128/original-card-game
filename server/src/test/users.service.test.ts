import { describe, it, expect, vi } from "vitest";
vi.mock("../lib/supabase", async () => await import("./__mocks__/supabase.js"));
import { usersService } from "../services/users";

describe("usersService", () => {
  it("create/find/verify", async () => {
    const u = await usersService.create(`u_${Date.now()}`, "pw");
    const found = await usersService.findByUsername(u.username);
    expect(found?.id).toBe(u.id);
    expect(usersService.verifyPassword("pw", found!)).toBe(true);
    expect(usersService.verifyPassword("wrong", found!)).toBe(false);
  });
});


