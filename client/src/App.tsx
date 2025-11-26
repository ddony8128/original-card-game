import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as Sonner } from '@/components/ui/sonner';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import DeckBuilder from './pages/DeckBuilder';
import BackRoom from './pages/BackRoom';
import Game from './pages/Game';
import NotFound from './pages/NotFound';
import Review from './pages/Review';
import RequireAuth from './components/auth/RequireAuth';
import RequireParticipant from './components/auth/RequireParticipant';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" />} />
          <Route
            path="/lobby"
            element={
              <RequireAuth>
                <Lobby />
              </RequireAuth>
            }
          />
          <Route
            path="/deck-builder"
            element={
              <RequireAuth>
                <DeckBuilder />
              </RequireAuth>
            }
          />
          <Route
            path="/review"
            element={
              <RequireAuth>
                <Review />
              </RequireAuth>
            }
          />
          <Route
            path="/back-room/:roomId"
            element={
              <RequireParticipant>
                <BackRoom />
              </RequireParticipant>
            }
          />
          <Route
            path="/game/:roomId"
            element={
              <RequireParticipant requirePlaying>
                <Game />
              </RequireParticipant>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
