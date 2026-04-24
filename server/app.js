import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import directoryRoutes from "./routes/directoryRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import checkAuth from "./middlewares/authMiddleware.js";
import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";



await connectDB();
await connectRedis();

const app = express();

const PORT = process.env.PORT || 4000;




app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);





app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET));

app.get("/", (req, res) => {
  res.json({ message: "Hey man how are you ==> Ashraful" });
});

app.get("/err", (req, res) => {
  console.log("process exited with error");
  process.exit(1);
});

app.use("/directory", checkAuth, directoryRoutes);
app.use("/file", checkAuth, fileRoutes);
app.use("/subscriptions", checkAuth, subscriptionRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/", userRoutes);
app.use("/auth", authRoutes);

app.use((err, req, res, next) => {
  console.log(err);
  res.json(err);
});

app.get("/err", (req, res) => {
  console.log("error happened");
  process.exit(1);
});

const server = app.listen(PORT, () => {
  console.log(`Server Started ${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the running server or change PORT in .env.`
    );
    process.exit(1);
  }

  throw err;
});


// export default app;
