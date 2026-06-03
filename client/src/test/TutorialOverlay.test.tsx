import { render, screen, fireEvent } from '@testing-library/react';
import { TutorialOverlay } from '@/features/game/components/TutorialOverlay';
import { tutorialSteps } from '@/features/game/components/tutorialSteps';
import i18n from '@/i18n';

// 튜토리얼 스텝은 i18n 키로 저장되므로, 렌더된 실제 텍스트는 t()로 해석해 비교한다.
const stepTitle = (i: number) => i18n.t(tutorialSteps[i].titleKey);
const stepBody = (i: number) => i18n.t(tutorialSteps[i].bodyKey);

describe('TutorialOverlay', () => {
  it('1단계를 먼저 보여준다', () => {
    render(<TutorialOverlay />);
    expect(screen.getByText(stepTitle(0))).toBeTruthy();
    expect(screen.getByText(stepBody(0))).toBeTruthy();
  });

  it('"다음"을 누르면 2단계로 진행한다', () => {
    render(<TutorialOverlay />);
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByText(stepTitle(1))).toBeTruthy();
    expect(screen.queryByText(stepTitle(0))).toBeNull();
  });

  it('"건너뛰기"를 누르면 닫히고 다시 보기 버튼이 나타난다', () => {
    render(<TutorialOverlay />);
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(screen.queryByText(stepTitle(0))).toBeNull();
    expect(screen.getByRole('button', { name: '튜토리얼 다시 보기' })).toBeTruthy();
  });
});
