import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  ask,
  askStream,
  getHistory,
  setFeedback,
} from "../controllers/askController.js";

const router = Router();

router.post("/", requireAuth, ask);

router.post("/stream", requireAuth, askStream); 

router.get("/history", requireAuth, getHistory);
router.patch("/history/:id/feedback", requireAuth, setFeedback); // ← add

export default router;
