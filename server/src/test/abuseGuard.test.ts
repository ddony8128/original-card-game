import { describe, it, expect } from 'vitest';
import {
  registerInvalidStrike,
  MAX_INVALID_STRIKES,
} from '../ws/abuseGuard';

describe('abuseGuard (보안: 허용되지 않은 입력 차단)', () => {
  it('임계치까지는 차단 신호를 내지 않는다', () => {
    const socket: { invalidStrikes?: number } = {};
    for (let i = 0; i < MAX_INVALID_STRIKES; i += 1) {
      expect(registerInvalidStrike(socket)).toBe(false);
    }
    expect(socket.invalidStrikes).toBe(MAX_INVALID_STRIKES);
  });

  it('임계치를 초과하면 차단 신호(true)를 낸다', () => {
    const socket: { invalidStrikes?: number } = {};
    for (let i = 0; i < MAX_INVALID_STRIKES; i += 1) {
      registerInvalidStrike(socket);
    }
    // MAX+1 번째 호출에서 차단
    expect(registerInvalidStrike(socket)).toBe(true);
  });
});
