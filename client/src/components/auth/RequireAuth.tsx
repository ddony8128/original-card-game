import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { LangNavigate } from '@/i18n/LangNav';
import { useMeQuery } from '@/features/auth/queries';

type RequireAuthProps = {
  children: ReactNode;
};

export default function RequireAuth({ children }: RequireAuthProps) {
  const { data, isLoading, isError } = useMeQuery();
  const location = useLocation();
  if (isLoading) return null;
  if (isError || !data) {
    return <LangNavigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
