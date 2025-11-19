import { useState } from 'react';
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
}

export function RequestInputModal({ request, onResponse, onCancel }: RequestInputModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<InputOption[]>([]);

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
    <Dialog open={!!request} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {request.type === 'mulligan' && '🔄 멀리건'}
            {request.type === 'move' && '🚶 이동'}
            {request.type === 'target' && '🎯 대상 선택'}
            {request.type === 'discard' && '🗑️ 카드 버리기'}
            {request.type === 'burn' && '🔥 카드 폐기'}
            {request.type === 'ritual_placement' && '🔮 Ritual 설치'}
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
                              마나: {(option as { mana?: number }).mana}
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
                          위치: {(option as { x: number; y: number }).x},{' '}
                          {(option as { x: number; y: number }).y}
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
            {onCancel && (
              <Button variant="outline" onClick={handleClose}>
                취소
              </Button>
            )}
            <Button onClick={handleConfirm} disabled={!canConfirm}>
              확인
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
