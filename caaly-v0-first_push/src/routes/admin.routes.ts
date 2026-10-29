import { Router } from "express";
import { registerAdmin, loginAdmin, changePassword, logoutAdmin } from "../controllers/admin.controller.js";
import { authenticate, authorizeSuperAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// Only superadmin can register new admins
router.post("/register", authenticate, authorizeSuperAdmin, registerAdmin);
router.post("/login", loginAdmin);
router.post("/change-password", authenticate, changePassword);
router.post("/logout", authenticate, logoutAdmin);

export default router;
