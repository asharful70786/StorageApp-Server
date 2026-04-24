import mongoose, { Types } from "mongoose";
import OTP from "../models/otpModel.js";
import User from "../models/userModel.js";
import Directory from "../models/directoryModel.js";
import { verifyIdToken } from "../services/googleAuthService.js";
import { sendOtpService } from "../services/sendOtpService.js";
import { redisClient } from "../config/redis.js";
import { otpSchema } from "../validators/authSchema.js";

export const sendOtp = async (req, res, next) => {
  const { email } = req.body;
  const resData = await sendOtpService(email);
  res.status(201).json(resData);
};

export const verifyOtp = async (req, res, next) => {
  const { success, data } = otpSchema.safeParse(req.body);

  console.log(req.body);
  console.log(data);

  if (!success) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  const { email, otp } = data;
  const otpRecord = await OTP.findOne({ email, otp });

  if (!otpRecord) {
    return res.status(400).json({ error: "Invalid or Expired OTP!" });
  }

  return res.json({ message: "OTP Verified!" });
};

export const loginWithGoogle = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    const userData = await verifyIdToken(idToken);
    const { name, email, picture } = userData;

    let user = await User.findOne({ email }).select("-__v");

    // Create user if not exists
    if (!user) {
      const mongooseSession = await mongoose.startSession();
      mongooseSession.startTransaction();

      try {
        const rootDirId = new Types.ObjectId();
        const userId = new Types.ObjectId();

        await Directory.insertOne(
          {
            _id: rootDirId,
            name: `root-${email}`,
            parentDirId: null,
            userId,
          },
          { session: mongooseSession }
        );

        await User.insertOne(
          {
            _id: userId,
            name,
            email,
            picture,
            rootDirId,
          },
          { session: mongooseSession }
        );

        await mongooseSession.commitTransaction();

        user = await User.findById(userId);
      } catch (err) {
        await mongooseSession.abortTransaction();
        throw err;
      } finally {
        mongooseSession.endSession();
      }
    }

    if (user.deleted) {
      return res.status(403).json({
        error: "Your account has been deleted. Contact app owner to recover.",
      });
    }

    // Update picture if needed
    if (!user.picture?.includes("googleusercontent.com")) {
      user.picture = picture;
      await user.save();
    }

    const userId = String(user._id);

    const sessionExpirySeconds = 60 * 60 * 24 * 7;
    const sessionExpiryMs = sessionExpirySeconds * 1000;

    const sessionId = crypto.randomUUID();
    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user:sessions:${userId}`;

    // Fix wrong key types
    const t = await redisClient.type(userSessionsKey);
    if (t !== "none" && t !== "set") {
      await redisClient.del(userSessionsKey);
    }

    // Store session
    await redisClient.set(
      sessionKey,
      JSON.stringify({
        userId,
        rootDirId: user.rootDirId,
      }),
      { EX: sessionExpirySeconds }
    );

    // Track sessions
    await redisClient.sAdd(userSessionsKey, sessionKey);

    await redisClient.expire(userSessionsKey, sessionExpirySeconds);

    // Max 2 sessions
    const count = await redisClient.sCard(userSessionsKey);
    if (count > 2) {
      const oldSessionKey = await redisClient.sPop(userSessionsKey);
      if (oldSessionKey) await redisClient.del(oldSessionKey);
    }

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      sameSite: "none",
      secure: true,
      maxAge: sessionExpiryMs,
    });

    return res.json({ message: "logged in" });

  } catch (err) {
    next(err);
  }
};
