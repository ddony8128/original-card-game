import RequireParticipant from '@/components/auth/RequireParticipant'
import { Route } from 'react-router-dom'
import { renderWithProviders } from './render'
import { screen } from '@testing-library/react'
import { server } from './testServer'
import { http, HttpResponse } from 'msw'

it('참가자가 아니면 /lobby 로 이동', async () => {
  server.use(
    http.get('/api/match/:roomId', () => HttpResponse.json({ roomId: 'r1', status: 'waiting', host: { id: 'other', username: 'x' } })),
    http.get(/https?:\/\/.*\/api\/match\/.+$/, () => HttpResponse.json({ roomId: 'r1', status: 'waiting', host: { id: 'other', username: 'x' } })),
  )
  renderWithProviders(
    <RequireParticipant><div>ROOM</div></RequireParticipant>,
    {
      route: '/back-room/r1',
      routes: [
        <Route key='room' path='/back-room/:roomId' element={<RequireParticipant><div>ROOM</div></RequireParticipant>} />,
        <Route key='lobby' path='/lobby' element={<div>LOBBY</div>} />,
        <Route key='login' path='/login' element={<div>LOGIN</div>} />,
      ],
    }
  )
  expect(await screen.findByText('LOBBY')).toBeInTheDocument()
})

it('게임 페이지는 playing 상태 요구(requirePlaying)', async () => {
  server.use(
    http.get('/api/match/:roomId', () => HttpResponse.json({ roomId: 'r1', status: 'waiting', host: { id: 'u1', username: 'tester' } })),
    http.get(/https?:\/\/.*\/api\/match\/.+$/, () => HttpResponse.json({ roomId: 'r1', status: 'waiting', host: { id: 'u1', username: 'tester' } })),
  )
  renderWithProviders(
    <RequireParticipant requirePlaying><div>GAME</div></RequireParticipant>,
    {
      route: '/game/r1',
      routes: [
        <Route key='game' path='/game/:roomId' element={<RequireParticipant requirePlaying><div>GAME</div></RequireParticipant>} />,
        <Route key='lobby' path='/lobby' element={<div>LOBBY</div>} />,
        <Route key='login' path='/login' element={<div>LOGIN</div>} />,
      ],
    }
  )
  expect(await screen.findByText('LOBBY')).toBeInTheDocument()
})


