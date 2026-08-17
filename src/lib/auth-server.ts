import { createServerFn } from "@tanstack/react-start";

// In-memory OTP storage for ephemeral validation (can be backed with Redis / KV in production)
interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const otpStore = new Map<string, OtpRecord>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const MAX_ATTEMPTS = 5;

function cleanupExpiredOtps() {
  const now = Date.now();
  for (const [key, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}

/**
 * Dispatch SMS via Fast2SMS (Indian mobile numbers like +91 / Nagpur)
 */
async function sendSmsViaFast2SMS(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) return false;

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  try {
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        variables_values: otp,
        route: "otp",
        numbers: cleanPhone,
      }),
    });

    const data = (await res.json()) as { return?: boolean };
    return res.ok && data?.return === true;
  } catch (err) {
    console.error("[Fast2SMS Error]", err);
    return false;
  }
}

/**
 * Dispatch SMS via Twilio
 */
async function sendSmsViaTwilio(phone: string, otp: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) return false;

  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith("+")) {
    formattedPhone = `+91${formattedPhone.replace(/\D/g, "")}`;
  }

  let formattedFrom = from.trim();
  if (!formattedFrom.startsWith("+")) {
    formattedFrom = `+${formattedFrom}`;
  }

  try {
    const basicAuth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      To: formattedPhone,
      From: formattedFrom,
      Body: `Your FlowGuard Nagpur Traffic Intelligence verification code is: ${otp}. Valid for 5 minutes. Do not share this OTP.`,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = (await res.json()) as { sid?: string; message?: string; status?: string; error_code?: number };
    if (!res.ok) {
      console.error("[Twilio Error Response]", data);
      return false;
    }

    console.log(`[Twilio SMS Dispatched] SID: ${data.sid}, Status: ${data.status} to ${formattedPhone}`);
    return true;
  } catch (err) {
    console.error("[Twilio Error]", err);
    return false;
  }
}


/**
 * Dispatch Email OTP via Resend
 */
async function sendEmailViaResend(email: string, otp: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "FlowGuard Security <onboarding@resend.dev>";

  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email.trim().toLowerCase()],
        subject: `Your FlowGuard Verification Code: ${otp}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-top: 0;">FlowGuard Traffic Intelligence</h2>
            <p style="color: #475569; font-size: 14px;">Use the verification code below to access your account for Nagpur Traffic Network monitoring and signal controls.</p>
            <div style="background: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb;">${otp}</span>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This code expires in 5 minutes. If you did not request this code, please ignore this email.</p>
          </div>
        `,
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("[Resend Email Error]", err);
    return false;
  }
}

export type SendOtpResponse = {
  success: boolean;
  message: string;
  provider?: "twilio" | "fast2sms" | "resend" | "dev_mode";
  demoCode?: string;
  cooldownSeconds: number;
  ttlSeconds: number;
};

/**
 * Server Function: Generate and Send OTP
 */
export const sendOtpServerFn = createServerFn({ method: "POST" })
  .validator((data: { contact: string }) => {
    const contact = data.contact.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const isPhone = /^(\+?\d[\d\s-]{7,14})$/.test(contact);

    if (!isEmail && !isPhone) {
      throw new Error("Invalid email address or mobile phone number.");
    }
    return { contact, isEmail };
  })
  .handler(async ({ data }): Promise<SendOtpResponse> => {
    cleanupExpiredOtps();

    const key = data.contact.toLowerCase();
    const now = Date.now();
    const existing = otpStore.get(key);

    if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      const waitLeft = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      return {
        success: false,
        message: `Please wait ${waitLeft} seconds before requesting a new OTP.`,
        cooldownSeconds: waitLeft,
        ttlSeconds: Math.ceil((existing.expiresAt - now) / 1000),
      };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(key, {
      code: otp,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now,
    });

    let provider: "twilio" | "fast2sms" | "resend" | "dev_mode" = "dev_mode";
    let sent = false;

    if (data.isEmail) {
      if (process.env.RESEND_API_KEY) {
        sent = await sendEmailViaResend(data.contact, otp);
        if (sent) provider = "resend";
      }
    } else {
      if (process.env.FAST2SMS_API_KEY) {
        sent = await sendSmsViaFast2SMS(data.contact, otp);
        if (sent) provider = "fast2sms";
      } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        sent = await sendSmsViaTwilio(data.contact, otp);
        if (sent) provider = "twilio";
      }
    }

    if (provider === "dev_mode") {
      console.log(`[FlowGuard Server OTP] Dev Mode OTP for ${data.contact}: ${otp}`);
      return {
        success: true,
        message: `OTP generated for ${data.contact}. (Development Mode)`,
        provider: "dev_mode",
        demoCode: otp,
        cooldownSeconds: 30,
        ttlSeconds: 300,
      };
    }

    return {
      success: true,
      message: `OTP successfully dispatched to ${data.contact} via ${provider}.`,
      provider,
      cooldownSeconds: 30,
      ttlSeconds: 300,
    };
  });

export type VerifyOtpResponse = {
  success: boolean;
  message: string;
  token?: string;
  contact?: string;
};

/**
 * Server Function: Verify OTP
 */
export const verifyOtpServerFn = createServerFn({ method: "POST" })
  .validator((data: { contact: string; code: string }) => {
    if (!data.contact?.trim() || !data.code?.trim()) {
      throw new Error("Contact and 6-digit OTP code are required.");
    }
    return { contact: data.contact.trim().toLowerCase(), code: data.code.trim() };
  })
  .handler(async ({ data }): Promise<VerifyOtpResponse> => {
    cleanupExpiredOtps();

    const record = otpStore.get(data.contact);

    if (!record) {
      return {
        success: false,
        message: "No active OTP request found or code has expired. Please request a new code.",
      };
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(data.contact);
      return {
        success: false,
        message: "OTP code has expired. Please request a new code.",
      };
    }

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      otpStore.delete(data.contact);
      return {
        success: false,
        message: "Too many failed attempts. Please request a fresh OTP.",
      };
    }

    if (record.code !== data.code) {
      const remaining = MAX_ATTEMPTS - record.attempts;
      return {
        success: false,
        message: `Incorrect OTP code. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
      };
    }

    otpStore.delete(data.contact);
    const sessionToken = `fg_session_${Buffer.from(`${data.contact}_${Date.now()}`).toString("base64url")}`;

    return {
      success: true,
      message: "Phone / Email verified successfully.",
      token: sessionToken,
      contact: data.contact,
    };
  });
