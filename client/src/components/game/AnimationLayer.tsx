import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/utils';

export type SimpleAnimation =
  | { type: 'draw'; value?: number }
  | { type: 'discard'; value?: number }
  | { type: 'burn'; value?: number }
  | { type: 'damage'; value?: number }
  | { type: 'heal'; value?: number }
  | { type: 'move' }
  | { type: 'ritual_place' }
  | { type: 'ritual_destroy' }
  | { type: 'shuffle' };

interface AnimationLayerProps {
  animations: SimpleAnimation[];
  onAnimationComplete?: (animation: SimpleAnimation) => void;
}

export function AnimationLayer({ animations, onAnimationComplete }: AnimationLayerProps) {
  const [activeAnimations, setActiveAnimations] = useState<SimpleAnimation[]>([]);

  useEffect(() => {
    if (animations.length > 0) {
      setActiveAnimations(animations);

      const timer = setTimeout(() => {
        animations.forEach((anim) => onAnimationComplete?.(anim));
        setActiveAnimations([]);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [animations, onAnimationComplete]);

  if (activeAnimations.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {activeAnimations.map((anim, index) => (
        <AnimationEffect key={index} animation={anim} />
      ))}
    </div>
  );
}

function AnimationEffect({ animation }: { animation: SimpleAnimation }) {
  const getAnimationClass = () => {
    switch (animation.type) {
      case 'draw':
        return 'animate-fade-in';
      case 'discard':
        return 'animate-fade-out';
      case 'burn':
        return 'animate-scale-out';
      case 'damage':
        return 'animate-shake';
      case 'heal':
        return 'animate-pulse';
      default:
        return 'animate-fade-in';
    }
  };

  const getIcon = () => {
    switch (animation.type) {
      case 'draw':
        return '📥';
      case 'discard':
        return '🗑️';
      case 'burn':
        return '🔥';
      case 'damage':
        return '💥';
      case 'heal':
        return '💚';
      case 'move':
        return '🚶';
      case 'ritual_place':
        return '🔮';
      case 'ritual_destroy':
        return '💨';
      case 'shuffle':
        return '🔄';
      default:
        return '✨';
    }
  };

  const renderValue = () => {
    if (!('value' in animation) || animation.value === undefined) return null;
    const amount = Math.abs(animation.value);
    if (animation.type === 'damage') {
      return (
        <span className="absolute -top-6 -right-6 text-4xl font-extrabold text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]">
          -{amount}
        </span>
      );
    }
    if (animation.type === 'heal') {
      return (
        <span className="absolute -top-6 -right-6 text-4xl font-extrabold text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]">
          +{amount}
        </span>
      );
    }
    return (
      <span className="text-primary absolute -top-4 -right-4 text-2xl font-bold">
        {amount}
      </span>
    );
  };

  return (
    <div
      className={cn(
        'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'text-6xl',
        getAnimationClass(),
      )}
    >
      {getIcon()}
      {renderValue()}
    </div>
  );
}
