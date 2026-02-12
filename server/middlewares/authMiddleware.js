import redisClient from "../config/redis.js";

export default async function checkAuth(req, res, next) {
  try {
    const { sid } = req.signedCookies;

    if (!sid) {
      res.clearCookie("sid");
      return res.status(401).json({ error: "Not logged in!" });
    }

    const key = `session:${sid}`;

    // ✅ We store sessions using SET, so read using GET
    const raw = await redisClient.get(key);

    if (!raw) {
      res.clearCookie("sid");
      return res.status(401).json({ error: "Not logged in!" });
    }

    let session;
    try {
      session = JSON.parse(raw);
    } catch {
      // corrupted/old session value -> delete it
      await redisClient.del(key);
      res.clearCookie("sid");
      return res.status(401).json({ error: "Not logged in!" });
    }

    req.user = { _id: session.userId, rootDirId: session.rootDirId };
    return next();
  } catch (err) {
    return next(err);
  }
}

export const checkNotRegularUser = (req, res, next) => {
  if (req.user?.role !== "User") return next();
  return res.status(403).json({ error: "You can not access users" });
};

export const checkIsAdminUser = (req, res, next) => {
  if (req.user?.role === "Admin") return next();
  return res.status(403).json({ error: "You can not delete users" });
};
