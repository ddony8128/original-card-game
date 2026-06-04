import type { DiffPatch } from '../../../type/wsProtocol';
import type { GameEngineCore } from '../gameEngineCore';
import type { ManaPayEffect, ManaGainEffect } from '../../effects/effectTypes';

export async function resolveManaPay(
  engine: GameEngineCore,
  effect: ManaPayEffect,
  diff: DiffPatch,
) {
  const manaPay = effect;
  const player = engine.state.players[manaPay.owner];
  if (!player) return;
  player.mana = Math.max(player.mana - manaPay.amount, 0);
  diff.log.push(
    `{{p:${manaPay.owner}}}가 마나 ${manaPay.amount}을(를) 지불했습니다.`,
  );
}

export async function resolveManaGain(
  engine: GameEngineCore,
  effect: ManaGainEffect,
  diff: DiffPatch,
) {
  const manaGain = effect;
  const targetId =
    manaGain.target === 'self'
      ? manaGain.owner
      : Object.keys(engine.state.players).find((id) => id !== manaGain.owner);
  if (!targetId) return;
  const player = engine.state.players[targetId];
  if (!player) return;
  const before = player.mana;
  player.mana += manaGain.value;
  const gained = player.mana - before;
  if (gained > 0) {
    diff.log.push(
      `{{p:${targetId}}} 마나 +${gained} (${player.mana}/${player.maxMana})`,
    );
  }
}
