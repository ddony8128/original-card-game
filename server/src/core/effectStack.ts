import type { Effect } from './effectTypes';

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


