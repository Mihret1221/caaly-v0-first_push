import type { Request, Response } from "express";
import { AppDataSource } from "../config/data-source.js";
import { Trip } from "../models/trips.model.js";
import { Payment } from "../models/payments.model.js";
import { initiatePayment, verifyPayment } from "../services/payment.service.js";

const tripRepo = AppDataSource.getRepository(Trip);
const paymentRepo = AppDataSource.getRepository(Payment);

export const startPayment = async (req: Request, res: Response) => {
  try {
    const { trip_id, method } = req.body;
    const userId = req.user?.id;

    if (!trip_id || !method) {
      return res.status(400).json({ error: "Trip ID and payment method are required" });
    }

    // 1. Find Trip
    const trip = await tripRepo.findOne({ where: { id: trip_id }, relations: ["user"] });
    
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    if (trip.user_id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!trip.end_time) {
      return res.status(400).json({ error: "Trip is still active. End trip first." });
    }

    // Check if already paid
    const existingPayment = await paymentRepo.findOne({ 
      where: { trip: { id: trip.id }, status: "paid" } 
    });
    if (existingPayment) {
      return res.status(400).json({ error: "Trip is already paid" });
    }

    const amount = trip.total_fare || 0;
    if (amount <= 0) {
      return res.status(400).json({ error: "Invalid fare amount" });
    }

    // 2. Create Payment Record (Pending)
    const reference = `TRIP-${trip.id}-${Date.now()}`;
    const payment = paymentRepo.create({
      trip: trip,
      method: method,
      amount: amount,
      status: "pending",
      reference: reference,
    });
    await paymentRepo.save(payment);

    // 3. Call Payment Service
    const userEmail = "user@example.com"; // In real app, get from User entity if available
    const result = await initiatePayment(method, amount, reference, userEmail);

    if (result.success) {
      return res.json({
        message: "Payment initiated",
        paymentUrl: result.paymentUrl,
        reference: reference,
      });
    } else {
      payment.status = "failed";
      await paymentRepo.save(payment);
      return res.status(500).json({ error: result.message || "Payment initiation failed" });
    }

  } catch (error) {
    console.error("Start Payment Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const handleChapaCallback = async (req: Request, res: Response) => {
  // Chapa sends data in body or we verify by reference
  // Usually we just acknowledge and verify manually to be safe
  try {
    const { tx_ref, status } = req.body; 
    // Or req.query depending on how Chapa is configured (webhook vs return url)
    
    // For webhook, Chapa sends JSON body
    if (status === "success" && tx_ref) {
       const payment = await paymentRepo.findOne({ where: { reference: tx_ref } });
       if (payment && payment.status !== "paid") {
         payment.status = "paid";
         await paymentRepo.save(payment);
         
         // Update Trip payment status if needed (optional, as we link via FK)
       }
    }
    
    return res.sendStatus(200);
  } catch (error) {
    console.error("Chapa Webhook Error:", error);
    return res.sendStatus(500);
  }
};

export const handleTelebirrCallback = async (req: Request, res: Response) => {
  try {
    // Telebirr callback logic here (decryption etc)
    // For now, assume success if we get a valid reference
    const { outTradeNo, tradeStatus } = req.body;

    if (tradeStatus === "Success" && outTradeNo) {
      const payment = await paymentRepo.findOne({ where: { reference: outTradeNo } });
       if (payment && payment.status !== "paid") {
         payment.status = "paid";
         await paymentRepo.save(payment);
       }
    }

    return res.json({ code: 0, msg: "success" });
  } catch (error) {
    console.error("Telebirr Webhook Error:", error);
    return res.json({ code: 1, msg: "failed" });
  }
};
