import { describe, it, expect, vi } from "vitest";
vi.mock("../lib/supabase", async () => await import("./__mocks__/supabase.js"));
import { roomsService } from "../services/rooms";

describe("roomsService", () => {
  it("create -> waiting status and code", async () => {
    const room = await roomsService.create("host-1");
    expect(room.status).toBe("waiting");
    expect(typeof room.code).toBe("string");
  });

  it("join -> sets guest_id, prevents double join", async () => {
    const room = await roomsService.create("host-2");
    const j1 = await roomsService.join(room.code, "guest-2");
    expect(j1.room?.guest_id).toBe("guest-2");
    const j2 = await roomsService.join(room.code, "guest-3");
    expect(j2.full).toBe(true);
  });
});


