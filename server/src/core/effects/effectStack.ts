import type { Effect } from './effectTypes';

/**
 * 카드 효과들을 LIFO 방식으로 처리하기 위한 간단한 스택 래퍼.
 *
 * - 엔진은 모든 상태 변경을 Effect 단위로 표현하고,
 *   이 스택에 push/ pop 하면서 순차적으로 resolveEffect 에서 해석한다.
 * - Effect 배열을 push 할 때는 **역순으로 집어 넣어서**
 *   사람이 읽는 순서대로([A, B] → A 먼저, 그 다음 B) 실행되도록 맞춘다.
 */
export class EffectStack {
  private readonly stack: Effect[] = [];

  push(effect: Effect | Effect[]) {
    if (Array.isArray(effect)) {
      // 역순으로 넣어서 LIFO 해석이 자연스럽게 되도록 함
      for (let i = effect.length - 1; i >= 0; i -= 1) {
        this.stack.push(effect[i]);
      }
    } else {
      this.stack.push(effect);
    }
  }

  pop(): Effect | undefined {
    return this.stack.pop();
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  clear() {
    this.stack.length = 0;
  }
}
