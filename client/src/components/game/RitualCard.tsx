import { cn } from '@/shared/lib/utils';

interface RitualCardProps {
  /** 내가 소유한 ritual 인지 여부 */
  isMine: boolean;
  /** 이번 턴에 이미 사용했는지 */
  usedThisTurn: boolean;
  onClick?: () => void;
  isHovered?: boolean;
}

export function RitualCard({ isMine, usedThisTurn, onClick, isHovered }: RitualCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'absolute inset-0 flex cursor-pointer items-center justify-center',
        'transition-all duration-200',
        isHovered && 'z-10 scale-110',
      )}
    >
      {/* Ritual 마법진 이펙트 (바닥 레이어) */}
      <div
        className={cn(
          'absolute inset-2 rounded-full opacity-60',
          'animate-pulse border-4',
          isMine ? 'border-blue-400 bg-blue-500/20' : 'border-red-400 bg-red-500/20',
        )}
        style={{
          boxShadow: isMine
            ? '0 0 20px hsl(var(--mana-1) / 0.5)'
            : '0 0 20px hsl(var(--mana-5) / 0.5)',
        }}
      />

      {/* Ritual 아이콘 */}
      <div
        className={cn(
          'relative z-10 flex h-8 w-8 items-center justify-center rounded-full',
          'border-2 text-xs font-bold shadow-lg',
          isMine
            ? 'border-blue-400 bg-blue-600 text-white'
            : 'border-red-400 bg-red-600 text-white',
          usedThisTurn && 'opacity-50',
        )}
      >
        🔮
      </div>

      {/* 사용 완료 표시 */}
      {usedThisTurn && (
        <div className="border-border bg-muted absolute top-0 right-0 h-3 w-3 rounded-full border" />
      )}
    </div>
  );
}
