/**
 * WebSocket 악용 입력 차단 가드.
 *
 * 허용되지 않은 메시지(파싱 실패/미인증 플러딩/알 수 없는 이벤트)를 단순 무시하지 않고
 * 소켓별로 누적 카운트하여, 임계치를 넘으면 연결을 차단(close)하도록 신호한다.
 */

// 소켓 하나가 허용되지 않은 메시지를 이 횟수보다 많이 보내면 차단한다.
export const MAX_INVALID_STRIKES = 20;

/**
 * 소켓의 strike 를 1 증가시키고, 차단해야 하는지(임계 초과) 여부를 반환한다.
 */
export function registerInvalidStrike(socket: {
  invalidStrikes?: number;
}): boolean {
  socket.invalidStrikes = (socket.invalidStrikes ?? 0) + 1;
  return socket.invalidStrikes > MAX_INVALID_STRIKES;
}
