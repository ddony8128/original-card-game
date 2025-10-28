import { useNavigate } from 'react-router-dom';

export default function Result() {
  const navigate = useNavigate();
  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-bold mb-4">🎉 결과 화면</h2>
      <p>승리/패배/전적 통계 표시 예정</p>
      <button
        onClick={() => navigate('/')}
        className="bg-blue-500 text-white px-4 py-2 mt-4 rounded"
      >
        로비로 돌아가기
      </button>
    </div>
  );
}