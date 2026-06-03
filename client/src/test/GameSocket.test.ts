import { createGameSocket } from '@/ws/gameSocket';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // 테스트 헬퍼
  mockOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  mockDrop() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe('createGameSocket 재연결 (C-4)', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('예기치 않게 끊기면 백오프 후 재연결을 시도한다', () => {
    const sock = createGameSocket({ roomCode: 'R', userId: 'u' });
    sock.connect();
    expect(MockWebSocket.instances).toHaveLength(1);

    MockWebSocket.instances[0].mockOpen();
    expect(sock.getStatus()).toBe('open');

    // 예기치 않은 끊김
    MockWebSocket.instances[0].mockDrop();
    expect(sock.getStatus()).toBe('connecting');
    expect(MockWebSocket.instances).toHaveLength(1); // 아직 즉시 재연결 안 함

    // 첫 백오프(500ms) 경과 → 새 소켓 생성
    vi.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('재연결 백오프는 연속 실패 시 증가한다', () => {
    const sock = createGameSocket({ roomCode: 'R', userId: 'u' });
    sock.connect();
    MockWebSocket.instances[0].mockDrop(); // attempts=1 → 500ms
    vi.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(2);

    MockWebSocket.instances[1].mockDrop(); // attempts=2 → 1000ms
    vi.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(2); // 아직 1000ms 안 됨
    vi.advanceTimersByTime(500);
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('의도적 close() 후에는 재연결하지 않는다', () => {
    const sock = createGameSocket({ roomCode: 'R', userId: 'u' });
    sock.connect();
    MockWebSocket.instances[0].mockOpen();

    sock.close();
    expect(sock.getStatus()).toBe('closed');
    vi.advanceTimersByTime(20_000);
    expect(MockWebSocket.instances).toHaveLength(1); // 재연결 없음
  });

  it('재연결에 성공하면 ready 를 다시 보낸다', () => {
    const sock = createGameSocket({ roomCode: 'R', userId: 'u' });
    sock.connect();
    MockWebSocket.instances[0].mockOpen();
    expect(MockWebSocket.instances[0].sent).toHaveLength(1); // 최초 ready

    MockWebSocket.instances[0].mockDrop();
    vi.advanceTimersByTime(500);
    MockWebSocket.instances[1].mockOpen();
    expect(MockWebSocket.instances[1].sent).toHaveLength(1); // 재연결 후 ready 재전송
  });
});
