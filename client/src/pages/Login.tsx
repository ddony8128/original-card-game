import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/i18n/nav';
import { LangToggle } from '@/i18n/LangToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, X } from 'lucide-react';
import { useLoginMutation, useRegisterMutation, useMeQuery } from '@/features/auth/queries';
import { toast } from 'sonner';
import { track, identify } from '@/shared/analytics';

export default function Login() {
  const navigate = useLangNavigate();
  const { t } = useTranslation();

  // 로그인 폼 상태
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // 회원가입 모달 상태
  const [openRegister, setOpenRegister] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  // 수동 me 요청 용도
  const { refetch: refetchMe } = useMeQuery({ enabled: false });

  const getErrorMessage = (err: unknown): string | undefined => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err && 'message' in err) {
      const m = (err as { message?: unknown }).message;
      return typeof m === 'string' ? m : undefined;
    }
    return undefined;
  };

  const goToLobbyAfterAuth = async () => {
    try {
      await refetchMe();
      navigate('/lobby', { replace: true });
    } catch (e: unknown) {
      setLoginError(getErrorMessage(e) ?? t('login.errAuthCheck'));
    }
  };

  const handleLogin = async () => {
    setLoginError(null);
    if (!username.trim() || !password.trim()) {
      return setLoginError(t('login.errMissingCredentials'));
    }
    try {
      const res = await loginMutation.mutateAsync({
        username: username.trim(),
        password: password.trim(),
      });
      track('login', { method: 'password' });
      if (res?.id) identify(res.id);
      await refetchMe();
      await goToLobbyAfterAuth();
    } catch (e: unknown) {
      setLoginError(getErrorMessage(e) ?? t('login.errLoginFailed'));
    }
  };

  const handleRegister = async () => {
    if (!regUsername.trim() || !regPassword.trim()) {
      return toast.error(t('login.errMissingCredentials'));
    }
    try {
      await registerMutation.mutateAsync({
        username: regUsername.trim(),
        password: regPassword.trim(),
      });
      track('sign_up', { method: 'password' });
      toast.success(t('login.registerSuccess'));
      const res = await loginMutation.mutateAsync({
        username: regUsername.trim(),
        password: regPassword.trim(),
      });
      track('login', { method: 'password' });
      if (res?.id) identify(res.id);
      setOpenRegister(false);
      setUsername(regUsername.trim());
      setPassword(regPassword.trim());
      await refetchMe();
      await goToLobbyAfterAuth();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? t('login.errRegisterFailed'));
    }
  };

  return (
    <div className="from-background via-background to-accent/10 flex min-h-screen items-center justify-center bg-linear-to-br p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-end">
          <LangToggle />
        </div>
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <Sparkles className="text-primary h-20 w-20 animate-pulse" />
          </div>
          <h1 className="from-primary to-accent bg-linear-to-r bg-clip-text text-4xl font-bold text-transparent">
            {t('login.title')}
          </h1>
          <p className="text-muted-foreground">{t('login.subtitle')}</p>
        </div>

        <div className="bg-card border-border space-y-4 rounded-lg border p-6 shadow-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-foreground text-sm font-medium">{t('common.usernameLabel')}</label>
              <Input
                type="text"
                name="username"
                autoComplete="username"
                placeholder={t('common.usernamePlaceholder')}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setLoginError(null);
                }}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-foreground text-sm font-medium">{t('common.passwordLabel')}</label>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder={t('common.passwordPlaceholder')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError(null);
                }}
                className="w-full"
              />
            </div>

            {loginError && (
              <p role="alert" className="text-destructive text-sm font-medium">
                {loginError}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" className="w-full" size="lg" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? t('login.loggingIn') : t('login.loginButton')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => setOpenRegister(true)}
              >
                {t('login.registerButton')}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {openRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border-border relative w-full max-w-md rounded-lg border p-6 shadow-lg">
            <button
              aria-label="close"
              className="text-muted-foreground hover:text-foreground absolute top-3 right-3"
              onClick={() => setOpenRegister(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-4 text-xl font-bold">{t('login.registerTitle')}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRegister();
              }}
              className="space-y-3"
            >
              <div className="space-y-2">
                <label className="text-foreground text-sm font-medium">{t('common.usernameLabel')}</label>
                <Input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder={t('common.usernamePlaceholder')}
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-foreground text-sm font-medium">{t('common.passwordLabel')}</label>
                <Input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder={t('common.passwordPlaceholder')}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="mt-2 w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? t('login.registering') : t('login.registerSubmit')}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
