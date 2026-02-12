import dotenv from "dotenv";
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

import crypto from "crypto";
import { exec } from "child_process";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 4000;


//we fully moved to Github action and no lambda so its ;-> webHook useLess
// app.post("/github-webhook",  express.raw({ type: "application/json" }),  (req, res) => {
//     // const signature = req.headers["x-hub-signature-256"];
//     // if (!signature) {
//     //   console.error("Missing signature");
//     //   return res.status(401).send("Unauthorized");
//     // }

//     // const hmac = crypto
//     //   .createHmac("sha256", process.env.git_webHook_sec)
//     //   .update(req.body) 
//     //   .digest("hex");

//     // const expectedSignature = `sha256=${hmac}`;

//     // if (signature !== expectedSignature) {
//     //   console.error("Signature mismatch");
//     //   return res.status(401).send("Unauthorized");
//     // }

//     res.status(200).send("OK");

//     console.log("Webhook verified — starting deploy...");

//     exec("bash /home/ubuntu/server-deployment.sh", (err, stdout, stderr) => {
//       if (err) return console.error("Backend deploy error:", stderr);
//       console.log("Backend deployed:", stdout);
//     });
//   }
// );

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

app.listen(PORT, () => {
  console.log(`Server Started ${PORT}`);
});


// export default app;