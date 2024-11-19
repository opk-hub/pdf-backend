const express = require("express");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const app = express();
const port = 5000;

// Initialize SQLite database
const db = new sqlite3.Database("./panchama-vedam.db");

// Set up multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

app.use(express.json());
app.use(cors());

// Create table in the database if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS uploaded_pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      pdf_path TEXT,
      upload_date TEXT,
      frequency TEXT
    )
  `);
});

// POST route for uploading files
app.post("/upload", upload.single("pdf"), (req, res) => {
  const { title, uploadDate, frequency } = req.body;
  const pdf = req.file;

  // Check for missing data
  if (!title || !uploadDate || !frequency || !pdf) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Convert the uploadDate into a Date object
  const date = new Date(uploadDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  let folderPath;

  // Set folder path based on frequency (daily or monthly)
  if (frequency === "daily") {
    // Create folder for daily uploads: uploads/daily/YYYY-MM/YYYY-MM-DD
    folderPath = path.join(
      "uploads",
      "daily",
      `${year}-${month}`,
      `${year}-${month}-${day}`
    );
  } else if (frequency === "monthly") {
    // Create folder for monthly uploads: uploads/monthly/YYYY-MM/YYYY-MM-DD
    folderPath = path.join(
      "uploads",
      "monthly",
      `${year}-${month}`,
      `${year}-${month}-${day}`
    );
  } else {
    return res.status(400).json({ error: "Invalid frequency value." });
  }

  // Create the folder if it doesn't exist
  fs.mkdirSync(folderPath, { recursive: true });

  // Set the file path (filename with title and date)
  const filePath = path.join(folderPath, `${title}-${day}.pdf`);

  // Move the uploaded file to the correct folder
  fs.renameSync(pdf.path, filePath);

  // Insert file data into the database
  db.run(
    `INSERT INTO uploaded_pdfs (title, pdf_path, upload_date, frequency) VALUES (?, ?, ?, ?)`,
    [title, filePath, uploadDate, frequency],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Error uploading file." });
      }
      res.status(200).json({ message: "File uploaded successfully!" });
    }
  );
});

// GET route to fetch PDFs based on frequency
app.get("/getPdfs", (req, res) => {
  const { frequency } = req.query;
  const sql = `SELECT * FROM uploaded_pdfs WHERE frequency = ?`;

  db.all(sql, [frequency], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Error fetching PDFs." });
    }
    res.json(rows);
  });
});

// Serve uploaded PDFs
app.use("/uploads", express.static("uploads"));

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
