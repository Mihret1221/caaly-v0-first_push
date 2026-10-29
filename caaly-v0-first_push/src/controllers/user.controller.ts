import type { Request, Response } from "express";
import { AppDataSource } from "../config/data-source.js";
import { User } from "../models/users.model.js";

import { IsNull  , Not} from "typeorm";

const userRepo = AppDataSource.getRepository(User);

export const getAllUsers = async (req: Request, res: Response) => {
  try {

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const baseQueryBuilder = userRepo.createQueryBuilder("user")
      .where("user.deleted_at IS NULL");

    const [total, users] = await Promise.all([
      baseQueryBuilder.clone().getCount(),
      baseQueryBuilder.clone()
        .select([
          "user.id",
          "user.phone_number",
          "user.name",
          "user.email",
          "user.national_id",
          "user.gender",
          "user.date_of_birth",
          "user.kyc_status",
          "user.address",
          "user.created_at",
        ])
        .orderBy("user.created_at", "DESC")
        .skip(skip)
        .take(limit)
        .getMany(),
    ]);

    return res.json({
      users: users,     
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("Get All Users Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id || "");

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await userRepo.findOne({ 
      where: { id: userId } 
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const sanitizedUser = {
      id: user.id,
      phone_number: user.phone_number,
      name: user.name,
      email: user.email,
      national_id: user.national_id,
      gender: user.gender,
      date_of_birth: user.date_of_birth,
      kyc_status: user.kyc_status,
      kyc_photo: user.kyc_photo,
      address: user.address,
      created_at: user.created_at,
    };

    return res.json(sanitizedUser);

  } catch (error) {
    console.error("Get User by ID Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id || "");

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await userRepo.findOne({ 
      where: { id: userId } 
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await userRepo.softRemove(user);

    return res.json({
      success: true,
      message: "User deleted successfully",
      deletedUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
      },
    });

  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Restore User (from soft delete)
 */
export const restoreUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id || "");

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = await userRepo.findOne({ 
      where: { 
        id: userId,
        // deleted_at:  Not(IsNull())
      },
      withDeleted: true, 
    });

    if (!user) {
      const activeUser = await userRepo.findOne({ where: { id: userId } });
      if (activeUser) {
           return res.status(400).json({ error: "User is already active" });
      }
      return res.status(404).json({ error: "User not found or ID is invalid" });
    }
  
    await userRepo.restore(userId); 

    const restoredUser = await userRepo.findOne({ where: { id: userId } });
    
    if (!restoredUser) {
        return res.status(500).json({ error: "Failed to fetch restored user data." });
    }

    return res.json({
      success: true,
      message: "User restored successfully",
      restoredUser: {
        id: restoredUser.id,
        name: restoredUser.name,
        email: restoredUser.email,
        phone_number: restoredUser.phone_number,
      },
    });

  } catch (error) {
    console.error("Restore User Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};