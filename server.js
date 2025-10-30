// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

// ---- Allowed origins (Render env: ALLOWED_ORIGINS="https://<netlify>.netlify.app,https://your-domain,http://localhost:5173")
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// ---- CORS BEFORE routes
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);                 // allow curl/Postman
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
};
app.use(cors(corsOptions));

// ❌ OLD (breaks with path-to-regexp v6): app.options("*", cors());
// ✅ Either omit entirely (preferred) or:
app.options("(.*)", cors(corsOptions));   // catch-all preflight for Express 5

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Health checks
app.get("/healthz", (req, res) => res.type("text").send("OK"));
app.get("/api/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Contact form
app.post("/api/messages", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,   // App Password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,     // avoid spoofing SPF/DMARC
      to: process.env.EMAIL_USER,
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
