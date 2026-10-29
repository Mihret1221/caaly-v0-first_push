import { Router } from "express";
import { register, login, sendOtp, verifyOtp, setNewPassword, changePassword, logout } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Registration and Login
router.post("/register", register);
router.post("/login", login);

// Forgot Password Flow
router.post("/forgot-password", sendOtp); 
router.post("/verify-otp", authenticate, verifyOtp); 
router.post("/set-new-password", setNewPassword); 
router.post("/change-password", authenticate, changePassword); 

// Logout
router.post("/logout", authenticate, logout);

export default router;
