import express from "express";
import multer from "multer";
import {
  uploadExcel,
  getStudentSchedule,
  getTeacherSchedule,
  getRekapJP,
  exportJP,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getAllSchedules,
} from "../controllers/schedulesController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// CRUD
router.post("/", createSchedule);
router.get("/", getAllSchedules);
router.put("/:id", updateSchedule);
router.delete("/:id", deleteSchedule);

// Upload Excel
router.post("/upload", upload.single("file"), uploadExcel);

// FE endpoint
router.get("/student", getStudentSchedule);
router.get("/teacher", getTeacherSchedule);
router.get("/report/rekap-jp", getRekapJP);

// Export Excel
router.get("/export", exportJP);

export default router;
