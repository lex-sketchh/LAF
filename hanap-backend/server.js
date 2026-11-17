const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 5000;

// PostgreSQL Connection Pool Setup[cite: 4]
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

// Get all reports[cite: 4]
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

// Get reports submitted by a specific user[cite: 4]
app.get("/api/reports/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM item_reports WHERE reporter_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all registered users (Admin Dashboard feature)
app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT user_id, full_name, univ_id, email, mobile, role FROM users ORDER BY full_name ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit new report[cite: 4]
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

// DELETE Report Endpoint[cite: 4]
app.delete("/api/reports/:reportId", async (req, res) => {
  const { reportId } = req.params;
  try {
    await pool.query("DELETE FROM claims WHERE report_id = $1", [reportId]);
    const result = await pool.query(
      "DELETE FROM item_reports WHERE report_id = $1 RETURNING *",
      [reportId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Report not found." });
    }

    res.json({ success: true, message: "Report deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Claim for Found Item[cite: 4]
app.post("/api/claims", async (req, res) => {
  const { reportId, claimantId, proofDescription } = req.body;
  const claimId = `CLM-2026-${Math.floor(104 + Math.random() * 895)}`;

  try {
    const query = `
      INSERT INTO claims (claim_id, report_id, claimant_id, proof_description, status)
      VALUES ($1, $2, $3, $4, 'Pending') RETURNING *;
    `;
    const values = [claimId, reportId, claimantId, proofDescription];
    const { rows } = await pool.query(query, values);

    await pool.query(
      "UPDATE item_reports SET status = 'Claim Pending' WHERE report_id = $1",
      [reportId],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Claim error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get all claims[cite: 4]
app.get("/api/claims", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, r.name as item_name, r.type as item_type, r.report_id as item_report_id, u.full_name as claimant_name, u.email as claimant_email
      FROM claims c
      JOIN item_reports r ON c.report_id = r.report_id
      JOIN users u ON c.claimant_id = u.user_id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Claim Status
app.put("/api/claims/:claimId/status", async (req, res) => {
  const { claimId } = req.params;
  const { status } = req.body;

  try {
    const claimRes = await pool.query(
      "UPDATE claims SET status = $1 WHERE claim_id = $2 RETURNING *",
      [status, claimId],
    );

    if (claimRes.rows.length === 0) {
      return res.status(404).json({ error: "Claim not found." });
    }

    const claim = claimRes.rows[0];

    if (status === "Approved") {
      await pool.query(
        "UPDATE item_reports SET status = 'Returned' WHERE report_id = $1",
        [claim.report_id],
      );
    } else if (status === "Rejected") {
      await pool.query(
        "UPDATE item_reports SET status = 'Open' WHERE report_id = $1",
        [claim.report_id],
      );
    }

    res.json({ success: true, claim: claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Authentication & Login[cite: 4]
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

// Registration Endpoint[cite: 4]
app.post("/api/register", async (req, res) => {
  try {
    const { full_name, univ_id, email, mobile, role, password } = req.body;

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
