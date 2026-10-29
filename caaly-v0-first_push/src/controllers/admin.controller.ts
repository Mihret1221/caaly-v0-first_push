import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { AppDataSource } from "../config/data-source.js";
import { Admin } from "../models/admins.model.js";
import { generateToken } from "../utils/jwt.js";
import { randomString } from "./kyc.controller.ts";
import { validatePassword } from "../helpers/validator.js";
import { ActiveToken } from "../models/active_token.model.js";
import { LessThan } from "typeorm";

const adminRepo = AppDataSource.getRepository(Admin);
const activeTokenRepo = AppDataSource.getRepository(ActiveToken);

export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body;

    const password = randomString(10);

    // Only superadmin can register new admins
    if (!req.user || req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Only superadmin can create new admins" });
    }

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    // Validate role
    const validRoles = ["admin", "subadmin", "superadmin"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be admin, subadmin, or superadmin" });
    }

    const existingAdmin = await adminRepo.findOne({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ error: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = adminRepo.create({
      name,
      email,
      password_hash: hashedPassword,
      role: role || "admin",
    });

    await adminRepo.save(admin);

    return res.status(201).json({
      message: "Admin registered successfully",
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        password,
        role: admin.role,
      },
    });

  } catch (error) {
    console.error("Register Admin Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const admin = await adminRepo.findOne({ where: { email } });
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Clean expired tokens for this admin
    await activeTokenRepo.delete({
      user_id: admin.id,
      user_type: "admin",
      expires_at: LessThan(new Date())
    });

    // Invalidate all existing tokens for this admin
    await activeTokenRepo.delete({
      user_id: admin.id,
      user_type: "admin"
    });

    // Generate new token with JTI
    const { token, jti, expiresAt } = generateToken(admin, admin.role);

    // Save new active token
    await activeTokenRepo.save({
      user_id: admin.id,
      user_type: "admin",
      jti: jti,
      issued_at: new Date(),
      expires_at: expiresAt
    });

    return res.json({
      message: "Login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });

  } catch (error) {
    console.error("Login Admin Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

//change password by entering old password and must be logged in
export const changePassword = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({ error: "Old and new password are required" });
    }

    // Find user
    const admin = await adminRepo.findOne({ where: { id: req.user.id } });

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Check if old password is correct
    if (admin.password_hash) {
      const isOldPasswordValid = await bcrypt.compare(old_password, admin.password_hash);
      if (!isOldPasswordValid) {
        return res.status(400).json({ error: "Incorrect old password" });
      }
    }

    // Check if new password is same as current password
    if (admin.password_hash) {
      const isSameAsCurrent = await bcrypt.compare(new_password, admin.password_hash);
      if (isSameAsCurrent) {
        return res.status(400).json({ error: "Cannot reuse your current password" });
      }
    }

    // Check against password history
    if (admin.password_history && admin.password_history.length > 0) {
      for (const oldHash of admin.password_history) {
        const matchesOld = await bcrypt.compare(new_password, oldHash);
        if (matchesOld) {
          return res.status(400).json({ error: "Cannot reuse previous passwords" });
        }
      }
    }

    // Hash new password
    const new_password_hash = await bcrypt.hash(new_password, 10);

    // Update password history
    const updatedHistory = admin.password_history || [];
    if (admin.password_hash) {
      updatedHistory.push(admin.password_hash);
    }

    // Keep only last 4 passwords
    if (updatedHistory.length > 4) {
      updatedHistory.shift(); // Remove oldest
    }

    // Update user
    admin.password_hash = new_password_hash;
    admin.password_history = updatedHistory;
    await adminRepo.save(admin);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. Please login with your new password."
    });

  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// LOGOUT - Invalidate current token
export const logoutAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Admin not authenticated" });
    }

    // Delete active token
    await activeTokenRepo.delete({ jti: req.user.jti });

    return res.json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

