import type { Request, Response } from "express";
import { AppDataSource } from "../config/data-source.js";
import { Trip } from "../models/trips.model.js";
import { QrCode } from "../models/qr_codes.model.js";
import { Setting } from "../models/settings.model.js";
import { User } from "../models/users.model.js";
import { IsNull } from "typeorm";

const tripRepo = AppDataSource.getRepository(Trip);
const qrRepo = AppDataSource.getRepository(QrCode);
const settingRepo = AppDataSource.getRepository(Setting);
const userRepo = AppDataSource.getRepository(User);

// Start Trip (User scans Device QR)
export const startTrip = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { qr_value } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!qr_value) return res.status(400).json({ error: "QR value is required" });

    // Check if user is soft-deleted
    const user = await userRepo.findOne({ 
      where: { id: userId } 
    });
    
    if (!user) {
      return res.status(403).json({ error: "User account is not active" });
    }

    // 1. Find QR Code
    const qrCode = await qrRepo.findOne({ where: { qr_value } });
    if (!qrCode) return res.status(404).json({ error: "Invalid QR code" });

    const deviceId = qrCode.device_id;

    // 2. Check if device is already in use
    const activeTrip = await tripRepo.findOne({
      where: { device_id: deviceId, end_time: IsNull() }, 
    });

    if (activeTrip) {
      return res.status(400).json({ error: "Device is already in use" });
    }

    // 3. Create Trip
    const trip = tripRepo.create({
      user_id: userId,
      device_id: deviceId,
      start_time: new Date(),
    });

    await tripRepo.save(trip);

    return res.status(201).json({
      message: "Trip started successfully",
      trip_id: trip.id,
      device_id: trip.device_id,
      start_time: trip.start_time,
    });

  } catch (error) {
    console.error("Start Trip Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Stop Trip (Admin confirms end)
export const stopTrip = async (req: Request, res: Response) => {
  try {
    const { qr_value } = req.body;

    if (!qr_value) return res.status(400).json({ error: "QR value is required" });

    const qrCode = await qrRepo.findOne({ where: { qr_value: qr_value as string } });
    if (!qrCode) return res.status(404).json({ error: "Invalid QR code" });

    const trip = await tripRepo.findOne({
      where: { device_id: qrCode.device_id, end_time: IsNull() },
      relations: ["user"],
    });
    if (!trip) return res.status(404).json({ error: "No active trip found for this device" });

    // Calculate Fare
    const endTime = new Date();
    const durationMs = endTime.getTime() - trip.start_time.getTime();
    const totalMinutes = Math.ceil(durationMs / 60000);

    const setting = await settingRepo.findOne({ where: {} });
    const fareRate = setting?.fare_rate || 0.50;
    const totalFare = totalMinutes * fareRate;

    // Update Trip
    trip.end_time = endTime;
    trip.total_minutes = totalMinutes;
    trip.fare_rate = fareRate;
    trip.total_fare = totalFare;

    await tripRepo.save(trip);

    // Notify User (Mock)
    console.log(`🔔 Notification to User ${trip.user_id}: Trip ended. Fare: ${totalFare} ETB`);

    return res.json({
      message: "Trip ended successfully",
      trip_id: trip.id,
      total_minutes: totalMinutes,
      total_fare: totalFare,
    });

  } catch (error) {
    console.error("Stop Trip Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get User Trip History (Paginated)
export const getMyTrips = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get total count - exclude trips from deleted users
    const total = await tripRepo
      .createQueryBuilder("trip")
      .innerJoin("trip.user", "user")
      .where("trip.user_id = :userId", { userId })
      .andWhere("user.deleted_at IS NULL")
      .getCount();

    // Get paginated trips - exclude trips from deleted users
    const trips = await tripRepo
      .createQueryBuilder("trip")
      .innerJoin("trip.user", "user")
      .where("trip.user_id = :userId", { userId })
      .andWhere("user.deleted_at IS NULL")
      .orderBy("trip.start_time", "DESC")
      .skip(skip)
      .take(limit)
      .getMany();

    return res.json({
      trips,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Get My Trips Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};


// Get All Active Trips (Paginated)
export const allActiveTrips = async (req: Request, res: Response) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get total count - exclude trips from deleted users
    const total = await tripRepo
      .createQueryBuilder("trip")
      .innerJoin("trip.user", "user")
      .where("trip.end_time IS NULL")
      .andWhere("user.deleted_at IS NULL")
      .getCount();

    // Get paginated trips - exclude trips from deleted users
    const trips = await tripRepo
      .createQueryBuilder("trip")
      .innerJoin("trip.user", "user")
      .where("trip.end_time IS NULL")
      .andWhere("user.deleted_at IS NULL")
      .orderBy("trip.start_time", "DESC")
      .skip(skip)
      .take(limit)
      .getMany();

    return res.json({
      trips,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Get All Active Trips Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get All Trips (Paginated)
export const allTrips = async (req: Request, res: Response) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Get total count - exclude trips from deleted users
    const total = await tripRepo
      .createQueryBuilder("trip")
      .innerJoin("trip.user", "user")
      .where("user.deleted_at IS NULL")
      .getCount();

    // Get paginated trips - exclude trips from deleted users
    const trips = await tripRepo
      .createQueryBuilder("trip")
      .innerJoin("trip.user", "user")
      .where("user.deleted_at IS NULL")
      .orderBy("trip.start_time", "DESC")
      .skip(skip)
      .take(limit)
      .getMany();

    return res.json({
      trips,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Get All Trips Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};