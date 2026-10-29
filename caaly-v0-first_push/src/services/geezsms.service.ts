import axios from "axios";
import https from "https";
const GEEZSMS_API_URL = process.env.GEEZSMS_API_URL;
const GEEZSMS_API_KEY = process.env.GEEZSMS_API_KEY;

export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  if (!GEEZSMS_API_KEY || !GEEZSMS_API_URL) {
    console.warn("⚠️ GEEZSMS_API_KEY or GEEZSMS_API_URL is not set. SMS will not be sent.");
    return false;
  }
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  try {
    const response = await axios.post(GEEZSMS_API_URL, null, {
      params: {
        token: GEEZSMS_API_KEY,
        phone: phone,
        msg: message,
      },
      httpsAgent,
    });

    if (response.status === 200) {
      console.log(`✅ SMS sent to ${phone}`);
      return true;
    } else {
      console.error(`❌ Failed to send SMS: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Error sending SMS:", error);
    return false;
  }
};
