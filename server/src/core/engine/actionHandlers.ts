import type { PlayerID, CardInstance } from '../../type/gameState';
import type { GameEngineCore, EngineResult } from './index';
import { MOVE_MANA_COST } from '../../state/gameInit';
import {
  isInsideBoard,
  computeInstallPositions,
  toViewerPos,
} from './boardUtils';
import { parseCardEffectJson } from '../effects/schema';
import type { RequestInputKind } from '../../type/wsProtocol';
import { GamePhase } from '../../type/gameState';
import type {
  MoveEffect,
  TurnEndEffect,
  CastExecuteEffect,
} from '../effectTypes';

export async function handleMoveAction(
  engine: GameEngineCore,
  playerId: PlayerID,
  payload: { to: [number, number] },
): Promise<EngineResult[]> {
  const wizard = engine.state.board.wizards[playerId];
  const checkWizardExists = engine.require(!!wizard, playerId, 'no_wizard');
  if (checkWizardExists) return checkWizardExists;

  const [toR, toC] = payload.to;
  const checkPositionValid = engine.require(
    isInsideBoard(engine.state.board, toR, toC),
    playerId,
    'out_of_board',
  );
  if (checkPositionValid) return checkPositionValid;

  // 상대 마법사가 있는 칸으로 이동 금지
  const occupiedByOtherWizard = Object.entries(engine.state.board.wizards).some(
    ([pid, pos]) => pid !== playerId && pos.r === toR && pos.c === toC,
  );
  const checkCellNotOccupied = engine.require(
    !occupiedByOtherWizard,
    playerId,
    'cell_occupied',
  );
  if (checkCellNotOccupied) return checkCellNotOccupied;

  const playerState = engine.state.players[playerId];
  const checkManaSufficient = engine.require(
    playerState.mana >= MOVE_MANA_COST,
    playerId,
    'not_enough_mana',
  );
  if (checkManaSufficient) return checkManaSufficient;

  playerState.mana -= MOVE_MANA_COST;

  const effect: MoveEffect = {
    type: 'MOVE',
    owner: playerId,
    to: { r: toR, c: toC },
  };

  engine.effectStack.push(effect);
  const results = await engine.stepUntilStable();
  return results;
}

export async function handleEndTurnAction(
  engine: GameEngineCore,
  playerId: PlayerID,
): Promise<EngineResult[]> {
  const checkIsActivePlayer = engine.require(
    engine.state.activePlayer === playerId,
    playerId,
    'not_your_turn',
  );
  if (checkIsActivePlayer) return checkIsActivePlayer;
  const effect: TurnEndEffect = {
    type: 'TURN_END',
    owner: playerId,
  };
  engine.effectStack.push(effect);
  return await engine.stepUntilStable();
}

export async function handleUseCardAction(
  engine: GameEngineCore,
  playerId: PlayerID,
  cardInstance: CardInstance,
  _target: [number, number] | undefined,
): Promise<EngineResult[]> {
  const playerState = engine.state.players[playerId];
  const checkPlayerExists = engine.require(
    !!playerState,
    playerId,
    'unknown_player',
  );
  if (checkPlayerExists) return checkPlayerExists;

  const handIndex = playerState.hand.findIndex(
    (ci) => ci.id === cardInstance.id,
  );
  const checkCardInHand = engine.require(
    handIndex !== -1,
    playerId,
    'card_not_in_hand',
  );
  if (checkCardInHand) return checkCardInHand;

  const usedInstance = playerState.hand[handIndex];
  const cardId = usedInstance.cardId;

  const meta = await engine.ctx.lookupCard(cardId);
  const checkCardMetaExists = engine.require(!!meta, playerId, 'unknown_card');
  if (checkCardMetaExists) return checkCardMetaExists;
  // require 체크 후에는 meta가 null이 아님을 보장
  if (!meta) return engine.invalidAction(playerId, 'unknown_card');

  const manaCost = meta.mana ?? 0;
  const checkManaSufficient = engine.require(
    playerState.mana >= manaCost,
    playerId,
    'not_enough_mana',
  );
  if (checkManaSufficient) return checkManaSufficient;

  // 마나 차감 및 손에서 제거
  playerState.mana -= manaCost;
  playerState.hand.splice(handIndex, 1);

  if (meta.type === 'ritual') {
    // 카드 효과 JSON 파싱하여 install.range 확인
    const parsed = parseCardEffectJson(meta.effectJson);
    const installRange = parsed?.install?.range;

    // 설치 가능한 위치 계산 → request_input (좌표는 플레이어 시점 기준으로 변환)
    const absOptions = computeInstallPositions(
      engine.state.board,
      playerId,
      installRange,
    );
    const options = absOptions.map((pos) =>
      toViewerPos(engine.state.board, engine.bottomSidePlayerId, pos, playerId),
    );
    const requestKind: RequestInputKind = {
      type: 'map',
      kind: 'select_install_position',
    };
    engine.pendingInput = {
      playerId,
      kind: requestKind,
      cardId,
      installRange,
    };
    engine.state.phase = GamePhase.WAITING_FOR_PLAYER_INPUT;
    return [
      {
        kind: 'request_input',
        targetPlayer: playerId,
        requestInput: {
          kind: requestKind,
          options,
        },
      },
    ];
  }

  // instant → 즉시 CAST_EXECUTE 효과만 push (타겟팅 등은 TODO)
  const effect: CastExecuteEffect = {
    type: 'CAST_EXECUTE',
    owner: playerId,
    cardId,
  };
  engine.effectStack.push(effect);
  const results = await engine.stepUntilStable();

  // burn되지 않은 instant 카드는 사용 후 grave로 이동
  if (!engine.burnedThisAction.has(cardId)) {
    playerState.grave.push(usedInstance);
  }
  engine.burnedThisAction.clear();

  return results;
}
