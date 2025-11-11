import crypto from "node:crypto";
import { supabase } from "../lib/supabase";

export type RoomRow = {
  id: string;
  host_id: string;
  guest_id: string | null;
  code: string;
  status: "waiting" | "playing" | "finished";
  host_deck_id?: string | null;
  guest_deck_id?: string | null;
  created_at?: string;
};

export const roomsService = {
  async create(host_id: string): Promise<RoomRow> {
    const genCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
    // 최대 10회 재시도 (중복 코드 회피)
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = genCode();
      // 사전 중복 검사 (경합 가능성은 있으나 확률 감소)
      const { data: existing, error: findErr } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (findErr) throw findErr;
      if (existing?.id) {
        continue; // 충돌 → 재시도
      }

      const payload = { host_id, code, status: "waiting" as const };
      const { data, error } = await supabase
        .from("rooms")
        .insert(payload)
        .select("*")
        .single();
      if (!error) return data as RoomRow;
      // DB에 고유 제약이 있다면 23505(duplicate key)일 수 있으므로 재시도
      if ((error as any)?.code === "23505") {
        continue;
      }
      throw error;
    }
    throw new Error("failed to generate unique room code");
  },

  async join(code: string, guest_id: string): Promise<{ notFound?: true; full?: true; room?: RoomRow }> {
    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;

    if (!room) {
      return { notFound: true as const };
    }
    if (room.guest_id) {
      return { full: true as const };
    }

    const { data, error: upErr } = await supabase
      .from("rooms")
      .update({ guest_id })
      .eq("id", room.id)
      .select("*")
      .single();

    if (upErr) throw upErr;
    return { room: data as RoomRow };
  },

  async byCode(code: string): Promise<RoomRow | null> {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    return (data as RoomRow) ?? null;
  },

  async submitDeckByCode(
    code: string,
    userId: string,
    deckId: string
  ): Promise<
    | { notFound: true }
    | { forbidden: true }
    | { room: RoomRow }
  > {
    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    if (!room) return { notFound: true as const };

    const isHost = room.host_id === userId;
    const isGuest = room.guest_id === userId;
    if (!isHost && !isGuest) return { forbidden: true as const };

    const next: any = {};
    if (isHost) next.host_deck_id = deckId;
    if (isGuest) next.guest_deck_id = deckId;

    const hostDeck = isHost ? deckId : (room as any).host_deck_id ?? null;
    const guestDeck = isGuest ? deckId : (room as any).guest_deck_id ?? null;
    if (hostDeck && guestDeck) next.status = "playing";

    const { data: updated, error: upErr } = await supabase
      .from("rooms")
      .update(next)
      .eq("id", (room as any).id)
      .select("*")
      .single();
    if (upErr) throw upErr;
    return { room: updated as RoomRow };
  },

  async finishByCode(code: string): Promise<{ notFound?: true; room?: RoomRow }> {
    const { data: room, error } = await supabase
      .from("rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    if (!room) return { notFound: true as const };

    const { data: updated, error: upErr } = await supabase
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", (room as any).id)
      .select("*")
      .single();
    if (upErr) throw upErr;
    return { room: updated as RoomRow };
  },

  async finishByCodeIfHost(
    code: string,
    userId: string
  ): Promise<{ notFound?: true; forbidden?: true; room?: RoomRow }> {
    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    if (!room) return { notFound: true as const };
    if (room.host_id !== userId) return { forbidden: true as const };

    const { data: updated, error: upErr } = await supabase
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", room.id)
      .select("*")
      .single();
    if (upErr) throw upErr;
    return { room: updated as RoomRow };
  }

};

