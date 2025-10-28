import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Lobby from "./pages/Lobby";
import DeckList from "./pages/DeckList";
import DeckBuilder from "./pages/DeckBuilder";
import Game from "./pages/Game";
import Result from "./pages/Result";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/deck-list" element={<DeckList />} />
        <Route path="/deck-builder" element={<DeckBuilder />} />
        <Route path="/game" element={<Game />} />
        <Route path="/result" element={<Result />} />
      </Routes>
    </BrowserRouter>
  );
}
