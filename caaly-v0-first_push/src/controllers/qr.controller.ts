import type { Request, Response } from "express";
import { AppDataSource } from "../config/data-source.js";
import { QrCode } from "../models/qr_codes.model.js";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const qrRepo = AppDataSource.getRepository(QrCode);

export const generateQr = async (req: Request, res: Response) => {
  try {
    const { device_id, qr_value } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: "Device ID is required" });
    }

    // Check if device already has a QR code
    const existingQr = await qrRepo.findOne({ where: { device_id } });
    if (existingQr) {
      return res.status(400).json({ error: "Device already has a QR code registered" });
    }

    // Generate unique QR value if not provided
    const finalQrValue = qr_value || uuidv4();

    // Ensure qr_value is unique
    const existingValue = await qrRepo.findOne({ where: { qr_value: finalQrValue } });
    if (existingValue) {
      return res.status(400).json({ error: "QR value already exists" });
    }

    // Create QR Code entity
    const newQr = qrRepo.create({
      device_id,
      qr_value: finalQrValue,
    });

    await qrRepo.save(newQr);

    // Generate QR Code Image (Data URL)
    const qrImage = await QRCode.toDataURL(finalQrValue);
    saveQrImage(qrImage, finalQrValue);
    return res.status(201).json({
      message: "QR Code generated successfully",
      device_id,
      qr_value: finalQrValue,
      qr_image: qrImage,
    });

  } catch (error) {
    console.error("Generate QR Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Saves a base64-encoded Data URL as a PNG file.
 * Returns the absolute path of the saved file.
 * Throws an error if the dataUrl is invalid or missing Base64 data.
 */
export const saveQrImage = (dataUrl: string, fileName: string): string => {
  const parts = dataUrl.split(",");
  if (parts.length !== 2) {
    throw new Error("Invalid Data URL format: missing metadata or Base64 content.");
  }
  
  const base64Data = parts[1];
  
  if (!base64Data) {
      throw new Error("Data URL contains no Base64 content.");
  }
  const buffer = Buffer.from(base64Data, "base64");

  const outputDir = path.resolve(__dirname, "../../public/qr"); 
  
  if (!fs.existsSync(outputDir)) {
    fs.promises.mkdir(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, `${fileName}.png`);


  fs.promises.writeFile(filePath, buffer).then(() => {
    console.log(`File saved to: ${filePath}`);
  }).catch((error) => {
    console.error("Error writing file:", error);
  }); 
    
  
  
  return filePath;
};


export const GetQrListPaginated = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const qrList = await qrRepo.find({
      skip,
      take: limit,
      order: {
        created_at: "DESC",
      },
    });

    const total = await qrRepo.count();

    return res.json({
      qrList,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get Qr List Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};