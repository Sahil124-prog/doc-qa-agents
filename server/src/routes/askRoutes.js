import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { ask,getHistory,askStream } from "../controllers/askController.js";

const router = Router();

router.post("/", requireAuth, ask);
router.get("/history", requireAuth, getHistory);
router.post("/stream", requireAuth, askStream); 


export default router;
