import { render, screen, fireEvent } from '@testing-library/react';
import {
  RequestInputModal,
  type InputRequest,
} from '@/components/game/RequestInputModal';

const discardRequest: InputRequest = {
  type: 'discard',
  prompt: '버릴 카드를 1장 선택하세요.',
  options: [{ name: '카드A' }, { name: '카드B' }],
  minSelect: 1,
  maxSelect: 1,
};

const mulliganRequest: InputRequest = {
  type: 'mulligan',
  prompt: '멀리건할 카드를 선택하세요.',
  options: [{ name: '카드A' }],
  minSelect: 0,
  maxSelect: 1,
};

describe('RequestInputModal C-2: 필수 입력은 닫을 수 없다', () => {
  it('dismissible=false 면 취소 버튼이 없고 ESC 로도 onCancel 이 호출되지 않는다', () => {
    const onCancel = vi.fn();
    render(
      <RequestInputModal
        request={discardRequest}
        dismissible={false}
        onResponse={() => {}}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('버릴 카드를 1장 선택하세요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '취소' })).toBeNull();

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    // 모달이 여전히 떠 있어야 한다.
    expect(screen.getByText('버릴 카드를 1장 선택하세요.')).toBeTruthy();
  });

  it('멀리건(dismissible=true)은 취소가 가능하다', () => {
    const onCancel = vi.fn();
    render(
      <RequestInputModal
        request={mulliganRequest}
        dismissible={true}
        onResponse={() => {}}
        onCancel={onCancel}
      />,
    );

    const cancelBtn = screen.getByRole('button', { name: '취소' });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
