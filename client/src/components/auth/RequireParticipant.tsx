import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useMeQuery } from '@/features/auth/queries';
import { useMatchStateQuery } from '@/features/match/queries';

type Props = {
  children: ReactNode;
  requirePlaying?: boolean;
};

export default function RequireParticipant({ children, requirePlaying }: Props) {
  const location = useLocation();
  const { roomId } = useParams<{ roomId: string }>();
  const { data: me, isLoading: meLoading, isError: meError } = useMeQuery();
  const {
    data: state,
    isLoading: stLoading,
    isError: stError,
  } = useMatchStateQuery(roomId ?? null, !!roomId);

  if (meLoading || stLoading) return null;

  // 인증 실패 → 로그인으로
  if (meError || !me) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  // 방 상태 없음/에러 또는 참가자 아님 → 로비로
  const isParticipant = !!state && (state.host?.id === me.id || state.guest?.id === me.id);
  if (stError || !isParticipant) {
    return <Navigate to="/lobby" replace />;
  }
  // 게임 페이지 등에서 진행 상태 요구
  if (requirePlaying && state.status !== 'playing') {
    return <Navigate to="/lobby" replace />;
  }
  return <>{children}</>;
}
