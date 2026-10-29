import { Router } from "express";
import { generateFaydaAuthorizationUrl, faydaCallback } from "../controllers/kyc.controller.js";
import publicJwks from "../../public-jwks.json" with { type: "json" };
const router = Router();

// Initiate KYC (Public - Registration/Login start)
router.get("/init", generateFaydaAuthorizationUrl);

// Callback from Feyda (Public)
router.get("/callback", faydaCallback);

router.get('/.well-known/jwks.json', (req, res) => {
  // Always return standard JSON
  res.setHeader('Content-Type', 'application/json');
  res.json(publicJwks);
});
export default router;
