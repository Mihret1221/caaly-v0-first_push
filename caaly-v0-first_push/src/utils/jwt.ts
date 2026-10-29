import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { User } from "../models/users.model.js";
import type { Admin } from "../models/admins.model.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const EXPIRES_IN: string = (process.env.JWT_EXPIRES_IN || "24h") as string;

// Helper to parse expiration time to milliseconds
const parseExpirationToMs = (expiresIn: string): number => {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24 hours
  
  const value = parseInt(match[1]!);
  const unit = match[2]!;
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
};

export interface TokenPayload {
  id: number;
  role: "user" | "admin" | "subadmin" | "superadmin";
  jti: string;
}

export const generateToken = (
  entity: User | Admin,
  role: "user" | "admin" | "subadmin" | "superadmin"
): { token: string; jti: string; expiresAt: Date } => {
  const jti = crypto.randomUUID();
  const expiresInMs = parseExpirationToMs(EXPIRES_IN);
  const expiresAt = new Date(Date.now() + expiresInMs);

  const payload: TokenPayload = {
    id: entity.id,
    role: role,
    jti: jti,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);

  return { token, jti, expiresAt };
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
};