/**
 * WS 클라이언트 타입 확장.
 * - 각 소켓이 어느 방(roomCode)에 속하는지
 * - 어떤 유저(userId)에 매핑되는지 추적한다.
 */
export type SocketClient = import('ws').WebSocket & {
  roomCode?: string;
  userId?: string;
};

/**
 * 방 단위로 WebSocket 클라이언트를 관리하는 유틸리티.
 *
 * - 메모리 상에서 roomCode → Set<SocketClient> 맵을 유지한다.
 * - 실제 게임 로직은 `GameRoomManager` 가 담당하고,
 *   이 클래스는 **송신 대상 집합 관리 + JSON 직렬화** 에만 집중한다.
 */
export class SocketManager {
  /** roomCode → 참여 중인 소켓 집합 */
  private readonly rooms = new Map<string, Set<SocketClient>>();

  /**
   * 소켓을 특정 방에 참여시킨다.
   * - 소켓 객체에 roomCode/userId 를 기록하고
   * - 내부 rooms 맵에 추가한다.
   */
  joinRoom(roomCode: string, socket: SocketClient, userId?: string) {
    socket.roomCode = roomCode;
    if (userId) socket.userId = userId;
    if (!this.rooms.has(roomCode)) this.rooms.set(roomCode, new Set());
    this.rooms.get(roomCode)!.add(socket);
  }

  /**
   * 소켓이 연결 해제되었을 때 방에서 제거한다.
   * - 방에 더 이상 소켓이 없으면 rooms 맵에서 방 entry 자체를 제거한다.
   */
  leave(socket: SocketClient) {
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    if (this.rooms.has(roomCode)) {
      this.rooms.get(roomCode)!.delete(socket);
      if (this.rooms.get(roomCode)!.size === 0) this.rooms.delete(roomCode);
    }
  }

  /**
   * 특정 방의 모든 소켓에게 동일한 메시지를 브로드캐스트한다.
   */
  broadcast(roomCode: string, data: unknown) {
    const clients = this.rooms.get(roomCode);
    if (!clients) return;
    const payload = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(payload);
    });
  }

  /**
   * 특정 방 안의 특정 userId 에게만 메시지를 보낸다.
   * - 같은 방에 여러 소켓이 있을 수 있으므로, userId 기준으로 필터링한다.
   */
  sendTo(roomCode: string, userId: string, data: unknown) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const payload = JSON.stringify(data);
    room.forEach((client) => {
      if (client.userId === userId && client.readyState === client.OPEN)
        client.send(payload);
    });
  }
}
