import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import schedulesRouter from "../routes/schedules.js";
import authMiddleware from "../util/authMiddleware.js";

dotenv.config();
const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

app.use("/reports", express.static(path.join(process.cwd(), "reports")));

app.use("/api", authMiddleware);
app.use("/api/schedules", schedulesRouter);

app.get("/", (req, res) => {
  res.send("School Schedules API is running");
});

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("MongoDB connected");
  app.listen(process.env.PORT, () => console.log("Server running"));
});
