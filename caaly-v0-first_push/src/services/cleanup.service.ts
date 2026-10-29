import { AppDataSource } from "../config/data-source.js";
import { ActiveToken } from "../models/active_token.model.js";
import { OtpLog } from "../models/otp.model.js";
import { LessThan } from "typeorm";

const activeTokenRepo = AppDataSource.getRepository(ActiveToken);
const otpRepo = AppDataSource.getRepository(OtpLog);

export class CleanupService {
  /**
   * Clean expired active tokens from database
   */
  static async cleanExpiredTokens(): Promise<number> {
    try {
      const result = await activeTokenRepo.delete({
        expires_at: LessThan(new Date())
      });
      
      const count = result.affected || 0;
      if (count > 0) {
        console.log(`Cleaned ${count} expired token(s)`);
      }
      return count;
    } catch (error) {
      console.error("Error cleaning expired tokens:", error);
      return 0;
    }
  }

  /**
   * Clean expired OTPs from database
   */
  static async cleanExpiredOTPs(): Promise<number> {
    try {
      const result = await otpRepo.delete({
        expires_at: LessThan(new Date())
      });
      
      const count = result.affected || 0;
      if (count > 0) {
        console.log(`Cleaned ${count} expired OTP(s)`);
      }
      return count;
    } catch (error) {
      console.error("Error cleaning expired OTPs:", error);
      return 0;
    }
  }

  /**
   * Run all cleanup tasks
   */
  static async runCleanup(): Promise<void> {
    console.log("Running scheduled cleanup...");
    const [tokenCount, otpCount] = await Promise.all([
      this.cleanExpiredTokens(),
      this.cleanExpiredOTPs()
    ]);
    console.log(`Cleanup complete: ${tokenCount} tokens, ${otpCount} OTPs removed`);
  }
}
