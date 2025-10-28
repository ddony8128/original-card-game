import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { useDeckStore } from '../store/useDeckStore';
import { useState } from 'react';
import type { User } from '../types/user';
import type { Room } from '../types/room';

export default function Lobby() {
  const navigate = useNavigate();
  const { user, setUser, setRoom } = useGameStore();
  const { decks } = useDeckStore();
  const [roomCode, setRoomCode] = useState('');

  const handleLogin = () => {
    const name = prompt('닉네임을 입력하세요');
    if (!name) return;
    const now = Date.now();
    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      decks: [],
      createdAt: now,
      updatedAt: now,
    };
    setUser(newUser);
  };

  const handleCreateRoom = () => {
    if (!user) return alert('먼저 닉네임을 등록하세요.');
    if (!decks.length) return alert('덱을 먼저 만들어야 합니다.');
    const code = Math.random().toString(36).substring(2, 8);
    const now = Date.now();
    const newRoom: Room = {
      id: crypto.randomUUID(),
      code,
      name: `${user.name}의 방`,
      createdAt: now,
      updatedAt: now,
      players: [user],
    };
    setRoom(newRoom);
    alert(`방이 생성되었습니다. 코드: ${code}`);
    navigate('/game');
  };

  const handleJoinRoom = () => {
    if (!decks.length) return alert('덱을 먼저 만들어야 합니다.');
    if (!roomCode) return alert('방 코드를 입력하세요.');
    const now = Date.now();
    const joinedRoom: Room = {
      id: crypto.randomUUID(),
      code: roomCode,
      name: '참가한 방',
      createdAt: now,
      updatedAt: now,
    };
    setRoom(joinedRoom);
    alert(`방(${roomCode})에 입장했습니다.`);
    navigate('/game');
  };

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">🔥 마법사 대전 카드게임</h1>
      {!user ? (
        <button
          onClick={handleLogin}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          닉네임 등록
        </button>
      ) : (
        <>
          <p className="mb-2">안녕하세요, {user.name}님!</p>
          <button
            onClick={() => navigate('/deck-builder')}
            className="bg-green-500 text-white px-4 py-2 m-2 rounded"
          >
            덱 만들기
          </button>
          <div className="my-4">
            <button
              onClick={handleCreateRoom}
              className="bg-yellow-500 text-white px-4 py-2 m-2 rounded"
            >
              방 만들기
            </button>
            <input
              placeholder="방 코드 입력"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="border p-2"
            />
            <button
              onClick={handleJoinRoom}
              className="bg-gray-700 text-white px-4 py-2 m-2 rounded"
            >
              방 참가
            </button>
          </div>
        </>
      )}
    </div>
  );
}