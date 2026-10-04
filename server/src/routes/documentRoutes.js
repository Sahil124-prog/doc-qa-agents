import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { upload } from "../middleware/upload.js";

import {
  uploadDocument,
  listDocuments,
  deleteDocument,
} from "../controllers/documentController.js";

const router = Router();

router.post("/", requireAuth, upload.single("file"), uploadDocument);
router.get("/", requireAuth, listDocuments);

router.delete("/:id", requireAuth, deleteDocument);


export default router;
