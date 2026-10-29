import { Router } from "express";
import { startPayment, handleChapaCallback, handleTelebirrCallback } from "../controllers/payment.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Initiate Payment (Protected)
router.post("/initiate", authenticate, startPayment);

// Webhooks (Public)
router.post("/callback/chapa", handleChapaCallback);
router.post("/callback/telebirr", handleTelebirrCallback);

export default router;
