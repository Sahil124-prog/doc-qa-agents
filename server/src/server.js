import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 5000;

await connectDB();
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
