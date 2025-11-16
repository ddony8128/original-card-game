import { supabase } from '../lib/supabase';
import { DeckList } from '../type/deck';

export type GameResultRow = {
  id: string;
  room_id: string; // rooms.id (uuid)
  started_at?: string;
  ended_at?: string | null;
  player1_id?: string | null;
  player2_id?: string | null;
  deck1?: { mainCards: DeckList; cataCards: DeckList } | null;
  deck2?: { mainCards: DeckList; cataCards: DeckList } | null;
  winner_id?: string | null;
  result?: 'p1' | 'p2' | 'draw' | null;
  created_at?: string;
};

export type TurnLogRow = {
  id: number;
  game_id: string;
  turn: number;
  log_text: string;
  created_at?: string;
};

export const logsService = {
  async findRoomByCode(roomCode: string): Promise<{
    id: string;
    code: string;
    status: 'waiting' | 'playing' | 'finished';
    host_id: string;
    guest_id: string | null;
    host_deck_id?: string | null;
    guest_deck_id?: string | null;
  } | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode)
      .maybeSingle();
    if (error) throw error;
    return (data as any) ?? null;
  },

  async getDeckSnapshot(deckId: string | null | undefined): Promise<{
    mainCards: DeckList;
    cataCards: DeckList;
  } | null> {
    if (!deckId) return null;
    const { data, error } = await supabase
      .from('decks')
      .select('main_cards,cata_cards')
      .eq('id', deckId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      mainCards: (data as any).main_cards,
      cataCards: (data as any).cata_cards,
    };
  },

  async createGameResult(
    roomCode: string,
    startedAt: string,
  ): Promise<{ resultId: string; roomId: string }> {
    const room = await this.findRoomByCode(roomCode);
    if (!room)
      throw Object.assign(new Error('room not found'), { code: 'NOT_FOUND' });

    const [deck1, deck2] = await Promise.all([
      this.getDeckSnapshot((room as any).host_deck_id ?? null),
      this.getDeckSnapshot((room as any).guest_deck_id ?? null),
    ]);

    const payload = {
      room_id: room.id,
      started_at: startedAt,
      player1_id: room.host_id,
      player2_id: room.guest_id,
      deck1,
      deck2,
      result: null,
      winner_id: null,
    };

    const { data, error } = await supabase
      .from('game_results')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return { resultId: (data as any).id, roomId: room.code };
  },

  async updateGameResult(
    roomCode: string,
    result: 'p1' | 'p2' | 'draw',
    endedAt: string,
  ) {
    const room = await this.findRoomByCode(roomCode);
    if (!room)
      throw Object.assign(new Error('room not found'), { code: 'NOT_FOUND' });

    const { data: gr, error: findErr } = await supabase
      .from('game_results')
      .select('*')
      .eq('room_id', room.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!gr)
      throw Object.assign(new Error('game result not found'), {
        code: 'NOT_FOUND',
      });

    let winner_id: string | null = null;
    if (result === 'p1') winner_id = (gr as any).player1_id ?? room.host_id;
    else if (result === 'p2')
      winner_id = (gr as any).player2_id ?? room.guest_id;

    const { error: upErr } = await supabase
      .from('game_results')
      .update({ result, winner_id, ended_at: endedAt })
      .eq('id', (gr as any).id);
    if (upErr) throw upErr;

    // also mark room finished
    const { error: roomErr } = await supabase
      .from('rooms')
      .update({ status: 'finished' })
      .eq('id', room.id);
    if (roomErr) throw roomErr;

    return { roomId: room.code, result, status: 'finished' as const };
  },

  async getFinishedGameResult(roomCode: string) {
    const room = await this.findRoomByCode(roomCode);
    if (!room)
      throw Object.assign(new Error('room not found'), { code: 'NOT_FOUND' });
    if (room.status !== 'finished')
      throw Object.assign(new Error('game not finished'), {
        code: 'FORBIDDEN',
      });

    const { data: gr, error } = await supabase
      .from('game_results')
      .select('*')
      .eq('room_id', room.id)
      .maybeSingle();
    if (error) throw error;
    if (!gr)
      throw Object.assign(new Error('game result not found'), {
        code: 'NOT_FOUND',
      });

    return {
      roomId: room.code,
      player1Id: (gr as any).player1_id,
      player2Id: (gr as any).player2_id,
      result: (gr as any).result,
      winnerId: (gr as any).winner_id,
      startedAt: (gr as any).started_at,
      endedAt: (gr as any).ended_at,
      player1Deck: (gr as any).deck1 ?? null,
      player2Deck: (gr as any).deck2 ?? null,
    };
  },

  async createTurnLog(resultId: string, turn: number, text: string) {
    const row = { game_id: resultId, turn, log_text: text };
    const { error } = await supabase.from('game_turn_logs').insert(row);
    if (error) throw error;
  },

  async getLogs(
    roomCode: string,
  ): Promise<{
    roomExists: boolean;
    logs: Array<{ turn: number; text: string }>;
  }> {
    const room = await this.findRoomByCode(roomCode);
    if (!room) return { roomExists: false, logs: [] };
    const { data: gr, error } = await supabase
      .from('game_results')
      .select('id')
      .eq('room_id', room.id)
      .maybeSingle();
    if (error) throw error;
    if (!gr) return { roomExists: true, logs: [] };
    const { data: rows, error: logErr } = await supabase
      .from('game_turn_logs')
      .select('turn,log_text')
      .eq('game_id', (gr as any).id)
      .order('turn', { ascending: true });
    if (logErr) throw logErr;
    const logs = (rows ?? []).map((r: any) => ({
      turn: r.turn as number,
      text: r.log_text as string,
    }));
    return { roomExists: true, logs };
  },
};
