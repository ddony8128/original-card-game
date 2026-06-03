import { useParams } from 'react-router-dom';
import { LangNavigate } from '@/i18n/LangNav';
import Game from './Game';

/** /pve/play/:stageId — URL 의 stageId 로 PvE 게임을 시작한다. */
export default function PvePlay() {
  const { stageId } = useParams<{ stageId: string }>();
  if (!stageId) return <LangNavigate to="/pve" replace />;
  return <Game pveStageId={stageId} />;
}
