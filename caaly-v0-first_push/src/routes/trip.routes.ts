import { Router } from "express";
import { startTrip, stopTrip, allActiveTrips, allTrips, getMyTrips } from "../controllers/trip.controller.js";
import { authenticate, authorizeAdmin, authorizeSuperAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// User Routes
router.post("/start", authenticate, startTrip);
router.get("/history", authenticate, getMyTrips);

// Admin Routes
router.get("/active-trips", authenticate, authorizeAdmin, allActiveTrips);
router.get("/all-trips", authenticate, authorizeAdmin, allTrips);
router.post("/stop", authenticate, authorizeAdmin, stopTrip);

export default router;
