import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TutorialOutro } from '@/features/game/components/TutorialOutro';
import { useGameFogStore } from '@/shared/store/gameStore';
import type { FoggedGameState } from '@/shared/types/game';

function setFogged(state: Partial<FoggedGameState> | null) {
  useGameFogStore.setState({ fogged: state as FoggedGameState | null });
}

function renderOutro() {
  return render(
    <MemoryRouter initialEntries={['/tutorial']}>
      <Routes>
        <Route path="/tutorial" element={<TutorialOutro />} />
        <Route path="/deck-builder" element={<div>DECK_BUILDER</div>} />
        <Route path="/lobby" element={<div>LOBBY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TutorialOutro', () => {
  beforeEach(() => {
    useGameFogStore.getState().clear();
  });
  afterEach(() => {
    useGameFogStore.getState().clear();
  });

  it('게임 종료 전에는 아무것도 렌더하지 않는다', () => {
    setFogged({ phase: 'WAITING_FOR_PLAYER_ACTION' });
    renderOutro();
    expect(screen.queryByText('튜토리얼 완료!')).toBeNull();
    expect(screen.queryByRole('button', { name: /덱 만들러 가기/ })).toBeNull();
  });

  it('게임이 종료되면(GAME_OVER) 안내와 "덱 만들러 가기" 버튼을 보여준다', () => {
    setFogged({ phase: 'GAME_OVER' });
    renderOutro();
    expect(screen.getByText('튜토리얼 완료!')).toBeTruthy();
    expect(screen.getByText('이제 나만의 덱을 만들어 보세요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /덱 만들러 가기/ })).toBeTruthy();
  });

  it('"덱 만들러 가기"를 누르면 /deck-builder 로 이동한다', () => {
    setFogged({ phase: 'GAME_OVER' });
    renderOutro();
    fireEvent.click(screen.getByRole('button', { name: /덱 만들러 가기/ }));
    expect(screen.getByText('DECK_BUILDER')).toBeTruthy();
  });

  it('"로비로"를 누르면 /lobby 로 이동한다', () => {
    setFogged({ winner: 'u1' });
    renderOutro();
    fireEvent.click(screen.getByRole('button', { name: '로비로' }));
    expect(screen.getByText('LOBBY')).toBeTruthy();
  });
});
