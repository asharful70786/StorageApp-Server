import { createClient } from "redis";

// if (!process.env.REDIS_URL) {
//   console.log("Redis URL not found");
//   process.exit(1);
// }



const redisClient = createClient({
  url: "redis://default:hqJuakSh3y4g5ngDkQJEv3OaWRNZg9vj@redis-17338.crce276.ap-south-1-3.ec2.cloud.redislabs.com:17338",
   RESP: 2,
});



redisClient.on("error", (err) => {
  console.log("Redis Client Error", err);
  process.exit(1);
});

await redisClient.connect();

export default redisClient;
