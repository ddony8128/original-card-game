import { render, screen, fireEvent } from '@testing-library/react';
import { TutorialOverlay } from '@/features/game/components/TutorialOverlay';
import { tutorialSteps } from '@/features/game/components/tutorialSteps';

describe('TutorialOverlay', () => {
  it('1단계를 먼저 보여준다', () => {
    render(<TutorialOverlay />);
    expect(screen.getByText(tutorialSteps[0].title)).toBeTruthy();
    expect(screen.getByText(tutorialSteps[0].body)).toBeTruthy();
  });

  it('"다음"을 누르면 2단계로 진행한다', () => {
    render(<TutorialOverlay />);
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText(tutorialSteps[1].title)).toBeTruthy();
    expect(screen.queryByText(tutorialSteps[0].title)).toBeNull();
  });

  it('"건너뛰기"를 누르면 닫히고 다시 보기 버튼이 나타난다', () => {
    render(<TutorialOverlay />);
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(screen.queryByText(tutorialSteps[0].title)).toBeNull();
    expect(screen.getByRole('button', { name: '튜토리얼 다시 보기' })).toBeTruthy();
  });
});
