import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { AppDataSource } from "../config/data-source.js";
import { User } from "../models/users.model.js";
import { OtpLog } from "../models/otp.model.js";
import { LoginAttempt } from "../models/login_attempts.model.js";
import { sendSMS } from "../services/geezsms.service.js";
import { generateToken } from "../utils/jwt.js";
import { validateEmail, validatePassword, normalizePhoneNumber } from "../helpers/validator.js";
import { MoreThan, LessThan } from "typeorm";
import { ActiveToken } from "../models/active_token.model.js";

const otpRepo = AppDataSource.getRepository(OtpLog);
const userRepo = AppDataSource.getRepository(User);
const loginAttemptRepo = AppDataSource.getRepository(LoginAttempt);
const activeTokenRepo = AppDataSource.getRepository(ActiveToken);

const expiration = new Date();
expiration.setMinutes(expiration.getMinutes() + 5);
// Helper to generate 6-digit OTP
export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();


// REGISTER - Create new user with email and password
export const register = async (req: Request, res: Response) => {
  try {
    const { phone_number, name, national_id, email, password, gender, date_of_birth, kyc_photo, address } = req.body;

    // Validate required fields
    if (!phone_number || !name || !national_id || !email || !password) {
      return res.status(400).json({ error: "Missing required fields: phone_number, name, national_id, email, password" });
    }

    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (!normalizedPhone) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Check if user already exists
    const existingUser = await userRepo.findOne({
      where: [
        { phone_number: normalizedPhone },
        { national_id },
        { email }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this phone number, national ID, or email" });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = userRepo.create({
      phone_number: normalizedPhone,
      name,
      national_id,
      email,
      password_hash,
      password_history: [],
      gender: gender || null,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
      kyc_photo: kyc_photo || "",
      kyc_status: true,
      address: address || null
    });

    await userRepo.save(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please login with your credentials.",
      user: {
        id: user.id,
        phone: user.phone_number,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// LOGIN - Authenticate with phone and password
export const login = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    const normalizedPhone = normalizePhoneNumber(phone);

    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    if (!normalizedPhone) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }
 
    // Find user
    const user = await userRepo.findOne({ 
        where: { phone_number: normalizedPhone }, 
        withDeleted: true 
    });
    if (!user) {
      return res.status(404).json({ error: "User not found or not active" });
    }
    if (user.deleted_at !== null) {
        return res.status(403).json({ error: "Account is inactive. Please contact support." });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: "Please complete registration by setting a password" });
    }

    // Check if user is locked
    let loginAttempt = await loginAttemptRepo.findOne({ where: { user_id: user.id } });

    if (loginAttempt && loginAttempt.locked_until) {
      const now = new Date();
      if (loginAttempt.locked_until > now) {
        const waitMinutes = Math.ceil((loginAttempt.locked_until.getTime() - now.getTime()) / 60000);
        return res.status(429).json({
          error: `Account locked. Please try again in ${waitMinutes} minute(s)`
        });
      } else {
        // Lock expired, clear it
        loginAttempt.locked_until = null;
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Handle failed attempt
      if (!loginAttempt) {
        loginAttempt = loginAttemptRepo.create({
          user_id: user.id,
          failed_attempts: 1,
          last_attempt_at: new Date()
        });
      } else {
        loginAttempt.failed_attempts += 1;
        loginAttempt.last_attempt_at = new Date();
      }

      // Apply rate limiting
      let errorMessage = "Incorrect password, try again later";
      
      if (loginAttempt.failed_attempts >= 3) {
        let lockMinutes = 1;
        if (loginAttempt.failed_attempts === 4) {
          lockMinutes = 2;
        } else if (loginAttempt.failed_attempts >= 5) {
          lockMinutes = 4;
        }

        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + lockMinutes);
        loginAttempt.locked_until = lockUntil;
        
        errorMessage = `Too many failed attempts. Account locked for ${lockMinutes} minute(s)`;
      }

      await loginAttemptRepo.save(loginAttempt);

      return res.status(401).json({ error: errorMessage });
    }

    // Successful login - reset attempts
    if (loginAttempt) {
      loginAttempt.failed_attempts = 0;
      loginAttempt.locked_until = null;
      loginAttempt.last_attempt_at = new Date();
      await loginAttemptRepo.save(loginAttempt);
    }

    // Clean expired tokens for this user
    await activeTokenRepo.delete({
      user_id: user.id,
      user_type: "user",
      expires_at: LessThan(new Date())
    });

    // Invalidate all existing tokens for this user
    await activeTokenRepo.delete({
      user_id: user.id,
      user_type: "user"
    });

    // Generate new token with JTI
    const { token, jti, expiresAt } = generateToken(user, "user");

    // Save new active token
    await activeTokenRepo.save({
      user_id: user.id,
      user_type: "user",
      jti: jti,
      issued_at: new Date(),
      expires_at: expiresAt
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        phone: user.phone_number,
        email: user.email,
        name: user.name,
        kyc_status: user.kyc_status
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// SEND OTP - For forgot password only
export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    // Check if user exists
    const user = await userRepo.findOne({ where: { phone_number: normalizedPhone } });

    if (!user) {
      return res.status(404).json({ error: "User not found with this phone number" });
    }

    const otpCode = generateOTP();

    // Save OTP to DB
    const otpLog = otpRepo.create({
      user_id: user.id,
      otp_code: otpCode,
      is_used: false,
      expires_at: expiration,
    });
    await otpRepo.save(otpLog);

    // Send SMS
    const message = `Your Cally password reset code is: ${otpCode}`;
    const smsSent = await sendSMS(normalizedPhone, message);

    // Generate temporary token for the OTP verification step
    const token = generateToken(user, "user");

    if (smsSent) {
      // In dev mode, return OTP for testing
      if (process.env.NODE_ENV === "development") {
        return res.status(200).json({ 
          message: "OTP sent (dev)", 
          otp: otpCode,
          token 
        });
      }
      return res.status(200).json({ 
        message: "OTP sent successfully",
        token
      });
    } else {
      return res.status(500).json({ error: "Failed to send SMS" });
    }

  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// VERIFY OTP - Existing function that works for both old and new flows
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { phone, otp_code } = req.body;

    if (!phone || !otp_code) {
      return res.status(400).json({ error: "Phone and OTP code are required" });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    const user = await userRepo.findOne({ where: { phone_number: normalizedPhone } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find valid OTP
    const otpRecord = await otpRepo.findOne({
      where: {
        user_id: user.id,
        otp_code: otp_code,
        is_used: false,
        expires_at: MoreThan(new Date()),
      },
      order: { created_at: "DESC" },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Mark OTP as used
    otpRecord.is_used = true;
    await otpRepo.save(otpRecord);

    // Generate Token
    const token = generateToken(user, "user");

    return res.status(200).json({
      message: "OTP verified successfully",
      token,
      user: {
        id: user.id,
        phone: user.phone_number,
        name: user.name,
        email: user.email,
        kyc_status: user.kyc_status,
      },
    });

  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// SET NEW PASSWORD - Step 3 of forgot password flow
export const setNewPassword = async (req: Request, res: Response) => {
  try {
    const { phone, new_password } = req.body;

    if (!phone || !new_password) {
      return res.status(400).json({ error: "Phone and new password are required" });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    // Find user
    const user = await userRepo.findOne({ where: { phone_number: normalizedPhone } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Check if new password is same as current password
    if (user.password_hash) {
      const isSameAsCurrent = await bcrypt.compare(new_password, user.password_hash);
      if (isSameAsCurrent) {
        return res.status(400).json({ error: "Cannot reuse your current password" });
      }
    }

    // Check against password history
    if (user.password_history && user.password_history.length > 0) {
      for (const oldHash of user.password_history) {
        const matchesOld = await bcrypt.compare(new_password, oldHash);
        if (matchesOld) {
          return res.status(400).json({ error: "Cannot reuse previous passwords" });
        }
      }
    }

    // Hash new password
    const new_password_hash = await bcrypt.hash(new_password, 10);

    // Update password history
    const updatedHistory = user.password_history || [];
    if (user.password_hash) {
      updatedHistory.push(user.password_hash);
    }

    // Keep only last 4 passwords
    if (updatedHistory.length > 4) {
      updatedHistory.shift(); // Remove oldest
    }

    // Update user
    user.password_hash = new_password_hash;
    user.password_history = updatedHistory;
    await userRepo.save(user);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. Please login with your new password."
    });

  } catch (error) {
    console.error("Set New Password Error:", error);
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
    const user = await userRepo.findOne({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    //check if old password is correct
    if (user.password_hash) {
      const isOldPasswordValid = await bcrypt.compare(old_password, user.password_hash);
      if (!isOldPasswordValid) {
        return res.status(400).json({ error: "Incorrect old password" });
      }
    }

    // Check if new password is same as current password
    if (user.password_hash) {
      const isSameAsCurrent = await bcrypt.compare(new_password, user.password_hash);
      if (isSameAsCurrent) {
        return res.status(400).json({ error: "Cannot reuse your current password" });
      }
    }

    // Check against password history
    if (user.password_history && user.password_history.length > 0) {
      for (const oldHash of user.password_history) {
        const matchesOld = await bcrypt.compare(new_password, oldHash);
        if (matchesOld) {
          return res.status(400).json({ error: "Cannot reuse previous passwords" });
        }
      }
    }

    // Hash new password
    const new_password_hash = await bcrypt.hash(new_password, 10);

    // Update password history
    const updatedHistory = user.password_history || [];
    if (user.password_hash) {
      updatedHistory.push(user.password_hash);
    }

    // Keep only last 4 passwords
    if (updatedHistory.length > 4) {
      updatedHistory.shift(); // Remove oldest
    }

    // Update user
    user.password_hash = new_password_hash;
    user.password_history = updatedHistory;
    await userRepo.save(user);

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
export const logout = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
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