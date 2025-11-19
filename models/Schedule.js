import mongoose from "mongoose";

const ScheduleSchema = new mongoose.Schema({
  class_code: String,
  class_name: String,
  subject_code: String,
  teacher_nik: String,
  teacher_name: String,
  date: {
    type: String,
    required: true,
  },
  jam_ke: Number,
  time_start: String,
  time_end: String,
});

export default mongoose.model("Schedule", ScheduleSchema);
