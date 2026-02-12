import Directory from "../models/directoryModel.js";
import User from "../models/userModel.js";
import mongoose, { Types } from "mongoose";
import Session from "../models/sessionModel.js";
import OTP from "../models/otpModel.js";
import redisClient from "../config/redis.js";
import { z } from "zod/v4";
import { loginSchema, registerSchema } from "../validators/authSchema.js";

export const register = async (req, res, next) => {
  const { success, data, error } = registerSchema.safeParse(req.body);

  if (!success) {
    return res.status(400).json({ error: z.flattenError(error).fieldErrors });
  }

  const { name, email, password, otp } = data;
  console.log(otp);
  const otpRecord = await OTP.findOne({ email, otp });

  if (!otpRecord) {
    return res.status(400).json({ error: "Invalid or Expired OTP!" });
  }

  await otpRecord.deleteOne();

  const session = await mongoose.startSession();

  try {
    const rootDirId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    session.startTransaction();

    await Directory.insertOne(
      {
        _id: rootDirId,
        name: `root-${email}`,
        parentDirId: null,
        userId,
      },
      { session }
    );

    await User.insertOne(
      {
        _id: userId,
        name,
        email,
        password,
        rootDirId,
      },
      { session }
    );

    session.commitTransaction();

    res.status(201).json({ message: "User Registered" });
  } catch (err) {
    session.abortTransaction();
    console.log(err);
    if (err.code === 121) {
      res
        .status(400)
        .json({ error: "Invalid input, please enter valid details" });
    } else if (err.code === 11000) {
      if (err.keyValue.email) {
        return res.status(409).json({
          error: "This email already exists",
          message:
            "A user with this email address already exists. Please try logging in or use a different email.",
        });
      }
    } else {
      next(err);
    }
  }
};

export const login = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid Credentials" });
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Invalid Credentials" });

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(404).json({ error: "Invalid Credentials" });
    }

    const userId = String(user._id);

    const sessionExpirySeconds = 60 * 60 * 24 * 7;
    const sessionExpiryMs = sessionExpirySeconds * 1000;

    const sessionId = crypto.randomUUID();
    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user:sessions:${userId}`;

    // ✅ FIX: if old data exists with wrong type, delete it
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

    // Keep set expiring too
    await redisClient.expire(userSessionsKey, sessionExpirySeconds);

    // Enforce max 2 sessions
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
    return next(err);
  }
};


export const getAllUsers = async (req, res) => {
  const allUsers = await User.find({ deleted: false }).lean();
  const allSessions = await Session.find().lean();
  const allSessionsUserId = allSessions.map(({ userId }) => userId.toString());
  const allSessionsUserIdSet = new Set(allSessionsUserId);

  const transformedUsers = allUsers.map(({ _id, name, email }) => ({
    id: _id,
    name,
    email,
    isLoggedIn: allSessionsUserIdSet.has(_id.toString()),
  }));
  res.status(200).json(transformedUsers);
};

export const getCurrentUser = async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  const rootDir = await Directory.findById(user.rootDirId).lean();
  res.status(200).json({
    name: user.name,
    email: user.email,
    picture: user.picture,
    role: user.role,
    maxStorageInBytes: user.maxStorageInBytes,
    usedStorageInBytes: rootDir.size,
  });
};

export const logout = async (req, res) => {
  const { sid } = req.signedCookies;
  await redisClient.del(`session:${sid}`);
  res.clearCookie("sid");
  res.status(204).end();
};

export const logoutById = async (req, res, next) => {
  try {
    await Session.deleteMany({ userId: req.params.userId });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const logoutAll = async (req, res) => {
  const { sid } = req.signedCookies;
  const session = await redisClient.json.get(`session:${sid}`);
  const allSessions = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{${session.userId}}`,
    {
      RETURN: [],
    }
  );
  await redisClient.del(allSessions.documents.map(({ id }) => id));
  res.status(204).end();
};

export const deleteUser = async (req, res, next) => {
  const { userId } = req.params;
  if (req.user._id.toString() === userId) {
    return res.status(403).json({ error: "You can not delete yourself." });
  }
  try {
    await Session.deleteMany({ userId });
    await User.findByIdAndUpdate(userId, { deleted: true });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
