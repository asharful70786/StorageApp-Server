import { Resend } from "resend";
import OTP from "../models/otpModel.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpService(email) {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  // Upsert OTP (replace if it already exists)
  await OTP.findOneAndUpdate(
    { email },
    { otp, createdAt: new Date() },
    { upsert: true }
  );

  const html = `
  <div style="font-family:Arial, sans-serif; max-width:600px; margin:auto;">
    <h2>Verify your email</h2>
    <p>Use the OTP below to complete your sign-in to <strong>Storage App</strong>.</p>

    <div style="font-size:24px; font-weight:bold; margin:20px 0;">
      ${otp}
    </div>

    <p>This code expires in 10 minutes.</p>

    <hr />
    <p style="font-size:12px; color:#666;">
      You received this email because you attempted to sign in to Storage App.
      If this wasn’t you, you can safely ignore this email.
    </p>
  </div>
`;


 await resend.emails.send({
  from: "Storage App <otp@zenpix.shop>",
  to: email,
  subject: "Your Storage App verification code",
  html,
  text: `Your Storage App verification code is ${otp}. It expires in 10 minutes.`,
});


  return { success: true, message: `OTP sent successfully on ${email}` };
}
