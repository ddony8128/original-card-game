import express from "express";
import cors from "cors";
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());


// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
