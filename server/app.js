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
import shareRoutes from "./routes/shareRoutes.js";
import publicShareRoutes from "./routes/publicShareRoutes.js";
import checkAuth from "./middlewares/authMiddleware.js";
// import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";



// await connectDB();
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
app.use("/shares", checkAuth, shareRoutes);
app.use("/public-shares", publicShareRoutes);
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



// server.on("error", (err) => {
//   if (err.code === "EADDRINUSE") {
//     console.error(
//       `Port ${PORT} is already in use. Stop the running server or change PORT in .env.`
//     );
//     process.exit(1);
//   }

//   throw err;
// });


app.get("/prod_status", (req, res) => {
  const demoResponses = [
    {
      service: "storage-api",
      status: "healthy",
      severity: "info",
      message: "All storage services are operating normally.",
      suggestion: "No action is required at this time."
    },
    {
      service: "storage-api",
      status: "healthy",
      severity: "info",
      message: "Storage server is stable and responding within normal range.",
      suggestion: "System performance looks good."
    },
    {
      service: "storage-api",
      status: "warning",
      severity: "medium",
      message: "Storage pools are active, but response time is slightly elevated.",
      suggestion: "Please review Grafana metrics if the delay continues."
    },
    {
      service: "storage-api",
      status: "warning",
      severity: "medium",
      message: "Background refresh jobs are running and some recent data may still be updating.",
      suggestion: "Wait a few moments before checking the latest sync-dependent operations."
    }
  ];

  const randomIndex = Math.floor(Math.random() * demoResponses.length);
  const selected = demoResponses[randomIndex];

  res.status(200).json({
    ...selected,
    uptime: Math.floor(process.uptime()),
    lastHeartbeat: new Date().toISOString()
  });
});



// const server = app.listen(PORT, () => {
//   console.log(`Server Started ${PORT}`);
// });



export default app;