import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const redisClient = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST || "redis-17338.crce276.ap-south-1-3.ec2.cloud.redislabs.com",
    port: Number(process.env.REDIS_PORT || 17338),
  },
});

// ---- CONFIG: change these to match your app ----
const USER_INDEX = "userIdIdx";
const USER_KEY_PREFIX = "user:"; // keys like: user:<id> (HASH)

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

// Check + create RediSearch index if missing
async function ensureUserIndex() {
 
  let indexes = [];
  try {
    indexes = await redisClient.sendCommand(["FT._LIST"]);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.toLowerCase().includes("unknown command") || msg.toLowerCase().includes("ft._list")) {
      throw new Error(
        "RediSearch module not available. You are using FT.* commands but Redis doesn't support them. Use Redis Stack / enable RediSearch."
      );
    }
    throw e;
  }

  if (indexes.includes(USER_INDEX)) {
    console.log(`RedisSearch index '${USER_INDEX}' already exists ✅`);
    return;
  }

  console.log(`RedisSearch index '${USER_INDEX}' not found. Creating...`);

  // Schema: adjust fields to whatever you store in your user hash
  // Example user hash:
  // HSET user:<uuid> userId <uuid> email <email> googleId <id> createdAt <ts>
  await redisClient.sendCommand([
    "FT.CREATE",
    USER_INDEX,
    "ON",
    "HASH",
    "PREFIX",
    "1",
    USER_KEY_PREFIX,
    "SCHEMA",
    "userId",
    "TEXT",
    "SORTABLE",
    "email",
    "TEXT",
    "SORTABLE",
    "googleId",
    "TEXT",
    "SORTABLE",
    "createdAt",
    "NUMERIC",
    "SORTABLE",
  ]);

  console.log(`RedisSearch index '${USER_INDEX}' created ✅`);
}

// Init function to be called once at startup
export async function initRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected ✅");
  }

  await ensureUserIndex();
  return redisClient;
}

export default redisClient;
