import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import DocumentModel from "./models/Document.js";
import askRoutes from "./routes/askRoutes.js";



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
app.use("/api/ask", askRoutes);

app.use((err, req, res, next) => {
  // AI provider quota / rate limit
  if (err.status === 429) {
    console.error("AI rate limit hit:", err.message);
    return res
      .status(503)
      .json({
        message:
          "The AI service is busy right now. Please try again in a minute.",
      });
  }

  // Errors we chose to show to users: our own (expose = true) and multer's
  const isUserError = err.expose === true || err.name === "MulterError";
  const status = isUserError ? err.status || 400 : 500;

  if (status === 500) console.error(err);

  res
    .status(status)
    .json({ message: status === 500 ? "Something went wrong" : err.message });
});



const PORT = process.env.PORT || 5000;

await connectDB();

const { modifiedCount } = await DocumentModel.updateMany(
  { status: "processing" },
  {
    status: "failed",
    errorMessage:
      "Processing was interrupted by a server restart. Please upload again.",
  },
);
if (modifiedCount > 0)
  console.log(`Marked ${modifiedCount} interrupted document(s) as failed`);


app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
