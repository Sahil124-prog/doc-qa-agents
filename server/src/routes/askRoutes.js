import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { ask } from "../controllers/askController.js";

const router = Router();

router.post("/", requireAuth, ask);

export default router;
