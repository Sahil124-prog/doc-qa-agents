import { Router } from "express";
import { signup,login,getMe } from "../controllers/authController.js";

import { requireAuth } from "../middleware/requireAuth.js";


const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", requireAuth, getMe);


export default router;
