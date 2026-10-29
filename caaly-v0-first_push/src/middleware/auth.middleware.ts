import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import type { TokenPayload } from "../utils/jwt.js";
import { AppDataSource } from "../config/data-source.js";
import { ActiveToken } from "../models/active_token.model.js";
import { MoreThan } from "typeorm";

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

const activeTokenRepo = AppDataSource.getRepository(ActiveToken);

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  // Format: "Bearer <token>"
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Invalid token format" });
  }

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }

  // Verify JTI against active tokens in database
  const activeToken = await activeTokenRepo.findOne({
    where: {
      jti: payload.jti,
      user_id: payload.id,
      expires_at: MoreThan(new Date())
    }
  });

  if (!activeToken) {
    return res.status(401).json({ error: "Token has been invalidated or expired" });
  }

  req.user = payload;
  next();
};

export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.user.role !== "admin" && req.user.role !== "subadmin" && req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};

export const authorizeSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  next();
};
