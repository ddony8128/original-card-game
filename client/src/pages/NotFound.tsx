import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/i18n/nav';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useMeQuery } from '@/features/auth/queries';

const NotFound = () => {
  const location = useLocation();
  const navigate = useLangNavigate();
  const { t } = useTranslation();
  const { data: me } = useMeQuery();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-gray-600">{t('notFound.subtitle')}</p>
        <Button onClick={() => navigate(me ? '/lobby' : '/login')}>
          {me ? t('notFound.goToLobby') : t('notFound.goToLogin')}
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
