import { Router } from "express";
import { generateQr, GetQrListPaginated } from "../controllers/qr.controller.js";
import { authenticate, authorizeAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Only admins should be able to generate QR codes
router.post("/generate", authenticate, authorizeAdmin, generateQr);
router.get("/list", GetQrListPaginated);

export default router;
