import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import Schedule from "../models/Schedule.js";

export const createSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.create(req.body);
    res.json({ message: "Created", data: schedule });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getAllSchedules = async (req, res) => {
  try {
    const data = await Schedule.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const updated = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.json({ message: "Updated", data: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.json({ message: "Deleted", data: deleted });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File tidak ditemukan" });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const schedules = [];

    const formatTime = (val) => {
      if (typeof val === "number") {
        const totalSec = Math.round(val * 24 * 3600);
        const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
        const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
        const s = String(totalSec % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
      }
      return val.toString().padStart(8, "0");
    };

    const formatDate = (value) => {
      if (typeof value === "number") {
        const d = XLSX.SSF.parse_date_code(value);
        if (!d) throw new Error("Tanggal tidak valid");
        return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(
          2,
          "0"
        )}`;
      }

      const date = new Date(value);
      if (isNaN(date.getTime()))
        throw new Error("Format tanggal tidak dikenali");

      return date.toISOString().slice(0, 10);
    };

    for (const r of rows) {
      try {
        const row = {};
        for (const key in r) {
          row[key.replace(/\u00A0/g, "").trim()] = r[key];
        }

        const required = [
          "Kode Kelas",
          "Nama Kelas",
          "Kode Mapel",
          "NIK Guru",
          "Nama Guru",
          "Tanggal",
          "Jam Ke",
          "Mulai",
          "Selesai",
        ];

        let valid = true;
        for (const col of required) {
          if (!row[col]) valid = false;
        }
        if (!valid) continue;

        const dateValue = formatDate(row["Tanggal"]);

        const timeStart = formatTime(row["Mulai"]);
        const timeEnd = formatTime(row["Selesai"]);

        schedules.push({
          class_code: row["Kode Kelas"],
          class_name: row["Nama Kelas"],
          subject_code: row["Kode Mapel"],
          teacher_nik: row["NIK Guru"].toString(),
          teacher_name: row["Nama Guru"],
          date: dateValue,
          jam_ke: Number(row["Jam Ke"]),
          time_start: timeStart,
          time_end: timeEnd,
        });
      } catch (rowErr) {
        console.error("ROW ERROR:", r, rowErr.message);
        continue;
      }
    }

    fs.unlinkSync(req.file.path);

    const created = await Schedule.bulkCreate(schedules);

    return res.json({
      message: `Upload sukses, ${created.length} jadwal ditambahkan`,
      data: created,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({ message: "Gagal memproses file" });
  }
};

export const exportJP = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        message: "start_date dan end_date wajib diisi",
      });
    }

    const schedules = await Schedule.find({
      date: { $gte: start_date, $lte: end_date },
    });

    if (!schedules.length) {
      return res.status(404).json({
        message: "Tidak ada data jadwal dalam rentang tanggal",
      });
    }

    const start = new Date(start_date);

    const group = {};

    schedules.forEach((s) => {
      if (!group[s.teacher_nik]) {
        group[s.teacher_nik] = {
          nik: s.teacher_nik,
          teacher_name: s.teacher_name,
          classes: new Set(),
          weeks: [0, 0, 0, 0, 0],
          totalJP: 0,
        };
      }

      group[s.teacher_nik].classes.add(s.class_name);

      const scheduleDate = new Date(s.date);
      const diffDays = Math.floor(
        (scheduleDate - start) / (1000 * 60 * 60 * 24)
      );

      const weekNumber = Math.floor(diffDays / 7) + 1;

      if (weekNumber >= 1 && weekNumber <= 5) {
        group[s.teacher_nik].weeks[weekNumber - 1] += 1;
      }

      group[s.teacher_nik].totalJP += 1;
    });

    const finalData = Object.values(group).map((item, idx) => ({
      No: idx + 1,
      NIK: item.nik,
      "Nama Pengajar": item.teacher_name,
      "Kelas yg Diajarkan": [...item.classes].join(", "),
      "Pekan 1": item.weeks[0],
      "Pekan 2": item.weeks[1],
      "Pekan 3": item.weeks[2],
      "Pekan 4": item.weeks[3],
      "Pekan 5": item.weeks[4],
      "Total JP": item.totalJP,
    }));

    const ws = XLSX.utils.json_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap JP");

    const reportsDir = path.join(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir);
    }

    const startObj = new Date(start_date);
    const month = String(startObj.getMonth() + 1).padStart(2, "0");
    const year = startObj.getFullYear();

    const fileName = `rekap_${month}${year}.xlsx`;
    const savePath = path.join(reportsDir, fileName);

    XLSX.writeFile(wb, savePath);

    const downloadUrl = `${req.protocol}://${req.get(
      "host"
    )}/reports/${fileName}`;

    res.json({
      message: "Laporan berhasil dibuat",
      download_url: downloadUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal membuat laporan" });
  }
};

export const getStudentSchedule = async (req, res) => {
  try {
    const { class_code, date } = req.query;

    if (!class_code || !date) {
      return res
        .status(400)
        .json({ message: "class_code dan date wajib diisi" });
    }

    const schedules = await Schedule.find({ class_code, date }).sort("jam_ke");

    if (schedules.length === 0) {
      return res.json({
        class_name: null,
        date,
        jadwal: [],
      });
    }

    const class_name = schedules[0].class_name;

    const formatted = {
      class_name,
      date,
      jadwal: schedules.map((s) => ({
        jam_ke: s.jam_ke,
        subject_code: s.subject_code,
        teacher_name: s.teacher_name,
        time_start: s.time_start,
        time_end: s.time_end,
      })),
    };

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil jadwal siswa" });
  }
};

export const getTeacherSchedule = async (req, res) => {
  try {
    const { teacher_nik, start_date, end_date } = req.query;

    if (!teacher_nik || !start_date || !end_date) {
      return res.status(400).json({
        message: "teacher_nik, start_date, dan end_date wajib diisi",
      });
    }

    const data = await Schedule.find({
      teacher_nik,
      date: { $gte: start_date, $lte: end_date },
    }).sort({ date: 1, jam_ke: 1 });

    if (data.length === 0) {
      return res.json({
        teacher_name: null,
        periode: { start_date, end_date },
        total_jp: 0,
        jadwal: [],
      });
    }

    const teacher_name = data[0].teacher_name;
    const total_jp = data.length;

    const jadwal = data.map((s) => ({
      date: s.date,
      class_name: s.class_name,
      subject_code: s.subject_code,
      jam_ke: s.jam_ke,
      time_start: s.time_start,
      time_end: s.time_end,
    }));

    res.json({
      teacher_name,
      periode: { start_date, end_date },
      total_jp,
      jadwal,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil jadwal guru" });
  }
};

export const getRekapJP = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        message: "start_date dan end_date wajib diisi",
      });
    }

    const schedules = await Schedule.find({
      date: { $gte: start_date, $lte: end_date },
    });

    if (schedules.length === 0) {
      return res.json({
        periode: { start_date, end_date },
        total_pengajar: 0,
        rekap: [],
      });
    }

    const groupByTeacher = {};

    schedules.forEach((s) => {
      if (!groupByTeacher[s.teacher_nik]) {
        groupByTeacher[s.teacher_nik] = {
          teacher_nik: s.teacher_nik,
          teacher_name: s.teacher_name,
          total_jp: 0,
          kelas: {},
        };
      }

      groupByTeacher[s.teacher_nik].total_jp += 1;

      if (!groupByTeacher[s.teacher_nik].kelas[s.class_name]) {
        groupByTeacher[s.teacher_nik].kelas[s.class_name] = 0;
      }
      groupByTeacher[s.teacher_nik].kelas[s.class_name] += 1;
    });

    const rekap = Object.values(groupByTeacher).map((t) => ({
      teacher_nik: t.teacher_nik,
      teacher_name: t.teacher_name,
      total_jp: t.total_jp,
      total_kelas: Object.keys(t.kelas).length,
      detail: Object.entries(t.kelas).map(([class_name, jumlah_jp]) => ({
        class_name,
        jumlah_jp,
      })),
    }));

    res.json({
      periode: { start_date, end_date },
      total_pengajar: rekap.length,
      rekap,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal mengambil rekap JP" });
  }
};
