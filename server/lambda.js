import serverless from 'serverless-http';
import app from './app.js';
import { connectDB } from "./config/db.js";

await connectDB();

export const handler = serverless(app);

