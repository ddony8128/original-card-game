import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { authRouter } from "./routes/auth";
import { cardsRouter } from "./routes/cards";
import { decksRouter } from "./routes/decks";
import { matchRouter } from "./routes/match";
import { logsRouter } from "./routes/logs";

export const app = express();

app.use(cors({
    origin: ["https://original-card-game.vercel.app", "http://localhost:5173"],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Base prefix as per spec
app.use("/api/auth", authRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/decks", decksRouter);
app.use("/api/match", matchRouter);
app.use("/api/game", logsRouter);

// Health under /api for consistency
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));



