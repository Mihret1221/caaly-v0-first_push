// import type { Request, Response } from "express";
// import crypto from "crypto";
// import { AppDataSource } from "../config/data-source.js";
// import { User } from "../models/users.model.js";
// import { KycSession } from "../models/kyc_session.model.js";
// import { OtpLog } from "../models/otp.model.js";
// import { generatePKCE, getAuthorizationUrl, exchangeCodeForToken, getUserInfo } from "../services/feyda.service.js";
// import { sendSMS } from "../services/geezsms.service.js";

// const kycSessionRepo = AppDataSource.getRepository(KycSession);
// const userRepo = AppDataSource.getRepository(User);
// const otpRepo = AppDataSource.getRepository(OtpLog);

// const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// export const startKYC = async (req: Request, res: Response) => {
//   try {
//     // No user authentication required for registration start
    
//     // Generate State and PKCE
//     const state = crypto.randomBytes(16).toString("hex");
//     const { verifier, challenge } = generatePKCE();

//     // Save to DB (user_id is null for new users)
//     const session = kycSessionRepo.create({
//       state,
//       code_verifier: verifier,
//       user_id: null, 
//     });
//     await kycSessionRepo.save(session);

//     // Generate URL
//     const authorizeUrl = getAuthorizationUrl(state, challenge);

//     return res.json({
//       success: true,
//       authorizeUrl,
//       state,
//     });
//   } catch (err) {
//     console.error("KYC Start Error:", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// export const handleCallback = async (req: Request, res: Response) => {
//   try {
//     const { code, state } = req.query;

//     if (!code || !state) {
//       return res.status(400).json({ error: "Missing code or state" });
//     }

//     // Find session
//     const session = await kycSessionRepo.findOne({ where: { state: state as string } });

//     if (!session) {
//       return res.status(400).json({ error: "Invalid state or session expired" });
//     }

//     // Exchange code for token
//     const tokenData = await exchangeCodeForToken(code as string, session.code_verifier);
    
//     if (!tokenData || !tokenData.access_token) {
//       return res.status(400).json({ error: "Failed to exchange token" });
//     }

//     // Get User Info from Fayda
//     const userInfo = await getUserInfo(tokenData.access_token);
    
//     if (!userInfo) {
//       return res.status(400).json({ error: "Failed to fetch user info" });
//     }

//     // Extract Data
//     const nationalId = userInfo.national_id || "FEYDA_ID"; // Adjust claim name
//     const phone = userInfo.phone_number || userInfo.phone; // Adjust claim name
//     const name = userInfo.name || userInfo.full_name;

//     if (!phone) {
//       // If Fayda doesn't return phone, we might need to ask user? 
//       // For now, assume it does or we can't proceed with OTP flow easily without asking user to input it.
//       // Let's assume we get it or fail.
//       return res.status(400).json({ error: "Phone number not received from Fayda" });
//     }

//     // Find or Create User
//     let user = await userRepo.findOne({ where: { national_id: nationalId } });

//     if (!user) {
//       // Check by phone just in case
//       user = await userRepo.findOne({ where: { phone_number: phone } });
//     }

//     if (!user) {
//       // Create New User
//       user = userRepo.create({
//         phone_number: phone,
//         name: name,
//         national_id: nationalId,
//         gender: userInfo.gender,
//         date_of_birth: userInfo.birthdate ? new Date(userInfo.birthdate) : null,
//         kyc_photo: userInfo.picture || userInfo.photo,
//         kyc_status: true,
//       });
//     } else {
//       // Update Existing User
//       user.name = name;
//       user.national_id = nationalId;
//       user.gender = userInfo.gender;
//       user.date_of_birth = userInfo.birthdate ? new Date(userInfo.birthdate) : user.date_of_birth;
//       user.kyc_photo = userInfo.picture || userInfo.photo;
//       user.kyc_status = true;
//     }

//     await userRepo.save(user);

//     // Cleanup session
//     await kycSessionRepo.remove(session);

//     // --- OTP Flow ---
//     const otpCode = generateOTP();

//     // Save OTP
//     const otpLog = otpRepo.create({
//       user_id: user.id,
//       otp_code: otpCode,
//       is_used: false,
//     });
//     await otpRepo.save(otpLog);

//     // Send SMS
//     const message = `Your Cabit verification code is: ${otpCode}`;
//     await sendSMS(phone, message);

//     // Return success
//     return res.json({
//       success: true,
//       message: "KYC Verified. OTP sent to phone.",
//       phone: user.phone_number,
//       // We don't send token yet, user must verify OTP to get token
//     });

//   } catch (err) {
//     console.error("KYC Callback Error:", err);
//     return res.status(500).json({ success: false, message: "Server error during callback" });
//   }
// };















import * as crypto from 'crypto';
import * as jose from 'jose'; 
import type { Request, Response } from 'express';
import { buildFaydaAuthorizationUrl } from '../helpers/buildFaydaAuthorizationUrl.ts';
import { KycSession } from '../models/kyc_session.model.ts';
import { AppDataSource } from '../config/data-source.ts';
import axios from 'axios';
import https from 'https';
import { User } from '../models/users.model.ts';
import { OtpLog } from '../models/otp.model.ts';
import jwt from 'jsonwebtoken';
import { generateOTP } from './auth.controller.js';
import { sendSMS } from '../services/geezsms.service.js';
import { normalizePhoneNumber } from '../helpers/validator.js';

const kycRepo = AppDataSource.getRepository(KycSession);
const userRepo = AppDataSource.getRepository(User);
const otpRepo = AppDataSource.getRepository(OtpLog);

// helpers/generatePkce.ts
export function randomString(size = 32) {
  return crypto.randomBytes(size).toString('hex');
}

export function generatePKCEPair(){
    const codeVerifier = randomString();
    const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

    return {codeVerifier, codeChallenge};
}

//helper 
async function signWithJose(privateKey: any): Promise<string> {
  const { FAYDA_TOKEN_ENDPOINT, FAYDA_CLIENT_ID } = process.env;
  if (!FAYDA_TOKEN_ENDPOINT || !FAYDA_CLIENT_ID) {
    throw new Error('FAYDA_TOKEN_ENDPOINT and FAYDA_CLIENT_ID are required');
  }
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new jose.SignJWT({
    iss: FAYDA_CLIENT_ID,
    sub: FAYDA_CLIENT_ID,
    aud: FAYDA_TOKEN_ENDPOINT,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + 300) // 5 minutes
    .sign(privateKey);

  console.log('Client assertion JWT generated successfully');
  return jwt;
}


export async function generateFaydaAuthorizationUrl(req: Request, res: Response) {
    try {
    const {codeVerifier, codeChallenge} = generatePKCEPair();
    const state = randomString();
    const nonce = randomString();
    
    const FAYDA_AUTH_URL = process.env.FAYDA_AUTH_URL;
    const FAYDA_CLIENT_ID = process.env.FAYDA_CLIENT_ID;
    const redirectURI = process.env.FAYDA_REDIRECT_URI;


    if (!FAYDA_AUTH_URL || !FAYDA_CLIENT_ID || !redirectURI) {
        throw new Error('FAYDA_AUTH_URL, FAYDA_CLIENT_ID, and redirectURI are required');
    }

    const authorizationUrl = buildFaydaAuthorizationUrl(FAYDA_AUTH_URL, {
        response_type: 'code',
        scope: 'openid profile phone fayda_nid',
        client_id: FAYDA_CLIENT_ID,
        redirect_uri: redirectURI,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
    });

    await kycRepo.save({
        state,
        codeVerifier,
        nonce,
    });

    return res.status(200).json({
      authorizationURL: authorizationUrl,
      state,
    //   codeVerifier
    });

    } catch (error) {
        console.error('Error generating authorization URL:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}




// ---------------------------------------------------
// Generate JWT assertion for token exchange
// ---------------------------------------------------

export async function generateClientAssertion(){
    try {
    const privateKey = await jose.importPKCS8(process.env.FAYDA_PRIVATE_KEY!, 'RS256');
    return await signWithJose(privateKey);
    } catch (error) {
        console.error('Error generating client assertion:', error);
        return error;
    }
}
    

export async function faydaCallback(req: Request, res: Response) {
    try {
        const {
        FAYDA_TOKEN_ENDPOINT,
        FAYDA_USER_INFO_ENDPOINT, 
        FAYDA_CLIENT_ID,
        FAYDA_REDIRECT_URI
        } = process.env;

    console.log('faydaCallback: Config:', {
      FAYDA_TOKEN_ENDPOINT,
      FAYDA_USER_INFO_ENDPOINT,
      FAYDA_CLIENT_ID,
      FAYDA_REDIRECT_URI,
    });

        if (!FAYDA_TOKEN_ENDPOINT || !FAYDA_USER_INFO_ENDPOINT || !FAYDA_CLIENT_ID || !FAYDA_REDIRECT_URI) {
            throw new Error('FAYDA_TOKEN_ENDPOINT, FAYDA_USER_INFO_ENDPOINT, FAYDA_CLIENT_ID, and FAYDA_REDIRECT_URI are required');
        }

    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code || !state) {
        throw new Error('code and state are required');
    }

    console.log('Retrieved state:', state);
    console.log('Retrieved code:', code);

    const kycSession = await kycRepo.findOneBy({ state });
    
    if (!kycSession) {
        throw new Error('No matching kyc session found');
    }

    const storedCodeVerifier = kycSession.codeVerifier;
    // await kycRepo.delete({ state });
    console.log('Retrieved stored code_verifier:', storedCodeVerifier);

    let clientAssertion :any;
    try {
      clientAssertion = await generateClientAssertion();
      console.log(
        'Client Assertion (preview):',
        clientAssertion.slice(0, 50) + '...',
      );
    } catch (err) {
      console.error('Failed to generate client assertion:', err);
      return err;
    }


    const tokenPayload = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code.toString(),
      redirect_uri: FAYDA_REDIRECT_URI,
      client_id: FAYDA_CLIENT_ID,
      client_assertion_type:
        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
      code_verifier: storedCodeVerifier,
    });
    console.log('Token request payload:', tokenPayload.toString());

    let tokenResponse;
    try {
      const agent = new https.Agent({ rejectUnauthorized: false });
      tokenResponse = await axios.post(FAYDA_TOKEN_ENDPOINT, tokenPayload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        httpsAgent: agent,
      });
      if (!tokenResponse) {
        throw new Error('No token response data');
      }
      console.log('Token response:', tokenResponse.data);
    } catch (err: any) {
      console.error('Error fetching token:', err|| err);
      return res.status(500).json({
        error: 'Failed to retrieve access token from Fayda',
        details: err?.response?.data || err?.message,
      });
    }

    const idToken = tokenResponse.data?.id_token;
    if (!idToken) {
        console.error('No ID token in response:', tokenResponse.data);
        return res.status(500).json({
            message: 'Failed to retrieve ID token from Fayda',
            details: tokenResponse.data,
        });
    }

    const decodedIdToken = jwt.decode(idToken);
    if (!decodedIdToken || typeof decodedIdToken === 'string') {
        console.error('Failed to decode ID token:', idToken);
        return res.status(500).json({
            message: 'Failed to decode ID token',
        });
    }

    const idTokenNonce = (decodedIdToken as any).nonce;
    if (idTokenNonce !== kycSession.nonce) {
        console.error('Nonce mismatch. Expected:', kycSession.nonce, 'Received:', idTokenNonce);
        return res.status(400).json({
            message: 'Nonce mismatch, potential replay attack',
        });
    }

    const accessToken = tokenResponse.data?.access_token;
    console.log('Access token obtained');

    if (!accessToken) {
      console.error('No access token in response:', tokenResponse.data);
      return res.status(500).json({
        message: 'Failed to retrieve access token from Fayda',
        details: tokenResponse.data,
      });
    }

    // 2) FETCH USER INFO (
    let userinfoResponse;
    try {
      userinfoResponse = await axios.get(FAYDA_USER_INFO_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        //   'Scope': 'openid profile phone fayda_nid',
        },
      });
      console.log('User info response preview:', userinfoResponse.data);
    } catch (err: any) {
      console.error('Error fetching user info:', err?.response?.data || err);
      return res.status(500).json({
        error: 'Failed to fetch user info from Fayda',
        details: err?.response?.data || err?.message,
      });
    }

    let userInfo = userinfoResponse.data;
    console.log('User info:', userInfo);
     if (typeof userInfo === 'string') {
           userInfo = jwt.decode(userInfo);
          console.log('Decoded user info:', userInfo); 
      }

    // 3) RETURN USER DATA TO FRONTEND (don't save to DB yet)
    // Frontend will display this data in uneditable fields and collect email + password
    
    const userData = {
        phone_number: userInfo.phone_number as string,
        name: userInfo.name as string,
        national_id: (userInfo.fayda_fin || userInfo.sub) as string,
        gender: userInfo.gender as string | null,
        date_of_birth: userInfo.birthdate || null,
        kyc_photo: userInfo.picture || userInfo.photo || "",
        address: userInfo.address ? {
            zone: userInfo.address.zone,
            kebele: userInfo.address.kebele,
            region: userInfo.address.region,
            woreda: userInfo.address.woreda,
        } : null,
    };
    
    // 4) SEND DATA BACK TO FRONTEND
    return res.status(200).json({
      success: true,
      message: "KYC verification successful",
      userData
    });


    } catch (error) {
        console.error('Error in faydaCallback:', error);
        return error;
    }
}




