// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();

// --- Trust proxy when running behind Render ---
app.set("trust proxy", 1);

// --- Allowed origins (Netlify, custom domain, and localhost for dev) ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// --- CORS (place BEFORE routes) ---
app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser requests (no Origin header)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Handle preflight fast
app.options("*", cors());

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// --- Health checks (for quick testing from Netlify) ---
app.get("/healthz", (req, res) => res.type("text").send("OK"));
app.get("/api/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));

// --- Contact form endpoint ---
app.post("/api/messages", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Use Gmail via App Password (recommended)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your Gmail address
        pass: process.env.EMAIL_PASS, // your Gmail App Password
      },
    });

    // Use your own mailbox in "from" and set reply-to to the user's email
    // (this avoids SPF/DMARC issues that happen when spoofing 'from')
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // your inbox (Gencorp’s email)
      replyTo: email,
      subject: `New message from ${name}`,
      text: message,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("❌ Email send error:", error);
    res.status(500).json({ error: "Failed to send email. Please try again later." });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
