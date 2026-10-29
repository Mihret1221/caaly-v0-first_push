import "reflect-metadata";
import express from "express";
import type { Application, Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cron from "node-cron";
import { AppDataSource } from "./config/data-source.js";
import { CleanupService } from "./services/cleanup.service.js";

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check route
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Cabit API Server",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

import authRoutes from "./routes/auth.routes.js";

// ...

import kycRoutes from "./routes/kyc.routes.js";

// ...

import tripRoutes from "./routes/trip.routes.js";

// ...

import adminRoutes from "./routes/admin.routes.js";

// ...

import paymentRoutes from "./routes/payment.routes.js";
import qrRoutes from "./routes/qr.routes.ts";
import userRoutes from "./routes/user.routes.js";

// ...

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/users", userRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Initialize database and start server
AppDataSource.initialize()
  .then(() => {
    console.log("✅ Database connected successfully");
    console.log(`📊 Database: ${process.env.DB_NAME}`);

    // Setup cron job for cleanup (runs every hour)
cron.schedule('0 0,12 * * *', async () => {
  await CleanupService.runCleanup();
});
    console.log("⏰ Cleanup cron job scheduled (runs  Twice a day)");
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`📍 Health check: http://localhost:${PORT}/`);
    });
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await AppDataSource.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await AppDataSource.destroy();
  process.exit(0);
});
