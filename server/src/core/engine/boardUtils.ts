import type { GameState, PlayerID } from '../../type/gameState';

// 보드 범위 체크
export function isInsideBoard(
  board: GameState['board'],
  r: number,
  c: number,
): boolean {
  return r >= 0 && c >= 0 && r < board.height && c < board.width;
}

// viewer가 보드의 아래쪽(기준)인지 여부
export function isBottomSide(
  bottomSidePlayerId: PlayerID | null,
  viewer: PlayerID,
): boolean {
  if (!bottomSidePlayerId) return true;
  return viewer === bottomSidePlayerId;
}

// 절대 좌표 → viewer 시점 좌표
export function toViewerPos(
  board: GameState['board'],
  bottomSidePlayerId: PlayerID | null,
  pos: { r: number; c: number },
  viewer: PlayerID,
): { r: number; c: number } {
  const { height } = board;
  if (isBottomSide(bottomSidePlayerId, viewer)) return pos;
  return { r: height - 1 - pos.r, c: pos.c };
}

// viewer 시점 좌표 → 절대 좌표
export function fromViewerPos(
  board: GameState['board'],
  bottomSidePlayerId: PlayerID | null,
  pos: { r: number; c: number },
  viewer: PlayerID,
): { r: number; c: number } {
  const { height } = board;
  if (isBottomSide(bottomSidePlayerId, viewer)) return pos;
  return { r: height - 1 - pos.r, c: pos.c };
}

// 피셔–예이츠 셔플
export function shuffle<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// 설치 가능한 위치 목록 계산
export function computeInstallPositions(
  board: GameState['board'],
  playerId: PlayerID,
  range?: number,
): { r: number; c: number }[] {
  const positions: { r: number; c: number }[] = [];
  const { width, height, rituals, wizards } = board;
  const occupied = new Set<string>();

  // 리추얼이 설치된 위치 제외
  rituals.forEach((r) => {
    occupied.add(`${r.pos.r},${r.pos.c}`);
  });

  // 상대 마법사가 위치한 곳 제외
  Object.entries(wizards).forEach(([pid, pos]) => {
    if (pid !== playerId) {
      occupied.add(`${pos.r},${pos.c}`);
    }
  });

  // 플레이어 마법사 위치 (range 체크용)
  const playerWizard = wizards[playerId];

  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const key = `${r},${c}`;
      if (occupied.has(key)) continue;

      // range가 제공되면 택시 거리 체크
      if (range !== undefined && playerWizard) {
        const taxiDistance =
          Math.abs(playerWizard.r - r) + Math.abs(playerWizard.c - c);
        if (taxiDistance > range) continue;
      }

      positions.push({ r, c });
    }
  }
  return positions;
}

// 특정 위치에 설치 가능한지 확인
export function canInstallAt(
  board: GameState['board'],
  playerId: PlayerID,
  pos: { r: number; c: number },
  range?: number,
): boolean {
  const { width, height, rituals, wizards } = board;

  // 보드 범위 체크
  if (pos.r < 0 || pos.r >= height || pos.c < 0 || pos.c >= width) {
    return false;
  }

  // 리추얼이 설치된 위치인지 확인
  const hasRitual = rituals.some((r) => r.pos.r === pos.r && r.pos.c === pos.c);
  if (hasRitual) return false;

  // 상대 마법사가 위치한 곳인지 확인
  const occupiedByOtherWizard = Object.entries(wizards).some(
    ([pid, wizardPos]) =>
      pid !== playerId && wizardPos.r === pos.r && wizardPos.c === pos.c,
  );
  if (occupiedByOtherWizard) return false;

  // range가 제공되면 택시 거리 체크
  if (range !== undefined) {
    const playerWizard = wizards[playerId];
    if (!playerWizard) return false;
    const taxiDistance =
      Math.abs(playerWizard.r - pos.r) + Math.abs(playerWizard.c - pos.c);
    if (taxiDistance > range) return false;
  }

  return true;
}

/**
 * 시전자의 cast_target(예: near_enemy)을 위해,
 * range 범위 안에 있는 상대 마법사 위치들을 계산한다.
 *
 * - 현재 게임은 1:1 구조이므로 0개 또는 1개의 위치만 반환된다.
 * - range 가 주어지면 택시 거리 기준으로 range 이내인 경우에만 포함된다.
 */
export function computeCastTargetPositions(
  board: GameState['board'],
  casterId: PlayerID,
  range?: number,
): { r: number; c: number }[] {
  const positions: { r: number; c: number }[] = [];
  const { wizards } = board;

  const casterPos = wizards[casterId];
  if (!casterPos) return positions;

  const enemyEntry = Object.entries(wizards).find(([pid]) => pid !== casterId);
  if (!enemyEntry) return positions;

  const enemyPos = enemyEntry[1];

  if (range !== undefined) {
    const taxiDistance =
      Math.abs(casterPos.r - enemyPos.r) + Math.abs(casterPos.c - enemyPos.c);
    if (taxiDistance > range) return positions;
  }

  positions.push({ r: enemyPos.r, c: enemyPos.c });
  return positions;
}
