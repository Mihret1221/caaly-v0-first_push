import { Router } from "express";
import { getAllUsers, getUserById, deleteUser, restoreUser } from "../controllers/user.controller.js";
import { authenticate, authorizeSuperAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication and superadmin role
router.get("/", authenticate, authorizeSuperAdmin, getAllUsers);
router.get("/:id", authenticate, authorizeSuperAdmin, getUserById);
router.delete("/:id", authenticate, authorizeSuperAdmin, deleteUser);
router.post("/restore/:id", authenticate, authorizeSuperAdmin, restoreUser);
export default router;
