const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 5000;

// PostgreSQL Connection Pool Setup (Supports Supabase or Local URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL && process.env.DATABASE_URL.includes("supabase")
      ? { rejectUnauthorized: false }
      : false,
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error(
      "Error acquiring client connection to PostgreSQL:",
      err.stack,
    );
  }
  console.log("Successfully connected to PostgreSQL database!");
  release();
});

// --- API Endpoints ---

// 1. Get all reports (Search & Filter - FR-005)[cite: 10]
app.get("/api/reports", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM item_reports ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Submit new report (FR-003, FR-004)[cite: 10]
app.post("/api/reports", async (req, res) => {
  const {
    type,
    name,
    category,
    description,
    location,
    date,
    custodyLocation,
    reporterId,
    photoDataUrl,
  } = req.body;

  const reportId = `REP-2026-${Math.floor(104 + Math.random() * 895)}`;

  try {
    // FIXED: Changed photo_url to image_url to match database schema
    const query = `
      INSERT INTO item_reports (report_id, type, name, category, description, location, date, custody_location, status, reporter_id, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Open', $9, $10) RETURNING *;
    `;
    const values = [
      reportId,
      type,
      name,
      category,
      description,
      location,
      date,
      custodyLocation || "",
      reporterId,
      photoDataUrl,
    ];
    const { rows } = await pool.query(query, values);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. User Authentication & Login (FR-002, NFR-004)[cite: 10]
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (rows.length === 0)
      return res.status(401).json({ error: "Invalid email or password." });

    const user = rows[0];
    if (!user.active)
      return res.status(403).json({ error: "Account is deactivated." });
    if (user.password_hash !== password)
      return res.status(401).json({ error: "Invalid email or password." });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Registration Endpoint for New Accounts
app.post("/api/register", async (req, res) => {
  try {
    const { full_name, univ_id, email, mobile, role, password } = req.body;

    // Validate CSU Institutional Email
    if (!email || !email.endsWith("@carsu.edu.ph")) {
      return res.status(400).json({
        error:
          "Please use your official Caraga State University email (@carsu.edu.ph).",
      });
    }

    const query = `
      INSERT INTO users (full_name, univ_id, email, mobile, role, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING user_id, full_name, email, role;
    `;

    const values = [full_name, univ_id, email, mobile, role, password];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Registration error:", err.message);
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "Email or University ID is already registered." });
    }
    res
      .status(500)
      .json({ error: "Database error during registration: " + err.message });
  }
});

app.listen(PORT, () =>
  console.log(`HANAP Backend server running on port ${PORT}`),
);
