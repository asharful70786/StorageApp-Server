import "dotenv/config";
import { createClient } from "redis";

const defaultRedisHost =
  "redis-17338.crce276.ap-south-1-3.ec2.cloud.redislabs.com";
const defaultRedisPort = "17338";

const getRedisUrl = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  if (!process.env.REDIS_PASSWORD) {
    throw new Error("REDIS_URL or REDIS_PASSWORD is required");
  }

  const host = process.env.REDIS_HOST || defaultRedisHost;
  const port = process.env.REDIS_PORT || defaultRedisPort;
  const password = encodeURIComponent(process.env.REDIS_PASSWORD);

  return `redis://default:${password}@${host}:${port}`;
};

export const redisClient = createClient({
  url: getRedisUrl(),
  RESP: 2,
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        return new Error("Redis connection retries exhausted");
      }

      return Math.min(retries * 500, 3000);
    },
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});

/**
 * Connects to Redis if the client is not already connected.
 *
 * @returns {Promise<void>}
 */
export const connectRedis = async () => {
  if (redisClient.isOpen) return;

  await redisClient.connect();
  console.log("Redis connected");
};
