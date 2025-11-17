import type { GameState, FoggedGameState, PlayerID } from './gameState';
import { GamePhase } from './gameState';

export type GameEvent = { type: string; payload?: unknown };
export type Effect = unknown;

export class EffectStack {
  // placeholder stack
  private readonly stack: Effect[] = [];
}

export class ObserverRegistry {
  // placeholder registry
}

export class RuleModifierLayer {
  // placeholder modifiers
}

export class GameEngine {
  state: GameState;
  effectStack: EffectStack;
  observers: ObserverRegistry;
  modifiers: RuleModifierLayer;

  constructor(initialState: GameState) {
    this.state = initialState;
    this.effectStack = new EffectStack();
    this.observers = new ObserverRegistry();
    this.modifiers = new RuleModifierLayer();
  }

  // ---- 주요 엔진 기능 ----
  pushEffect(_effect: Effect) {}
  resolveStack() {}
  applyEvent(_event: GameEvent) {}
  askClientInput(..._args: unknown[]) {}
  isGameOver(): boolean {
    return this.state.phase === GamePhase.GAME_OVER;
  }
  toFoggedState(_playerId: PlayerID): FoggedGameState {
    throw new Error('toFoggedState not implemented');
  }
}
