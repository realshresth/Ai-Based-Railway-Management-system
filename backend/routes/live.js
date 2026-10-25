const express = require("express");
const pool = require("../config/db");
const { verifyToken, requireAdmin } = require("../middleware/auth");
const { getTrainStatus } = require("../utils/liveTrain");
const { sendSms } = require("../utils/sms");
const { runJourneyNotifier } = require("../utils/notify");

const router = express.Router();

// Public: where is my train?  GET /api/live/train/12345
router.get("/train/:number", async (req, res) => {
  const no = String(req.params.number).trim();
  if (!/^\d{3,6}$/.test(no)) return res.status(400).json({ error: "Enter a valid train number." });
  try {
    const status = await getTrainStatus(no);
    if (!status) return res.status(404).json({ error: "No status available for this train number (it is not in this system and live tracking returned nothing)." });
    res.json({ ...status, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error("Train status failed:", e);
    res.status(502).json({ error: "Could not get the train status: " + e.message });
  }
});

// Admin: check SMS setup -> POST /api/live/sms-test {phone}
router.post("/sms-test", verifyToken, requireAdmin, async (req, res) => {
  const r = await sendSms(req.body.phone, "RailReserve test message: SMS is working.");
  res.status(r.ok ? 200 : 400).json({ provider: process.env.SMS_PROVIDER || "console", ...r });
});

// Admin: run the journey-day SMS job right now
router.post("/notify-now", verifyToken, requireAdmin, async (req, res) => {
  await runJourneyNotifier();
  const [rows] = await pool.query("SELECT kind, phone, provider_status, created_at FROM sms_log ORDER BY id DESC LIMIT 20");
  res.json({ message: "Job finished.", recent: rows });
});

module.exports = router;
