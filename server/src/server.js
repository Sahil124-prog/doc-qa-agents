import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";


const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});


app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);


app.use((err, req, res, next) => {
  const status = err.status || (err.name === "MulterError" ? 400 : 500);
  if (status === 500) console.error(err);
  res
    .status(status)
    .json({ message: status === 500 ? "Something went wrong" : err.message });
});

const PORT = process.env.PORT || 5000;

await connectDB();
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
