import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export function renderWithProviders(
  ui: React.ReactNode,
  {
    route = '/',
    routes = [
      <Route key="login" path="/login" element={<div>LOGIN</div>} />,
      <Route key="lobby" path="/lobby" element={<div>LOBBY</div>} />,
    ],
    seed,
  }: { route?: string; routes?: React.ReactNode[]; seed?: (qc: QueryClient) => void } = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed?.(qc);
  void ui;
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <Sonner />
        <MemoryRouter initialEntries={[route]}>
          <Routes>{routes}</Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}
