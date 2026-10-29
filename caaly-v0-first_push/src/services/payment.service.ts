import axios from "axios";
import crypto from "crypto";

// --- Configuration ---
const TELEBIRR_API_URL = process.env.TELEBIRR_API_URL || "https://app.telebirr.et/api";
const TELEBIRR_APP_ID = process.env.TELEBIRR_APP_ID;
const TELEBIRR_APP_KEY = process.env.TELEBIRR_APP_KEY;

const CHAPA_API_URL = process.env.CHAPA_API_URL || "https://api.chapa.co/v1";
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;

// --- Interfaces ---
export interface PaymentInitiateResponse {
  success: boolean;
  paymentUrl?: string; // URL to redirect user to
  transactionReference: string;
  message?: string;
}

// --- Telebirr Implementation (Placeholder) ---
const initiateTelebirrPayment = async (amount: number, reference: string): Promise<PaymentInitiateResponse> => {
  if (!TELEBIRR_APP_ID) {
    console.warn("⚠️ TELEBIRR_APP_ID not set. Mocking response.");
    return {
      success: true,
      paymentUrl: "https://telebirr.mock/pay?ref=" + reference,
      transactionReference: reference,
    };
  }

  try {
    // Construct payload (This varies by Telebirr API version)
    // Usually involves signing the payload with APP_KEY
    const payload = {
      appId: TELEBIRR_APP_ID,
      outTradeNo: reference,
      totalAmount: amount,
      returnUrl: `${process.env.API_URL || "http://localhost:3000"}/api/payment/callback/telebirr`,
      // ... other required fields
    };

    // const response = await axios.post(`${TELEBIRR_API_URL}/toTradeWebPay`, payload);
    // return { success: true, paymentUrl: response.data.toPayUrl, ... };

    return {
      success: false,
      message: "Telebirr integration pending API docs",
      transactionReference: reference,
    };
  } catch (error) {
    console.error("Telebirr Error:", error);
    return { success: false, transactionReference: reference, message: "Payment failed" };
  }
};

// --- Chapa Implementation (Standard) ---
const initiateChapaPayment = async (amount: number, reference: string, email: string): Promise<PaymentInitiateResponse> => {
  if (!CHAPA_SECRET_KEY) {
    console.warn("⚠️ CHAPA_SECRET_KEY not set. Mocking response.");
    return {
      success: true,
      paymentUrl: "https://checkout.chapa.co/mock-checkout/" + reference,
      transactionReference: reference,
    };
  }

  try {
    const response = await axios.post(
      `${CHAPA_API_URL}/transaction/initialize`,
      {
        amount: amount,
        currency: "ETB",
        email: email,
        tx_ref: reference,
        callback_url: `${process.env.API_URL || "http://localhost:3000"}/api/payment/callback/chapa`,
        return_url: "myapp://payment-success", // Mobile deep link
      },
      {
        headers: {
          Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
        },
      }
    );

    if (response.data.status === "success") {
      return {
        success: true,
        paymentUrl: response.data.data.checkout_url,
        transactionReference: reference,
      };
    } else {
      return { success: false, transactionReference: reference, message: response.data.message };
    }
  } catch (error) {
    console.error("Chapa Error:", error);
    return { success: false, transactionReference: reference, message: "Payment failed" };
  }
};

// --- Main Service Export ---
export const initiatePayment = async (
  method: "telebirr" | "chapa",
  amount: number,
  reference: string,
  userEmail: string = "customer@cabit.com"
): Promise<PaymentInitiateResponse> => {
  if (method === "telebirr") {
    return initiateTelebirrPayment(amount, reference);
  } else if (method === "chapa") {
    return initiateChapaPayment(amount, reference, userEmail);
  }
  return { success: false, transactionReference: reference, message: "Invalid payment method" };
};

export const verifyPayment = async (method: "telebirr" | "chapa", reference: string): Promise<boolean> => {
  // Implement verification logic (calling provider API to check status)
  // For Chapa: GET /transaction/verify/{tx_ref}
  
  if (method === "chapa" && CHAPA_SECRET_KEY) {
    try {
      const response = await axios.get(`${CHAPA_API_URL}/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${CHAPA_SECRET_KEY}` },
      });
      return response.data.status === "success";
    } catch (e) {
      console.error("Chapa Verify Error:", e);
      return false;
    }
  }
  
  return true; // Mock success for now
};
