import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { ask,getHistory } from "../controllers/askController.js";

const router = Router();

router.post("/", requireAuth, ask);
router.get("/history", requireAuth, getHistory);


export default router;
