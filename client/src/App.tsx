import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as Sonner } from '@/components/ui/sonner';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import DeckBuilder from './pages/DeckBuilder';
import BackRoom from './pages/BackRoom';
import Game from './pages/Game';
import PveStageSelect from './pages/PveStageSelect';
import PvePlay from './pages/PvePlay';
import { TutorialOverlay } from './features/game/components/TutorialOverlay';
import { TutorialOutro } from './features/game/components/TutorialOutro';
import NotFound from './pages/NotFound';
import Review from './pages/Review';
import RequireAuth from './components/auth/RequireAuth';
import RequireParticipant from './components/auth/RequireParticipant';
import { shouldRetryQuery } from '@/shared/api/http';
import { LangLayout } from './i18n/LangLayout';
import { LangNavigate } from './i18n/LangNav';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
  },
});

/**
 * 언어 접두사 아래에서 공유되는 실제 라우트 정의.
 * 모든 path 는 상대 경로(선행 슬래시 제거)이며, `/*` 또는 `/en/*` 하위에서 매칭된다.
 */
const AppRoutes = () => (
  <Routes>
    <Route path="login" element={<Login />} />
    <Route index element={<LangNavigate to="/login" />} />
    <Route
      path="lobby"
      element={
        <RequireAuth>
          <Lobby />
        </RequireAuth>
      }
    />
    <Route
      path="deck-builder"
      element={
        <RequireAuth>
          <DeckBuilder />
        </RequireAuth>
      }
    />
    <Route
      path="review"
      element={
        <RequireAuth>
          <Review />
        </RequireAuth>
      }
    />
    <Route
      path="back-room/:roomId"
      element={
        <RequireParticipant>
          <BackRoom />
        </RequireParticipant>
      }
    />
    <Route
      path="tutorial"
      element={
        <RequireAuth>
          <Game solo />
          <TutorialOverlay />
          <TutorialOutro />
        </RequireAuth>
      }
    />
    <Route
      path="pve"
      element={
        <RequireAuth>
          <PveStageSelect />
        </RequireAuth>
      }
    />
    <Route
      path="pve/play/:stageId"
      element={
        <RequireAuth>
          <PvePlay />
        </RequireAuth>
      }
    />
    <Route
      path="game/:roomId"
      element={
        <RequireParticipant requirePlaying>
          <Game />
        </RequireParticipant>
      }
    />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/en/*"
            element={
              <LangLayout lang="en">
                <AppRoutes />
              </LangLayout>
            }
          />
          <Route
            path="/*"
            element={
              <LangLayout lang="ko">
                <AppRoutes />
              </LangLayout>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
