type SocketClient = import('ws').WebSocket & {
  roomCode?: string;
  userId?: string;
};

export class SocketManager {
  private readonly rooms = new Map<string, Set<SocketClient>>();
  private readonly roomUsers = new Map<
    string,
    Map<string, Set<SocketClient>>
  >();

  joinRoom(roomCode: string, socket: SocketClient, userId?: string) {
    socket.roomCode = roomCode;
    if (userId) socket.userId = userId;
    if (!this.rooms.has(roomCode)) this.rooms.set(roomCode, new Set());
    this.rooms.get(roomCode)!.add(socket);
    if (userId) {
      if (!this.roomUsers.has(roomCode))
        this.roomUsers.set(roomCode, new Map());
      const map = this.roomUsers.get(roomCode)!;
      if (!map.has(userId)) map.set(userId, new Set());
      map.get(userId)!.add(socket);
    }
  }

  leave(socket: SocketClient) {
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    if (this.rooms.has(roomCode)) {
      this.rooms.get(roomCode)!.delete(socket);
      if (this.rooms.get(roomCode)!.size === 0) this.rooms.delete(roomCode);
    }
    const userId = socket.userId;
    if (userId && this.roomUsers.has(roomCode)) {
      const map = this.roomUsers.get(roomCode)!;
      if (map.has(userId)) {
        map.get(userId)!.delete(socket);
        if (map.get(userId)!.size === 0) map.delete(userId);
      }
      if (map.size === 0) this.roomUsers.delete(roomCode);
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
    const users = this.roomUsers.get(roomCode);
    if (!users) return;
    const targets = users.get(userId);
    if (!targets) return;
    const payload = JSON.stringify(data);
    targets.forEach((client) => {
      if (client.readyState === client.OPEN) client.send(payload);
    });
  }
}
