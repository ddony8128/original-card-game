# Engine architecture: pure engine + injected script interpreter

This folder implements the game engine as a **pure state machine** whose
rule-specific behavior (effect resolution, action handling) is **injected from
the outside** via `EngineConfig`. This separation lets a different rule-set be
plugged in without touching the core.

## Pure engine (state machine)

The pure engine knows about state and stack mechanics, but not about what any
specific card/effect *does*.

- **`GameEngineCore`** (`gameEngineCore.ts`) — the state machine. It owns the
  game `state` (decks / board / graveyard / players), the phase transitions, the
  `EffectStack` processing loop (`stepUntilStable`), player-input/mulligan flow,
  game-over checks, and state-patch generation. It does **not** hard-code what an
  effect or an action does — those are injected (see below).
- **`EffectStack`** (`../effects/effectStack.ts`) — the LIFO stack of pending
  effects the core drains in `stepUntilStable`.
- **`ObserverRegistry`** (`../observers`) — tracks board-installed ritual
  triggers (`onTurnStart` / `onTurnEnd` / ...) so the core can enqueue triggered
  effects.
- **board / state helpers** (`boardUtils.ts`, `view.ts`) — coordinate math,
  fogged-state/diff patch building.

## Injected script layer (rule interpreter)

This is the part that is injected and can be swapped per rule-set.

- **Effect resolvers** (`resolvers/`, dispatched by `effectResolver.ts`) —
  `resolveEffect` maps an `Effect['type']` to a concrete resolver
  (`MANA_PAY → resolveManaPay`, `DAMAGE → resolveDamage`, ...). This is the
  "script interpreter" that actually mutates state for each effect.
- **Action handlers** (`actionHandlers.ts`) — `handleMoveAction`,
  `handleEndTurnAction`, `handleUseCardAction` translate a `player_action`
  payload into validation + effects pushed onto the stack.
- **Schema-driven effect building** (`../effects/schema`) — parses card
  `effectJson` and builds the concrete effects an action/trigger enqueues.

## Injection points (`EngineConfig`)

`GameEngineCore.create(initialState, ctx, config)` reads two optional fields
from `EngineConfig`:

| Field            | Type               | Default                  | Purpose |
| ---------------- | ------------------ | ------------------------ | ------- |
| `effectResolver` | `EffectResolverFn` | `defaultEffectResolver`  | `(engine, effect, diff) => void`. Called by `stepUntilStable` for every popped effect. |
| `actionHandlers` | `ActionHandlerMap` | `defaultActionHandlers`  | `Partial<Record<PlayerActionKind, ActionHandler>>`. Looked up by `handlePlayerAction` to dispatch a `player_action`. |

`ActionHandler` has the signature
`(engine, playerId, action) => Promise<EngineResult[]>`.

### Defaults preserve current behavior

`defaultScripts.ts` exports the defaults:

- `defaultEffectResolver` === `resolveEffect`.
- `defaultActionHandlers` wraps the existing action functions, doing the same
  payload narrowing the old hard-coded `switch` did
  (`move`/`end_turn`/`use_card`/`use_ritual`).

The core merges any injected `actionHandlers` over the defaults
(`{ ...defaultActionHandlers, ...injected }`), so injecting only `move` leaves
the other kinds on their defaults. A `player_action` whose kind has no handler
still returns `invalid_action: 'unknown_action'`, exactly as before. When
nothing is injected, behavior is byte-for-byte identical to the previous
hard-coded implementation.

### Avoiding import cycles

`gameEngineCore.ts` imports the default values from `defaultScripts.ts` at
runtime. `defaultScripts.ts` imports `resolveEffect` and the action handlers at
runtime, but imports `GameEngineCore` / `EngineResult` as **types only**
(`import type`). Because `actionHandlers.ts` and `effectResolver.ts` likewise
only type-import `GameEngineCore`, there is no runtime back-edge into
`gameEngineCore.ts`, so no cycle is created.

## Injecting a custom rule-set

```ts
import { GameEngineCore } from './gameEngineCore';
import type { ActionHandler } from './defaultScripts';

const customMove: ActionHandler = async (engine, playerId, action) => {
  // ...alternative move rules...
  return engine.invalidAction(playerId, 'custom');
};

const engine = GameEngineCore.create(initialState, ctx, {
  roomCode,
  players,
  // override one action; the rest fall back to defaults
  actionHandlers: { move: customMove },
  // optionally swap the whole effect interpreter
  // effectResolver: myEffectResolver,
});
```

`GameEngineAdapter.create` forwards the same `EngineConfig` fields, so a custom
rule-set can also be supplied at the composition root.
