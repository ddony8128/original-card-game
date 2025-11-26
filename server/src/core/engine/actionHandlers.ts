import type { PlayerID, CardInstance } from '../../type/gameState';
import type { GameEngineCore, EngineResult } from './index';
import { MOVE_MANA_COST } from '../rules/constants';
import { isInsideBoard, fromViewerPos } from './boardUtils';
import type {
  MoveEffect,
  TurnEndEffect,
  CastExecuteEffect,
  ManaPayEffect,
  ThrowResolveStackEffect,
} from '../effects/effectTypes';

export async function handleMoveAction(
  engine: GameEngineCore,
  playerId: PlayerID,
  payload: { to: [number, number] },
): Promise<EngineResult[]> {
  const wizard = engine.state.board.wizards[playerId];
  const checkWizardExists = engine.require(!!wizard, playerId, 'no_wizard');
  if (checkWizardExists) return checkWizardExists;

  // 클라이언트에서 온 좌표는 viewer 기준이므로, 절대 좌표로 변환한다.
  const [viewR, viewC] = payload.to;
  const absPos = fromViewerPos(
    engine.state.board,
    engine.bottomSidePlayerId,
    { r: viewR, c: viewC },
    playerId,
  );
  const toR = absPos.r;
  const toC = absPos.c;

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

  const payEffect: ManaPayEffect = {
    type: 'MANA_PAY',
    owner: playerId,
    amount: MOVE_MANA_COST,
  };
  const effect: MoveEffect = {
    type: 'MOVE',
    owner: playerId,
    to: { r: toR, c: toC },
  };

  // 코스트 지불 후 이동이 실행되도록, [MANA_PAY, MOVE] 순으로 전달한다.
  engine.effectStack.push([payEffect, effect]);
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

  // 손에서 카드는 즉시 제거하되, 마나 차감은 effectStack에서 처리
  playerState.hand.splice(handIndex, 1);

  // 사용한 카드를 resolveStack 에 올려 두고,
  // 이후 THROW_RESOLVE_STACK 이 최종 목적지로 이동시킨다.
  playerState.resolveStack.push({ card: usedInstance });

  // instant / ritual 공통: 마나 지불 후 CAST_EXECUTE 실행,
  // 마지막에 THROW_RESOLVE_STACK 로 카드의 최종 위치 결정.
  const payEffect: ManaPayEffect = {
    type: 'MANA_PAY',
    owner: playerId,
    amount: manaCost,
  };
  const effect: CastExecuteEffect = {
    type: 'CAST_EXECUTE',
    owner: playerId,
    cardId,
    sourceInstanceId: usedInstance.id,
  };
  const throwEffect: ThrowResolveStackEffect = {
    type: 'THROW_RESOLVE_STACK',
    owner: playerId,
  };

  // 코스트 지불 → CAST_EXECUTE → THROW_RESOLVE_STACK 순으로 실행되도록 push
  engine.effectStack.push([payEffect, effect, throwEffect]);
  const results = await engine.stepUntilStable();
  return results;
}
