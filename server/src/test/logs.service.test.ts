import { describe, it, expect, vi } from "vitest";
vi.mock("../lib/supabase", async () => await import("./__mocks__/supabase.js"));
import { logsService } from "../services/logs";
import { __getTables } from "./__mocks__/supabase.js";

describe("logsService", () => {
  it(
    "createGameResult and updateGameResult, getFinishedGameResult",
    async () => {
      const tables = __getTables();
      const room = {
        id: crypto.randomUUID(),
        code: "RMTEST1",
        status: "playing",
        host_id: "h1",
        guest_id: "g1",
        host_deck_id: "d1",
        guest_deck_id: "d2",
      };
      // seed decks
      tables.decks.push({
        id: "d1",
        main_cards: [],
        cata_cards: [],
        name: "d1",
        user_id: "h1",
        deleted: false,
      });
      tables.decks.push({
        id: "d2",
        main_cards: [],
        cata_cards: [],
        name: "d2",
        user_id: "g1",
        deleted: false,
      });
      tables.rooms.push(room as any);

      const startedAt = new Date().toISOString();
      const created = await logsService.createGameResult(room.code, startedAt);
      expect(created.roomId).toBe(room.code);

      const endedAt = new Date().toISOString();
      const updated = await logsService.updateGameResult(
        room.code,
        "p1",
        endedAt
      );
      expect(updated).toMatchObject({
        roomId: room.code,
        result: "p1",
        status: "finished",
      });

      const got = await logsService.getFinishedGameResult(room.code);
      expect(got.roomId).toBe(room.code);
      expect(got.result).toBe("p1");
    }
  );

  it("createTurnLog and getLogs", async () => {
    const tables = __getTables();
    const room = {
      id: crypto.randomUUID(),
      code: "RMTEST2",
      status: "playing",
      host_id: "h1",
      guest_id: "g1",
    };
    tables.rooms.push(room as any);
    // minimal game_result
    tables.game_results.push({ id: "gr-1", room_id: room.id });

    await logsService.createTurnLog("gr-1", 1, "t1");
    await logsService.createTurnLog("gr-1", 2, "t2");

    const { roomExists, logs } = await logsService.getLogs(room.code);
    expect(roomExists).toBe(true);
    expect(logs.length).toBe(2);
  });
});
