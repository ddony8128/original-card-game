import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type InputRequestType =
  | 'mulligan'
  | 'move'
  | 'target'
  | 'discard'
  | 'burn'
  | 'ritual_placement';

export type InputOption =
  | string
  | { name: string }
  | { x: number; y: number }
  | (Record<string, unknown> & { [key: string]: unknown });

export interface InputRequest {
  type: InputRequestType;
  prompt: string;
  options?: InputOption[];
  minSelect?: number;
  maxSelect?: number;
}

interface RequestInputModalProps {
  request: InputRequest | null;
  onResponse: (response: InputOption[]) => void;
  onCancel?: () => void;
  /**
   * false 이면 배경/ESC/X 로 닫을 수 없다.
   * 서버가 응답을 기다리는 필수 입력(버리기/폐기 등)에서 모달을 닫아버리면
   * 서버가 입력 대기 상태로 멈추므로(C-2), 그런 요청은 dismissible=false 로 둔다.
   */
  dismissible?: boolean;
}

export function RequestInputModal({
  request,
  onResponse,
  onCancel,
  dismissible = true,
}: RequestInputModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<InputOption[]>([]);
  const { t } = useTranslation();

  if (!request) return null;

  const handleToggleOption = (option: InputOption) => {
    const isSelected = selectedOptions.includes(option);

    if (isSelected) {
      setSelectedOptions(selectedOptions.filter((o) => o !== option));
    } else {
      const maxSelect = request.maxSelect ?? 1;
      if (selectedOptions.length < maxSelect) {
        setSelectedOptions([...selectedOptions, option]);
      }
    }
  };

  const handleConfirm = () => {
    onResponse(selectedOptions);
    setSelectedOptions([]);
  };

  const handleClose = () => {
    setSelectedOptions([]);
    onCancel?.();
  };

  const canConfirm =
    selectedOptions.length >= (request.minSelect ?? 0) &&
    selectedOptions.length <= (request.maxSelect ?? Number.POSITIVE_INFINITY);

  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open && dismissible) handleClose();
      }}
    >
      <DialogContent
        className="max-w-2xl"
        onEscapeKeyDown={(e) => {
          if (!dismissible) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (!dismissible) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {request.type === 'mulligan' && t('game.reqMulligan')}
            {request.type === 'move' && t('game.reqMove')}
            {request.type === 'target' && t('game.reqTarget')}
            {request.type === 'discard' && t('game.reqDiscard')}
            {request.type === 'burn' && t('game.reqBurn')}
            {request.type === 'ritual_placement' && t('game.reqRitualPlacement')}
          </DialogTitle>
          <DialogDescription>{request.prompt}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 선택 옵션 표시 */}
          {request.options && request.options.length > 0 && (
            <div className="grid max-h-96 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-3">
              {request.options.map((option, index) => {
                const isSelected = selectedOptions.includes(option);
                return (
                  <Card
                    key={index}
                    className={`cursor-pointer p-4 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 scale-105'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleToggleOption(option)}
                  >
                    {/* 옵션 타입에 따라 다르게 렌더링 */}
                    {typeof option === 'object' && option !== null && 'name' in option && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {(option as { name: string }).name}
                        </div>
                        {'mana' in option &&
                          typeof (option as { mana?: unknown }).mana === 'number' && (
                            <div className="text-xs">
                              {t('game.optMana', { mana: (option as { mana?: number }).mana })}
                            </div>
                          )}
                        {'description' in option &&
                          typeof (option as { description?: unknown }).description === 'string' && (
                            <div className="text-muted-foreground text-xs whitespace-pre-wrap">
                              {(option as { description?: string }).description}
                            </div>
                          )}
                      </div>
                    )}
                    {typeof option === 'object' &&
                      option !== null &&
                      'x' in option &&
                      'y' in option && (
                        <div className="text-sm">
                          {t('game.optPosition', {
                            x: (option as { x: number; y: number }).x,
                            y: (option as { x: number; y: number }).y,
                          })}
                        </div>
                      )}
                    {typeof option === 'string' && <div className="text-sm">{option}</div>}
                  </Card>
                );
              })}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex justify-end gap-2">
            {onCancel && dismissible && (
              <Button variant="outline" onClick={handleClose}>
                {t('game.cancel')}
              </Button>
            )}
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              {t('game.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
