import { Link, Navigate, type LinkProps, type NavigateProps } from 'react-router-dom';
import { useLang, applyLangToTo } from './nav';

/** 언어 접두사를 적용하는 <Link> 래퍼. */
export function LangLink({ to, ...rest }: LinkProps) {
  const lang = useLang();
  return <Link to={applyLangToTo(to, lang)} {...rest} />;
}

/** 언어 접두사를 적용하는 <Navigate> 래퍼. */
export function LangNavigate({ to, ...rest }: NavigateProps) {
  const lang = useLang();
  return <Navigate to={applyLangToTo(to, lang)} {...rest} />;
}
