export type SocketClient = import('ws').WebSocket & {
  roomCode?: string;
  userId?: string;
};

export class SocketManager {
  private readonly rooms = new Map<string, Set<SocketClient>>();
  // 각 방을 SocketClient의 집합으로서 관리

  joinRoom(roomCode: string, socket: SocketClient, userId?: string) {
    socket.roomCode = roomCode;
    if (userId) socket.userId = userId;
    if (!this.rooms.has(roomCode)) this.rooms.set(roomCode, new Set());
    this.rooms.get(roomCode)!.add(socket);
  }

  leave(socket: SocketClient) {
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    if (this.rooms.has(roomCode)) {
      this.rooms.get(roomCode)!.delete(socket);
      if (this.rooms.get(roomCode)!.size === 0) this.rooms.delete(roomCode);
    }
  }

  broadcast(roomCode: string, data: unknown) {
    const clients = this.rooms.get(roomCode);
    if (!clients) return;
    const payload = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(payload);
    });
  }

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
