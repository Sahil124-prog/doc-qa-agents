import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { upload } from "../middleware/upload.js";
import rateLimit from "express-rate-limit";

import {
  uploadDocument,
  listDocuments,
  deleteDocument,
} from "../controllers/documentController.js";

const router = Router();
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  message: { message: "Upload limit reached. Try again later." },
});


router.post(
  "/",
  requireAuth,
  uploadLimiter,
  upload.single("file"),
  uploadDocument,
);
router.get("/", requireAuth, listDocuments);

router.delete("/:id", requireAuth, deleteDocument);


export default router;
