import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';

export default function Game() {
  const navigate = useNavigate();
  const { room } = useGameStore();

  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-bold mb-4">⚔️ 게임 시작</h2>
      <p>방 코드: {room?.code}</p>
      <p>여기에 5x5 보드, 마나, HP 표시 추가 예정</p>
      <button
        onClick={() => navigate('/result')}
        className="bg-red-500 text-white px-4 py-2 mt-4 rounded"
      >
        임시로 결과로 이동
      </button>
    </div>
  );
}