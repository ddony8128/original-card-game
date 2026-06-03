import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLang } from './nav';

/**
 * 현재 경로를 다른 언어 접두사로 토글하는 버튼(KO/EN).
 * 현재 location 에서 `/en` 접두사를 더하거나 떼어 같은 페이지로 이동하고,
 * localStorage 'lang' 도 갱신한다(LangLayout 이 마운트 시 다시 보장).
 */
export function LangToggle() {
  const lang = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  const toggleTo = (): string => {
    const { pathname, search, hash } = location;
    let nextPath: string;
    if (lang === 'en') {
      // /en 접두사 제거 → 한국어
      const stripped = pathname.replace(/^\/en(?=\/|$)/, '');
      nextPath = stripped === '' ? '/' : stripped;
    } else {
      // /en 접두사 추가 → 영어
      nextPath = pathname === '/' ? '/en' : `/en${pathname}`;
    }
    return `${nextPath}${search}${hash}`;
  };

  const handleToggle = () => {
    const nextLang = lang === 'en' ? 'ko' : 'en';
    try {
      localStorage.setItem('lang', nextLang);
    } catch {
      // 무시
    }
    navigate(toggleTo());
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      aria-label="Toggle language"
      className="font-mono text-xs"
    >
      {lang === 'en' ? 'KO' : 'EN'}
    </Button>
  );
}
